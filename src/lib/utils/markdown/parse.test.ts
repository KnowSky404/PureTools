import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "./parse";

describe("parseMarkdown", () => {
  test("keeps CommonMark separate from enhanced extensions", async () => {
    const enhanced = await parseMarkdown(
      "| a | b |\n| :--- | ---: |\n| 1 | 2 |\n\n~~gone~~",
      "enhanced",
    );
    const commonmark = await parseMarkdown(
      "| a | b |\n| - | - |\n| 1 | 2 |\n\n~~gone~~",
      "commonmark",
    );
    expect(enhanced.html).toContain("<table>");
    expect(enhanced.html).toContain('align="left"');
    expect(enhanced.html).toContain('align="right"');
    expect(enhanced.html).toContain("<del>gone</del>");
    expect(commonmark.html.includes("<table>")).toBe(false);
    expect(commonmark.html.includes("<del>")).toBe(false);
  });

  test("extracts Mermaid and code as independent slots", async () => {
    const result = await parseMarkdown(
      "```mermaid\nflowchart LR\n A-->B\n```\n\n```js\nconst x = 1\n```",
      "enhanced",
    );
    expect(result.slots).toHaveLength(2);
    expect(result.slots[0]?.kind).toBe("mermaid");
    expect(result.slots[0]?.language).toBe("mermaid");
    expect(result.slots[0]?.line).toBe(1);
    expect(result.slots[1]?.kind).toBe("code");
    expect(result.slots[1]?.language).toBe("js");
    expect(result.slots[1]?.line).toBe(6);
    expect(result.html).toContain("data-puretools-slot");
  });

  test("keeps CommonMark code in a code slot while Mermaid stays ordinary code", async () => {
    const result = await parseMarkdown("```mermaid\nflowchart LR\nA-->B\n```", "commonmark");
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0]?.kind).toBe("code");
    expect(result.slots[0]?.source).toContain("flowchart LR");
    expect(result.html).toContain("data-puretools-slot");
  });

  test("handles nested lists, quotes, variable fences, backticks, breaks, and references", async () => {
    const source = [
      "> quote",
      "> - outer",
      ">   - inner",
      ">     ```text",
      ">     has ``` inside",
      ">     ```",
      ">   end  ",
      ">   hard",
      "",
      "[reference][id]",
      "",
      "[id]: https://example.com/docs",
    ].join("\n");
    const result = await parseMarkdown(source, "enhanced");
    expect(result.html).toContain("<blockquote>");
    expect(result.html).toContain("<ul>");
    expect(result.slots[0]?.source).toContain("has ``` inside");
    expect(result.html).toContain("<br>");
    expect(result.html).toContain('href="https://example.com/docs"');
  });

  test("keeps GFM task items and autolink literals", async () => {
    const result = await parseMarkdown("- [x] done\nwww.example.com", "enhanced");
    expect(result.html).toContain('type="checkbox"');
    expect(result.html).toContain('href="http://www.example.com"');
  });

  test("does not treat code or escaped dollars as math", async () => {
    const result = await parseMarkdown("`$x$` and \\$x\\$\n\n```\n$x$\n```\n\n$real$", "enhanced");
    expect(result.slots.filter((slot) => slot.kind === "math")).toHaveLength(1);
    expect(result.slots.find((slot) => slot.kind === "math")?.source).toBe("real");
    expect(result.html).toContain("$x$");
    const currency = await parseMarkdown("Price: $5.00 and $10.00", "enhanced");
    expect(currency.slots.filter((slot) => slot.kind === "math")).toHaveLength(0);
    expect(currency.html).toContain("$5.00");
    const proseCurrency = await parseMarkdown("Tickets cost $5 each and $10", "enhanced");
    expect(proseCurrency.slots.filter((slot) => slot.kind === "math")).toHaveLength(0);
    expect(proseCurrency.html).toContain("$5");
    const arithmetic = await parseMarkdown("$2 + 2$", "enhanced");
    expect(arithmetic.slots.filter((slot) => slot.kind === "math")).toHaveLength(1);
  });

  test("preserves unclosed inline math and follows display-fence EOF semantics", async () => {
    const inline = await parseMarkdown("Unclosed $x^2");
    expect(inline.slots).toHaveLength(0);
    expect(inline.html).toContain("$x^2");
    const display = await parseMarkdown("$$\nx^2");
    expect(display.slots[0]?.kind).toBe("math");
    expect(display.slots[0]?.source).toBe("x^2");
    expect(display.slots[0]?.display).toBe(true);
  });

  test("supports alerts, frontmatter, footnotes, and unique heading ids", async () => {
    const result = await parseMarkdown(
      "---\ntitle: hi\n---\n\n# Same\n# Same\n\n> [!NOTE]\n> hello\n\nA note[^1].\n\n[^1]: Footnote",
      "enhanced",
    );
    expect(result.html).toContain("markdown-frontmatter");
    expect(result.html).toContain("---\ntitle: hi\n---");
    expect(result.html).toContain("markdown-alert-note");
    expect(result.html).toContain('id="user-content-same"');
    expect(result.html).toContain('id="user-content-same-2"');
    expect(result.html).toContain("data-footnote-ref");
  });

  test("requires literal standalone alert markers without changing code or escapes", async () => {
    for (const source of [
      "> `[!NOTE]`\n> code",
      "> \\[!NOTE]\n> escaped",
      "> **[!NOTE]**\n> strong",
      "> [!NOTE] ordinary prose",
    ]) {
      const result = await parseMarkdown(source);
      expect(result.html).toContain("<blockquote>");
      expect(result.html.includes("markdown-alert")).toBe(false);
    }
    for (const label of ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]) {
      const result = await parseMarkdown(`> [!${label}]\n> Message`);
      expect(result.html).toContain(`markdown-alert-${label.toLowerCase()}`);
      expect(result.html).toContain(`<strong>${label}</strong>`);
      expect(result.html).toContain("Message");
    }
  });

  test("remaps safe document anchors to sanitizer-prefixed heading ids", async () => {
    const result = await parseMarkdown("# Target\n\n[go](#target) [missing](#missing)", "enhanced");
    expect(result.html).toContain('href="#user-content-target"');
    expect(result.html.includes('href="#missing"')).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("normalizes an encoded fragment before putting it in the srcdoc", async () => {
    const result = await parseMarkdown(
      "# Target\n\n[go](%23target) [twice](%2523target)",
      "enhanced",
    );
    expect(result.html).toContain('href="#user-content-target"');
    expect(result.html.includes('href="%23target"')).toBe(false);
    expect(result.html.includes('href="%2523target"')).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  test("keeps encoded Unicode and raw HTML anchors in the preview document", async () => {
    const result = await parseMarkdown(
      '# 日本語\n\n[go](#%E6%97%A5%E6%9C%AC%E8%AA%9E)\n\n<a href="#日本語" target="_top">raw</a>',
    );
    expect(result.html).toContain('href="#user-content-日本語"');
    expect(result.html).toContain('target="_self"');
    expect(result.html.includes('target="_top"')).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  test("recognizes frontmatter only at the document start", async () => {
    const result = await parseMarkdown("Text\n\n---\ntitle: later\n---", "enhanced");
    expect(result.html.includes("markdown-frontmatter")).toBe(false);
    expect(result.html).toContain("title: later");
  });

  test("preserves the complete BOM-prefixed frontmatter source", async () => {
    const result = await parseMarkdown("\uFEFF---\ntitle: hi\n---\n\n# Body", "enhanced");
    expect(result.html).toContain("\uFEFF---\ntitle: hi\n---");
    expect(result.html).toContain(">Body</h1>");
    const embeddedDelimiter = await parseMarkdown("---\nvalue: |\n---prefix\n...\n---\n\n# Body");
    expect(embeddedDelimiter.html).toContain("---\nvalue: |\n---prefix\n...\n---");
  });

  test("aligns source positions after a leading BOM", async () => {
    const currency = await parseMarkdown("\uFEFFPrice: $5.00 and $10.00");
    expect(currency.html).toContain("Price: $5.00 and $10.00");
    expect(currency.slots).toHaveLength(0);
    const alert = await parseMarkdown("\uFEFF> [!NOTE]\n> hello");
    expect(alert.html).toContain("markdown-alert-note");
    expect(alert.html).toContain("hello");
  });

  test("blocks active HTML, unsafe links, and all images while preserving text", async () => {
    const result = await parseMarkdown(
      '<script>alert(1)</script><img src="https://example.com/x.png" onerror="alert(1)">\n\n[javascript](java&#x73;cript:alert(1)) [protocol-relative](//evil.example) [safe](https://example.com)',
      "enhanced",
    );
    expect(result.html.includes("<script")).toBe(false);
    expect(result.html).toContain("onerror");
    expect(result.html.includes("<img")).toBe(false);
    expect(result.html.includes("javascript:")).toBe(false);
    expect(result.html).toContain('rel="noopener noreferrer"');
  });

  test("explains why Markdown image resources are unavailable", async () => {
    const result = await parseMarkdown(
      "![remote](https://example.com/a.png) ![relative](./a.png) ![data](data:image/png;base64,abc)",
      "enhanced",
    );
    expect(result.html).toContain("Remote image blocked");
    expect(result.html).toContain("Relative image unavailable");
    expect(result.html).toContain("Embedded image blocked");
    expect(result.html.includes("<img")).toBe(false);
  });

  test("makes forbidden raw HTML readable and disables relative or obfuscated links", async () => {
    const result = await parseMarkdown(
      '<script>alert(1)</script><div onclick="alert(1)">unsafe</div>\n\n[relative](/docs) [obfuscated](java%73cript%3Aalert(1))',
      "enhanced",
    );
    expect(result.html).toContain("&#x3C;script>");
    expect(result.html).toContain("unsafe");
    expect(result.html.includes('href="/docs"')).toBe(false);
    expect(result.html.includes("javascript")).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("counts Mermaid edges within a line and falls back to code at the limit", async () => {
    const result = await parseMarkdown(
      "```mermaid\nflowchart LR\nA-->B B-->C C-->D\n```",
      "enhanced",
      {
        maxDiagramEdges: 2,
      },
    );
    expect(result.slots[0]?.kind).toBe("code");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("counts Mermaid connector variants and fanout edges conservatively", async () => {
    const result = await parseMarkdown(
      "```mermaid\nflowchart LR\nA---B & C\nD===E\nF-.-G\nH~~~I\nJ--oK\nL--xM\n```",
      "enhanced",
      { maxDiagramEdges: 5 },
    );
    expect(result.slots[0]?.kind).toBe("code");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("reports limits and preserves oversized input", async () => {
    const result = await parseMarkdown("# hello", "enhanced", { maxInputBytes: 2 });
    expect(result.slots).toHaveLength(0);
    expect(result.warnings[0]).toContain("bytes");
    expect(result.html).toContain("# hello");
  });

  test("normalizes invalid limits instead of disabling safety", async () => {
    const result = await parseMarkdown("```mermaid\nflowchart LR\nA-->B\n```", "enhanced", {
      maxInputBytes: Number.NaN,
      maxDiagrams: -1,
      maxDiagramEdges: Number.POSITIVE_INFINITY,
    });
    expect(result.slots[0]?.kind).toBe("code");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("handles empty and Unicode documents", async () => {
    const empty = await parseMarkdown("", "enhanced");
    const unicode = await parseMarkdown("# 日本語 🧪\n\nこんにちは", "enhanced");
    expect(empty.html).toBe("");
    expect(empty.slots).toHaveLength(0);
    expect(unicode.html).toContain("日本語");
    expect(unicode.html).toContain("こんにちは");
  });

  test("gives repeated Mermaid sources unique slot ids", async () => {
    const result = await parseMarkdown(
      "```mermaid\nflowchart LR\nA-->B\n```\n```mermaid\nflowchart LR\nA-->B\n```",
      "enhanced",
    );
    expect(JSON.stringify(result.slots.map((slot) => slot.id))).toBe('["pt-slot-0","pt-slot-1"]');
  });
});
