import type { MermaidRenderer, MermaidTheme } from "./mermaid-renderer";
import { parseMarkdown } from "./parse";
import { escapeHtml } from "./policy";
import { PREVIEW_CSS } from "./preview-style";
import { LIMITS, type MarkdownMode, type MarkdownSlot } from "./types";

export interface MarkdownRenderResult {
  document: string;
  warnings: string[];
}

type SlotResult = { html: string; css?: string; error?: string };

async function renderMath(slot: MarkdownSlot): Promise<SlotResult> {
  try {
    const [katex, stylesheet, dompurify] = await Promise.all([
      import("katex"),
      import("katex/dist/katex.min.css?inline"),
      import("dompurify"),
    ]);
    const output = katex.renderToString(slot.source, {
      displayMode: slot.display === true,
      output: "htmlAndMathml",
      trust: false,
      strict: "error",
      throwOnError: true,
      maxExpand: 1_000,
      maxSize: 20,
      macros: {},
    });
    // This schema applies only to KaTeX's trusted transformation. User HTML
    // has already passed the much smaller rehype allowlist.
    const purifier = dompurify.default(window);
    const html = purifier.sanitize(output, {
      USE_PROFILES: { html: true, mathMl: true, svg: true },
      FORBID_TAGS: ["img", "style", "script", "iframe", "foreignObject", "a"],
      FORBID_ATTR: ["href", "xlink:href", "src", "srcset"],
      ALLOW_DATA_ATTR: false,
    });
    return {
      html: `<span class="${slot.display ? "math-display" : "math-inline"}">${html}</span>`,
      css: stylesheet.default,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Math rendering failed.";
    const delimiter = slot.display ? "$$" : "$";
    return {
      html: `<span class="markdown-error"><code>${escapeHtml(delimiter + slot.source + delimiter)}</code> — ${escapeHtml(message)}</span>`,
      error: message,
    };
  }
}

async function renderCode(slot: MarkdownSlot): Promise<SlotResult> {
  let code = escapeHtml(slot.source);
  const aliases: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    html: "xml",
    sh: "bash",
    py: "python",
    yml: "yaml",
  };
  const language = aliases[slot.language?.toLowerCase() ?? ""] ?? slot.language?.toLowerCase();
  try {
    // Fixed import targets ensure unknown languages cannot turn into arbitrary
    // modules. Only the language present in an AST code node is downloaded.
    const loaders = {
      javascript: () => import("highlight.js/lib/languages/javascript"),
      typescript: () => import("highlight.js/lib/languages/typescript"),
      json: () => import("highlight.js/lib/languages/json"),
      xml: () => import("highlight.js/lib/languages/xml"),
      css: () => import("highlight.js/lib/languages/css"),
      bash: () => import("highlight.js/lib/languages/bash"),
      python: () => import("highlight.js/lib/languages/python"),
      sql: () => import("highlight.js/lib/languages/sql"),
      yaml: () => import("highlight.js/lib/languages/yaml"),
    };
    if (language && slot.source.length <= LIMITS.maxCodeChars && Object.hasOwn(loaders, language)) {
      const [core, grammar] = await Promise.all([
        import("highlight.js/lib/core"),
        loaders[language as keyof typeof loaders](),
      ]);
      if (!core.default.getLanguage(language)) {
        core.default.registerLanguage(language, grammar.default);
      }
      code = core.default.highlight(slot.source, { language, ignoreIllegals: true }).value;
    }
  } catch {
    // Highlighting is optional: the original escaped text remains readable.
  }
  return { html: `<pre><code>${code}</code></pre>` };
}

