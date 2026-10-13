/**
 * Input and output guards for the isolated Mermaid renderer.
 *
 * Mermaid accepts configuration in the diagram itself (directives and
 * frontmatter).  That is useful for documentation, but it also means that
 * passing untrusted text straight to Mermaid would let the document change
 * the renderer's security settings.  Keep these checks independent from the
 * renderer so they can be tested without a DOM.
 */

export const MERMAID_MAX_SOURCE_LENGTH = 20_000;

const EXTERNAL_RESOURCE_PATTERN =
  /(?:https?:|wss?:|data:|file:|javascript:|vbscript:|blob:|\/\/)/iu;
const MERMAID_DIRECTIVE_PATTERN = /%%\s*\{|^\s*%%\s*\{/mu;
const MERMAID_FRONTMATTER_PATTERN =
  /^\uFEFF?\s*---\s*\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)\s*(?:\r?\n|$)/u;
const MERMAID_RESOURCE_LINE_PATTERN = /^\s*(?:image|icon)\b|\b(?:img|icon)\s*:/imu;

export type MermaidSourceGuard = { ok: true } | { ok: false; error: string };

export function guardMermaidSource(source: string): MermaidSourceGuard {
  if (source.length > MERMAID_MAX_SOURCE_LENGTH) {
    return {
      ok: false,
      error: `Diagram source exceeds the ${MERMAID_MAX_SOURCE_LENGTH.toLocaleString()} character limit.`,
    };
  }

  if (MERMAID_DIRECTIVE_PATTERN.test(source)) {
    return {
      ok: false,
      error:
        "Mermaid directives are disabled so the document cannot change renderer security settings.",
    };
  }

  if (MERMAID_FRONTMATTER_PATTERN.test(source)) {
    return {
      ok: false,
      error:
        "Mermaid frontmatter is disabled so the document cannot change renderer configuration.",
    };
  }

  if (EXTERNAL_RESOURCE_PATTERN.test(source) || MERMAID_RESOURCE_LINE_PATTERN.test(source)) {
    return {
      ok: false,
      error:
        "External images, icons, URLs, and other content-driven resources are disabled in Mermaid diagrams.",
    };
  }

  return { ok: true };
}

export function isSafeSvgCss(value: string): boolean {
  if (
    /[\\]|@import|@font-face|expression\s*\(|image-set\s*\(|behavior\s*:|javascript:|vbscript:|data:/iu.test(
      value,
    )
  ) {
    return false;
  }
  for (const match of value.matchAll(/url\s*\(([^)]*)\)/giu)) {
    const target = match[1].trim().replace(/^["']|["']$/gu, "");
    if (!/^#[\p{L}\p{N}_:.-]+$/u.test(target)) {
      return false;
    }
  }
  return true;
}

export function isSafeSvgAttribute(name: string, value: string): boolean {
  const normalizedName = name.toLowerCase();
  if (normalizedName.startsWith("on")) {
    return false;
  }

  if (normalizedName === "style") {
    return isSafeSvgCss(value);
  }

  if (normalizedName === "href" || normalizedName === "xlink:href") {
    return value.trim().startsWith("#") && !EXTERNAL_RESOURCE_PATTERN.test(value);
  }

  return !EXTERNAL_RESOURCE_PATTERN.test(value) && isSafeSvgCss(value);
}

export function isSafeSvgElement(name: string): boolean {
  return !new Set(["base", "embed", "foreignobject", "iframe", "object", "script"]).has(
    name.toLowerCase(),
  );
}
