import { describe, expect, test } from "bun:test";
import { guardMermaidSource, isSafeSvgAttribute, isSafeSvgElement } from "./mermaid-safety";

describe("Mermaid safety guards", () => {
  test("accepts ordinary local diagram source", () => {
    expect(guardMermaidSource("flowchart LR\nA --> B").ok).toBe(true);
  });

  test("rejects source configuration and frontmatter", () => {
    expect(guardMermaidSource("%%{init: { securityLevel: 'loose' }}%%\nflowchart LR").ok).toBe(
      false,
    );
    expect(guardMermaidSource("---\nconfig: { securityLevel: loose }\n---\nflowchart LR").ok).toBe(
      false,
    );
  });

  test("rejects content-driven resources before Mermaid sees the source", () => {
    expect(guardMermaidSource("flowchart LR\nA --> https://example.com").ok).toBe(false);
    expect(guardMermaidSource('image logo "logo.png"').ok).toBe(false);
    expect(guardMermaidSource("flowchart LR\nA --> B\nicon B:fa-user").ok).toBe(false);
    expect(guardMermaidSource('flowchart LR\nA@{ img: "/probe.png" }').ok).toBe(false);
    expect(guardMermaidSource('flowchart LR\nA@{ icon: "custom:logo" }').ok).toBe(false);
  });

  test("allows internal SVG references but rejects external values", () => {
    expect(isSafeSvgAttribute("href", "#marker-1")).toBe(true);
    expect(isSafeSvgAttribute("xlink:href", "https://example.com/icon.svg")).toBe(false);
    expect(isSafeSvgAttribute("onclick", "alert(1)")).toBe(false);
    expect(isSafeSvgAttribute("style", "fill: red")).toBe(true);
    expect(isSafeSvgAttribute("style", 'fill: url("#marker-1")')).toBe(true);
    expect(isSafeSvgAttribute("fill", "url(/sentinel.svg)")).toBe(false);
    expect(isSafeSvgAttribute("style", "fill: u\\72l(/sentinel.svg)")).toBe(false);
    expect(isSafeSvgAttribute("style", "fill: url(https://example.com/x)")).toBe(false);
  });

  test("rejects active SVG elements", () => {
    expect(isSafeSvgElement("svg")).toBe(true);
    expect(isSafeSvgElement("foreignObject")).toBe(false);
    expect(isSafeSvgElement("script")).toBe(false);
  });
});
