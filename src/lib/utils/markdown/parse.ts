import type { Element, Root as HastRoot } from "hast";
import type { Content, Root as MdastRoot } from "mdast";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { escapeHtml, isSafeMarkdownHref, markdownSanitizeSchema } from "./policy";
import {
  DEFAULT_MARKDOWN_LIMITS,
  MARKDOWN_SLOT_PREFIX,
  type MarkdownLimits,
  type MarkdownMode,
  type MarkdownParseResult,
  type MarkdownSlot,
} from "./types";

interface NodeWithData {
  type: string;
  value?: string;
  alt?: string | null;
  url?: string;
  lang?: string | null;
  children?: Content[];
  position?: { start?: { line?: number; offset?: number }; end?: { offset?: number } };
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
}

interface ParseContext {
  mode: MarkdownMode;
  input: string;
  limits: MarkdownLimits;
  slots: MarkdownSlot[];
  warnings: string[];
  marker: string;
  mermaidCount: number;
}

let parserInvocation = 0;

function normaliseLimits(limits?: Partial<MarkdownLimits>): MarkdownLimits {
  const value = (key: keyof MarkdownLimits): number => {
    const candidate = limits?.[key];
    const fallback = DEFAULT_MARKDOWN_LIMITS[key];
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
      return fallback;
    }
    if (key === "maxDiagrams") {
      return Math.max(0, Math.floor(candidate));
    }
    return Math.max(1, Math.floor(candidate));
  };
  return {
    maxInputBytes: value("maxInputBytes"),
    manualRenderThresholdBytes: value("manualRenderThresholdBytes"),
    maxDiagrams: value("maxDiagrams"),
    maxDiagramChars: value("maxDiagramChars"),
    maxDiagramEdges: value("maxDiagramEdges"),
    maxMathChars: value("maxMathChars"),
    maxCodeChars: value("maxCodeChars"),
  };
}

function makeMarker(): string {
  parserInvocation += 1;
  return `\uE000PURETOOLS_SLOT_${parserInvocation}_${Math.random().toString(36).slice(2)}\uE001`;
}

function lineOf(node: NodeWithData): number | undefined {
  return node.position?.start?.line;
}

function sourceText(node: NodeWithData, context: ParseContext): string {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (start !== undefined && end !== undefined) {
    const bomOffset = context.input.startsWith("\uFEFF") ? 1 : 0;
    return context.input.slice(start + bomOffset, end + bomOffset);
  }
  return `$${node.value ?? ""}$`;
}

function slotId(index: number): string {
  return `${MARKDOWN_SLOT_PREFIX}${index}`;
}

function addWarning(context: ParseContext, message: string): void {
  if (!context.warnings.includes(message)) {
    context.warnings.push(message);
  }
}

function textFromChildren(children: Content[] | undefined): string {
  if (!children) {
    return "";
  }
  return children
    .map((child) => {
      const node = child as NodeWithData;
      if (typeof node.value === "string") {
        return node.value;
      }
      return textFromChildren(node.children);
    })
    .join("");
}

function slugFromHeading(node: NodeWithData): string {
  const text = textFromChildren(node.children)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
  return text || "section";
}

function replaceNodeWithMarker(node: NodeWithData, marker: string, inline = false): void {
  // A paragraph is valid in both the block and inline contexts used by the
  // replacements below. The marker is plain text until the final trusted
  // placeholder replacement, so user HTML cannot create a slot.
  node.type = inline ? "text" : "paragraph";
  if (inline) {
    node.value = marker;
    delete node.children;
  } else {
    node.children = [{ type: "text", value: marker } as Content];
    delete node.value;
  }
  delete node.data;
}

function isCurrencyMath(node: NodeWithData): boolean {
  const value = node.value ?? "";
  return /^\s*\d[\d,]*(?:\.\d+)?\s*(?:(?:and|or|each|per|usd|dollars?)\b[^$]*)?$/i.test(value);
}

