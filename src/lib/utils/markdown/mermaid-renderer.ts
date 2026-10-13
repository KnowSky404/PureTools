import {
  guardMermaidSource,
  isSafeSvgAttribute,
  isSafeSvgCss,
  isSafeSvgElement,
} from "./mermaid-safety";

export type MermaidTheme = "light" | "dark";

export type MermaidRenderResult = {
  svg?: string;
  error?: string;
};

export type MermaidRenderer = {
  render(source: string, theme: MermaidTheme, id: string): Promise<MermaidRenderResult>;
  dispose(): void;
};

type FrameMessage =
  | { type: "ready" }
  | { type: "result"; requestId: number; svg: string }
  | { type: "error"; requestId: number; error: string };

type PendingRequest = {
  resolve: (result: MermaidRenderResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

const MAX_CACHE_ENTRIES = 32;
const RENDER_TIMEOUT_MS = 15_000;
const CONFIG_VERSION = "strict-v1";

type WorkerUrlModule = { default: string };

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function makeFrameDocument(frameUrl: string): string {
  const escapedFrameUrl = escapeAttribute(frameUrl);
  const frameSource = new URL(frameUrl, document.baseURI);
  // Dev's ESM worker asset imports Vite's own module/dependency URLs, so the
  // dev policy is scoped to the current application origin. Production uses
  // the self-contained IIFE asset and can pin CSP to its exact path.
  const scriptSource = frameUrl.includes("worker_file&type=module")
    ? frameSource.origin
    : `${frameSource.origin}${frameSource.pathname}`;
  const script = frameUrl.includes("worker_file&type=module")
    ? `<script type="module" src="${escapedFrameUrl}"></script>`
    : `<script src="${escapedFrameUrl}"></script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${scriptSource}; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"></head><body>${script}</body></html>`;
}

function makeRenderId(id: string, sequence: number): string {
  const normalized = id.replace(/[^A-Za-z0-9_-]/g, "-").replace(/^-+|-+$/g, "") || "diagram";
  return `puretools-${normalized}-${sequence}`;
}

function isSafeGeneratedStylesheet(value: string): boolean {
  return isSafeSvgCss(value);
}

function ensureUniqueSvgIds(svg: string): string {
  const document = new DOMParser().parseFromString(svg, "text/html");
  const root = document.querySelector("svg");
  if (!root) {
    return svg;
  }

  // Preserve readable label sizes on narrow screens. The figure supplies a
  // local scroll area instead of squeezing the entire diagram to phone width.
  const width = Number(
    root
      .getAttribute("viewBox")
      ?.trim()
      .split(/[\s,]+/u)[2],
  );
  if (Number.isFinite(width) && width > 0) {
    root.setAttribute("width", String(width));
    root.style.width = `${width}px`;
    root.style.maxWidth = "none";
    root.style.height = "auto";
  }

  const seen = new Set<string>();
  const elements = [root, ...root.querySelectorAll("[id]")];
  for (const element of elements) {
    const current = element.getAttribute("id");
    if (!current) {
      continue;
    }
    let candidate = current;
    let suffix = 1;
    while (seen.has(candidate)) {
      candidate = `${current}-${suffix}`;
      suffix += 1;
    }
    if (candidate !== current) {
      element.setAttribute("id", candidate);
    }
    seen.add(candidate);
  }
  return new XMLSerializer().serializeToString(root);
}

async function sanitizeSvg(svg: string): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Mermaid rendering is only available in a browser.");
  }

  const module = await import("dompurify");
  const createDOMPurify = module.default;
  const purifier = createDOMPurify(window);
  purifier.addHook("uponSanitizeElement", (node: Node) => {
    if (node instanceof Element) {
      if (!isSafeSvgElement(node.tagName)) {
        node.remove();
      } else if (
        node.tagName.toLowerCase() === "style" &&
        !isSafeGeneratedStylesheet(node.textContent ?? "")
      ) {
        node.remove();
      }
    }
  });
  purifier.addHook(
    "uponSanitizeAttribute",
    (_node: Node, data: { attrName: string; attrValue: string; keepAttr: boolean }) => {
      if (!isSafeSvgAttribute(data.attrName, data.attrValue)) {
        data.keepAttr = false;
      }
    },
  );

  try {
    const sanitized = purifier.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ALLOW_DATA_ATTR: false,
      ADD_TAGS: ["style"],
      ADD_ATTR: ["style"],
      FORBID_TAGS: ["base", "embed", "foreignObject", "iframe", "object", "script"],
      RETURN_TRUSTED_TYPE: false,
    });
    return ensureUniqueSvgIds(sanitized);
  } finally {
    purifier.removeAllHooks();
  }
}