async function renderDiagram(
  slot: MarkdownSlot,
  theme: MermaidTheme,
  renderer: MermaidRenderer | null,
): Promise<SlotResult> {
  let svg: string | undefined;
  let error: string | undefined;
  try {
    const result = await renderer?.render(slot.source, theme, slot.id);
    svg = result?.svg;
    error =
      result?.error ?? (svg ? undefined : "Mermaid renderer is unavailable. Refresh to retry.");
  } catch (failure) {
    error =
      failure instanceof Error ? failure.message : "Mermaid failed to load. Refresh to retry.";
  }
  const reportedLine = error ? /\bline\s+(\d+)\b/i.exec(error)?.[1] : undefined;
  const errorLine =
    slot.line === undefined
      ? undefined
      : reportedLine
        ? slot.line + Number(reportedLine)
        : slot.line;
  const source = `<details><summary>Diagram source${slot.line ? ` · line ${slot.line}` : ""}</summary><pre><code>${escapeHtml(slot.source)}</code></pre></details>`;
  return {
    html: `<figure class="diagram">${svg ? `<div class="diagram-scroll">${svg}</div>` : ""}${error ? `<p class="mermaid-error">${escapeHtml(error)}${errorLine ? ` (source line ${errorLine})` : ""}</p>` : ""}${source}</figure>`,
    error,
  };
}

function buildDocument(html: string, theme: MermaidTheme, mathCss: string): string {
  // Only URLs from the application's bundled KaTeX stylesheet enter font-src.
  // Make root-relative build URLs absolute for srcdoc's about: base URL.
  const fonts = new Set<string>();
  const css = mathCss.replace(/url\(([^)]+)\)/g, (original, raw: string) => {
    const value = raw.trim().replace(/^["']|["']$/g, "");
    if (value.startsWith("data:")) {
      fonts.add("data:");
      return original;
    }
    const url = new URL(value, window.location.href);
    if (url.origin !== window.location.origin || !/\.(?:woff2?|ttf)(?:\?|$)/.test(url.pathname)) {
      return "url()";
    }
    fonts.add(url.href);
    return `url("${url.href}")`;
  });
  const csp = `default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; style-src 'unsafe-inline'; font-src ${fonts.size ? [...fonts].join(" ") : "'none'"}; base-uri about:; form-action 'none'`;
  return `<!doctype html><html lang="en" class="${theme}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="about:srcdoc"><title>Markdown document preview</title><style>${PREVIEW_CSS}${css}</style></head><body>${html || '<p class="markdown-empty">Start writing or paste Markdown to preview.</p>'}</body></html>`;
}

export async function renderMarkdown(
  source: string,
  mode: MarkdownMode,
  theme: MermaidTheme,
  renderer: MermaidRenderer | null,
  isCurrent: () => boolean = () => true,
): Promise<MarkdownRenderResult> {
  const parsed = await parseMarkdown(source, mode);
  if (!isCurrent()) {
    throw new Error("Preview was superseded.");
  }
  const warnings = [...parsed.warnings];
  // This DOM only receives already sanitized, resource-free HTML. It is never
  // attached to the host page. Generated content is sanitized independently.
  const preview = new DOMParser().parseFromString(parsed.html, "text/html");
  let mathCss = "";
  for (const slot of parsed.slots) {
    if (!isCurrent()) {
      throw new Error("Preview was superseded.");
    }
    const result =
      slot.kind === "mermaid"
        ? await renderDiagram(slot, theme, renderer)
        : slot.kind === "math"
          ? await renderMath(slot)
          : await renderCode(slot);
    if (!isCurrent()) {
      throw new Error("Preview was superseded.");
    }
    if (result.css) {
      mathCss = result.css;
    }
    if (result.error) {
      warnings.push(
        `${slot.kind === "math" ? "Math" : "Mermaid"}${slot.line ? ` at line ${slot.line}` : ""}: ${result.error}`,
      );
    }
    const placeholder = preview.querySelector(`[data-puretools-slot="${slot.id}"]`);
    if (placeholder) {
      const template = preview.createElement("template");
      template.innerHTML = result.html;
      placeholder.replaceWith(template.content);
    }
  }
  return { document: buildDocument(preview.body.innerHTML, theme, mathCss), warnings };
}