function edgeCount(source: string): number {
  const operator =
    /(?:<-->|<==>|<-.->|<--[ox]?|<==[ox]?|<-.?[ox]?|-->|---|--[ox]?|==>|===|==[ox]?|-.->|-.-[ox]?|~~~)/g;
  let edges = 0;
  for (const line of source.split(/\r?\n/)) {
    const clean = line.replace(/%%.*$/u, "").replace(/"[^"\n]*"/gu, "");
    const matches = [...clean.matchAll(operator)];
    let cursor = 0;
    for (const [index, match] of matches.entries()) {
      const left = clean.slice(cursor, match.index);
      const rightEnd = matches[index + 1]?.index ?? clean.length;
      const right = clean.slice(match.index + match[0].length, rightEnd);
      const leftNodes = Math.max(1, left.split("&").filter((item) => item.trim()).length);
      const rightNodes = Math.max(1, right.split("&").filter((item) => item.trim()).length);
      edges += leftNodes * rightNodes;
      cursor = match.index + match[0].length;
    }
  }
  return edges;
}

function isForbiddenRawHtml(value: string): boolean {
  return /<\/?\s*(?:base|embed|form|iframe|link|meta|object|script|style|svg)\b|\bon[a-z]+\s*=|\bstyle\s*=/iu.test(
    value,
  );
}

function addSlot(
  context: ParseContext,
  node: NodeWithData,
  kind: MarkdownSlot["kind"],
  source: string,
  options: Omit<MarkdownSlot, "id" | "kind" | "source"> = {},
  inline = false,
): void {
  const id = slotId(context.slots.length);
  context.slots.push({ id, kind, source, ...options });
  replaceNodeWithMarker(node, context.marker, inline);
}