export function createMermaidRenderer(): MermaidRenderer {
  let disposed = false;
  let frame: HTMLIFrameElement | null = null;
  let frameReady: Promise<void> | null = null;
  let requestSequence = 0;
  let renderSequence = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let cancelInitialization: (() => void) | null = null;
  let frameUrl: string | null = null;
  let frameUrlAttempt = 0;
  const pending = new Map<number, PendingRequest>();
  const cache = new Map<string, MermaidRenderResult>();

  const onMessage = (event: MessageEvent<FrameMessage>): void => {
    if (!frame || event.source !== frame.contentWindow || !event.data) {
      return;
    }
    const message = event.data;
    if (message.type === "ready") {
      return;
    }
    const request = pending.get(message.requestId);
    if (!request) {
      return;
    }
    pending.delete(message.requestId);
    clearTimeout(request.timer);
    if (message.type === "result") {
      void sanitizeSvg(message.svg)
        .then((svg) => request.resolve({ svg }))
        .catch((error: unknown) => {
          request.resolve({
            error:
              error instanceof Error
                ? error.message
                : "Generated SVG was rejected by the safety filter.",
          });
        });
    } else {
      request.resolve({ error: message.error });
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("message", onMessage);
  }

  async function resolveFrameUrl(): Promise<string> {
    if (frameUrl) {
      return frameUrl;
    }
    frameUrlAttempt += 1;
    let worker: WorkerUrlModule;
    if (import.meta.env.DEV) {
      // Vite's development worker URL stubs participate in the host module
      // graph. Give failed stub fetches a fresh URL; production eliminates
      // this branch before resolving imports, compiling the full library once.
      switch (frameUrlAttempt) {
        case 1:
          worker = await import("./mermaid-frame.ts?worker&url");
          break;
        case 2:
          // @ts-expect-error Vite resolves the retry query at build time.
          worker = await import("./mermaid-frame.ts?worker&url&retry=2");
          break;
        case 3:
          // @ts-expect-error Vite resolves the retry query at build time.
          worker = await import("./mermaid-frame.ts?worker&url&retry=3");
          break;
        default:
          // @ts-expect-error Vite resolves the retry query at build time.
          worker = await import("./mermaid-frame.ts?worker&url&retry=4");
          break;
      }
    } else {
      worker = await import("./mermaid-frame.ts?worker&url");
    }
    frameUrl = worker.default;
    return frameUrl;
  }

  async function initializeFrame(): Promise<void> {
    const resolvedFrameUrl = await resolveFrameUrl();
    if (disposed) {
      throw new Error("Mermaid renderer has been disposed.");
    }

    await new Promise<void>((resolve, reject) => {
      const nextFrame = document.createElement("iframe");
      nextFrame.setAttribute("sandbox", "allow-scripts");
      nextFrame.setAttribute("aria-hidden", "true");
      nextFrame.tabIndex = -1;
      nextFrame.style.position = "fixed";
      nextFrame.style.left = "-100000px";
      nextFrame.style.top = "0";
      nextFrame.style.width = "1024px";
      nextFrame.style.height = "768px";
      nextFrame.style.opacity = "0";
      nextFrame.style.pointerEvents = "none";
      nextFrame.style.border = "0";
      nextFrame.srcdoc = makeFrameDocument(resolvedFrameUrl);
      const timeout = setTimeout(
        () => fail(new Error("Mermaid renderer initialization timed out.")),
        RENDER_TIMEOUT_MS,
      );
      const cleanup = (): void => {
        clearTimeout(timeout);
        window.removeEventListener("message", onReady);
      };
      const fail = (error: Error): void => {
        cleanup();
        cancelInitialization = null;
        nextFrame.remove();
        if (frame === nextFrame) {
          frame = null;
          frameReady = null;
        }
        if (frameUrl === resolvedFrameUrl) {
          frameUrl = null;
        }
        reject(error);
      };
      const onReady = (event: MessageEvent<FrameMessage>): void => {
        if (event.source !== nextFrame.contentWindow || event.data?.type !== "ready") {
          return;
        }
        cleanup();
        cancelInitialization = null;
        resolve();
      };
      cancelInitialization = () => fail(new Error("Mermaid renderer has been disposed."));
      window.addEventListener("message", onReady);
      frame = nextFrame;
      document.body.append(nextFrame);
    });
  }

  function ensureFrame(): Promise<void> {
    if (frameReady) {
      return frameReady;
    }
    if (typeof document === "undefined") {
      return Promise.reject(new Error("Mermaid rendering is only available in a browser."));
    }

    frameReady = initializeFrame().catch((error: unknown) => {
      frameReady = null;
      throw error;
    });
    return frameReady;
  }

  function requestFrame(
    source: string,
    theme: MermaidTheme,
    renderId: string,
  ): Promise<MermaidRenderResult> {
    const requestId = ++requestSequence;
    return new Promise<MermaidRenderResult>((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        // A timed-out async render must never share Mermaid's global state
        // with the next queued job. Retire its realm before creating another.
        // This timer cannot preempt synchronous work on the browser thread.
        frame?.remove();
        frame = null;
        frameReady = null;
        resolve({ error: "Mermaid rendering timed out." });
      }, RENDER_TIMEOUT_MS);
      pending.set(requestId, { resolve, timer });
      if (!frame?.contentWindow) {
        clearTimeout(timer);
        pending.delete(requestId);
        resolve({ error: "Mermaid renderer frame is unavailable." });
        return;
      }
      frame.contentWindow.postMessage({ type: "render", requestId, renderId, source, theme }, "*");
    });
  }

  function cacheResult(key: string, result: MermaidRenderResult): MermaidRenderResult {
    cache.delete(key);
    cache.set(key, result);
    while (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      cache.delete(oldest);
    }
    return result;
  }

  function render(source: string, theme: MermaidTheme, id: string): Promise<MermaidRenderResult> {
    const guard = guardMermaidSource(source);
    if (!guard.ok) {
      return Promise.resolve({ error: guard.error });
    }
    if (disposed) {
      return Promise.resolve({ error: "Mermaid renderer has been disposed." });
    }

    const key = `${CONFIG_VERSION}\u0000${theme}\u0000${id}\u0000${source}`;
    const cached = cache.get(key);
    if (cached) {
      cache.delete(key);
      cache.set(key, cached);
      return Promise.resolve(cached);
    }

    const task = queue.then(async () => {
      if (disposed) {
        return { error: "Mermaid renderer has been disposed." };
      }
      const existing = cache.get(key);
      if (existing) {
        return existing;
      }
      try {
        await ensureFrame();
        if (disposed) {
          return { error: "Mermaid renderer has been disposed." };
        }
        const result = await requestFrame(source, theme, makeRenderId(id, ++renderSequence));
        return result.svg ? cacheResult(key, result) : result;
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Mermaid renderer failed to initialize.",
        };
      }
    });
    queue = task.catch(() => undefined);
    return task;
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    cancelInitialization?.();
    cancelInitialization = null;
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.resolve({ error: "Mermaid renderer has been disposed." });
    }
    pending.clear();
    cache.clear();
    frame?.remove();
    frame = null;
    frameReady = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("message", onMessage);
    }
  }

  return { render, dispose };
}