function remarkMarkdownExtensions(context: ParseContext) {
  return function transformer(tree: MdastRoot): void {
    const headingIds = new Map<string, number>();
    visit(tree, (node) => {
      const current = node as NodeWithData;
      if (current.type === "heading") {
        const base = slugFromHeading(current);
        const count = (headingIds.get(base) ?? 0) + 1;
        headingIds.set(base, count);
        current.data ??= {};
        current.data.hProperties = {
          ...(current.data.hProperties ?? {}),
          id: count === 1 ? base : `${base}-${count}`,
        };
        return;
      }

      if (current.type === "html" && isForbiddenRawHtml(current.value ?? "")) {
        current.type = "text";
        delete current.children;
        delete current.data;
        return;
      }

      if (current.type === "image") {
        const alt = current.alt ?? "image";
        current.type = "text";
        const url = current.url ?? "";
        const description = /^https?:\/\//iu.test(url)
          ? "Remote image blocked"
          : /^data:/iu.test(url)
            ? "Embedded image blocked"
            : /^file:/iu.test(url)
              ? "Local image blocked"
              : "Relative image unavailable — import does not include adjacent files";
        current.value = `[${description}: ${String(alt)}]`;
        delete current.children;
        delete current.alt;
        return;
      }

      if (context.mode === "enhanced" && current.type === "blockquote") {
        const first = current.children?.[0] as NodeWithData | undefined;
        const markerText =
          first?.type === "paragraph"
            ? (first.children?.[0] as NodeWithData | undefined)
            : undefined;
        const markerOffset = markerText?.position?.start?.offset;
        const rawLine =
          markerOffset === undefined
            ? ""
            : context.input
                .slice(markerOffset + (context.input.startsWith("\uFEFF") ? 1 : 0))
                .split(/\r?\n/u, 1)[0];
        const match =
          markerText?.type === "text"
            ? /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*$/iu.exec(rawLine)
            : null;
        if (match && first?.children) {
          if (markerText?.value) {
            markerText.value = markerText.value.replace(/^\[![A-Z]+\][ \t]*(?:\r?\n)?/iu, "");
          }
          if (!textFromChildren(first.children).trim()) {
            current.children?.shift();
          }
          current.data ??= {};
          current.data.hName = "div";
          current.data.hProperties = {
            className: `markdown-alert markdown-alert-${match[1].toLowerCase()}`,
          };
          current.children?.unshift({
            type: "paragraph",
            children: [
              { type: "strong", children: [{ type: "text", value: match[1].toUpperCase() }] },
            ],
          } as Content);
        }
        return;
      }

      if (current.type === "code") {
        const source = current.value ?? "";
        const language = current.lang || undefined;
        if (context.mode === "enhanced" && language?.toLowerCase() === "mermaid") {
          if (context.mermaidCount >= context.limits.maxDiagrams) {
            addWarning(context, `Mermaid diagram limit reached (${context.limits.maxDiagrams}).`);
            addSlot(context, current, "code", source, { language, line: lineOf(current) });
            return;
          }
          if (source.length > context.limits.maxDiagramChars) {
            addWarning(
              context,
              `A Mermaid diagram exceeds ${context.limits.maxDiagramChars.toLocaleString()} characters and was kept as code.`,
            );
            addSlot(context, current, "code", source, { language, line: lineOf(current) });
            return;
          }
          if (edgeCount(source) > context.limits.maxDiagramEdges) {
            addWarning(
              context,
              `A Mermaid diagram exceeds ${context.limits.maxDiagramEdges} edges and was kept as code.`,
            );
            addSlot(context, current, "code", source, { language, line: lineOf(current) });
            return;
          }
          context.mermaidCount += 1;
          addSlot(context, current, "mermaid", source, { language, line: lineOf(current) });
          return;
        }
        if (source.length > context.limits.maxCodeChars) {
          addWarning(
            context,
            `A code block exceeds ${context.limits.maxCodeChars.toLocaleString()} characters and was kept as plain text.`,
          );
          return;
        }
        addSlot(context, current, "code", source, { language, line: lineOf(current) });
        return;
      }

      if (context.mode !== "enhanced") {
        return;
      }

      if (current.type === "inlineMath" || current.type === "math") {
        const source = current.value ?? "";
        if (isCurrencyMath(current)) {
          current.type = "text";
          current.value = sourceText(current, context);
          delete current.children;
          delete current.data;
          return;
        }
        if (source.length > context.limits.maxMathChars) {
          addWarning(
            context,
            `A math expression exceeds ${context.limits.maxMathChars.toLocaleString()} characters and was kept as source text.`,
          );
          return;
        }
        addSlot(
          context,
          current,
          "math",
          source,
          { display: current.type === "math", line: lineOf(current) },
          current.type === "inlineMath",
        );
      }

      if (current.type === "yaml") {
        const startsAt = current.position?.start?.offset;
        const isDocumentFrontmatter = startsAt === 0 || startsAt === 1;
        if (!isDocumentFrontmatter) {
          current.type = "text";
          current.value = sourceText(current, context);
          delete current.children;
          delete current.data;
          return;
        }
        const original = `${context.input.startsWith("\uFEFF") ? "\uFEFF" : ""}${sourceText(current, context)}`;
        const value = escapeHtml(original);
        current.type = "html";
        current.value = `<details class="markdown-frontmatter"><summary>Frontmatter</summary><pre><code>${value}</code></pre></details>`;
        delete current.children;
      }
    });
  };
}

function rehypeMarkdownSafety(context: ParseContext) {
  return function transformer(tree: HastRoot): void {
    const ids = new Set<string>();
    visit(tree, "element", (node) => {
      const element = node as Element;
      const id = typeof element.properties?.id === "string" ? element.properties.id : "";
      if (id.startsWith("user-content-user-content-")) {
        element.properties.id = id.slice("user-content-".length);
      }
      const normalizedId = typeof element.properties?.id === "string" ? element.properties.id : "";
      if (normalizedId) {
        ids.add(normalizedId);
      }
    });
    visit(tree, "element", (node) => {
      const element = node as Element;
      if (element.tagName === "a") {
        const href = typeof element.properties?.href === "string" ? element.properties.href : "";
        if (!isSafeMarkdownHref(href)) {
          delete element.properties?.href;
          addWarning(
            context,
            "A link was disabled because only absolute HTTP(S), mailto, and document anchors are allowed.",
          );
          return;
        }
        let decodedHref = href;
        try {
          for (let pass = 0; pass < 2; pass += 1) {
            decodedHref = decodeURIComponent(decodedHref);
          }
        } catch {
          delete element.properties.href;
          addWarning(context, "A link was disabled because its target is malformed.");
          return;
        }
        if (decodedHref.startsWith("#")) {
          // srcdoc anchors belong to this document even when raw HTML tries
          // to send them to a popup or the host route.
          element.properties.target = "_self";
          const target = decodedHref.slice(1);
          if (ids.has(target)) {
            element.properties.href = `#${target}`;
            return;
          }
          const prefixedTarget = target.startsWith("user-content-")
            ? target
            : `user-content-${target}`;
          if (ids.has(prefixedTarget)) {
            element.properties.href = `#${prefixedTarget}`;
          } else {
            delete element.properties.href;
            addWarning(
              context,
              "A document anchor was disabled because its target does not exist.",
            );
          }
          return;
        }
        if (href && !href.startsWith("#") && /^(?:https?:|mailto:)/i.test(href)) {
          element.properties ??= {};
          element.properties.target = "_blank";
          element.properties.rel = ["noopener", "noreferrer"];
        }
      }
      if (element.tagName === "img") {
        // This is a final defence for raw HTML images. Markdown images are
        // already converted to readable text in the remark phase.
        const alt = typeof element.properties?.alt === "string" ? element.properties.alt : "image";
        const src = typeof element.properties?.src === "string" ? element.properties.src : "";
        const description = /^https?:\/\//iu.test(src)
          ? "Remote image blocked"
          : /^data:/iu.test(src)
            ? "Embedded image blocked"
            : /^file:/iu.test(src)
              ? "Local image blocked"
              : "Relative image unavailable — import does not include adjacent files";
        element.tagName = "span";
        element.properties = { className: ["markdown-image-placeholder"] };
        element.children = [{ type: "text", value: `[${description}: ${alt}]` }];
      }
    });
  };
}

function replaceMarkers(html: string, slots: MarkdownSlot[], marker: string): string {
  let output = html;
  for (const slot of slots) {
    const placeholder = `<span ${"data-puretools-slot"}="${slot.id}"></span>`;
    output = output.replace(marker, placeholder);
  }
  return output;
}

function overLimitHtml(source: string, limits: MarkdownLimits): string {
  return `<pre class="markdown-limit-error"><code>Markdown input exceeds the ${limits.maxInputBytes.toLocaleString()} byte limit.\n\n${escapeHtml(source)}</code></pre>`;
}

export async function parseMarkdown(
  source: string,
  mode: MarkdownMode = "enhanced",
  limits?: Partial<MarkdownLimits>,
): Promise<MarkdownParseResult> {
  const resolvedLimits = normaliseLimits(limits);
  const bytes = new TextEncoder().encode(source).byteLength;
  if (bytes > resolvedLimits.maxInputBytes) {
    return {
      html: overLimitHtml(source, resolvedLimits),
      slots: [],
      warnings: [`Markdown input exceeds ${resolvedLimits.maxInputBytes.toLocaleString()} bytes.`],
    };
  }

  let marker = makeMarker();
  while (source.includes(marker)) {
    marker = makeMarker();
  }

  const context: ParseContext = {
    mode,
    input: source,
    limits: resolvedLimits,
    slots: [],
    warnings: [],
    marker,
    mermaidCount: 0,
  };

  const processor = unified().use(remarkParse);
  if (mode === "enhanced") {
    processor
      .use(remarkGfm)
      .use(remarkMath, { singleDollarTextMath: true })
      .use(remarkFrontmatter, ["yaml"]);
  }
  processor
    .use(remarkMarkdownExtensions, context)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, markdownSanitizeSchema)
    .use(rehypeMarkdownSafety, context)
    .use(rehypeStringify);

  try {
    const file = await processor.process(source);
    return {
      html: replaceMarkers(String(file), context.slots, context.marker),
      slots: context.slots,
      warnings: context.warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Markdown parsing failed.";
    return {
      html: `<pre class="markdown-parse-error"><code>${escapeHtml(source)}</code></pre>`,
      slots: [],
      warnings: [message],
    };
  }
}

export { MARKDOWN_SLOT_ATTRIBUTE, MARKDOWN_SLOT_PREFIX } from "./types";
