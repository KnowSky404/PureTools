import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const previewSelector = 'iframe[title="Markdown preview"]';
const externalImage = "https://assets.example.invalid/remote.png";

function sourceInput(page: Page) {
  return page.getByRole("textbox", { name: /markdown source/i });
}

function previewFrame(page: Page) {
  return page.frameLocator(previewSelector);
}

async function settlePreview(page: Page): Promise<void> {
  await page.waitForTimeout(650);
}

async function openMarkdownPreview(page: Page): Promise<void> {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/markdown-preview");
  await expect(sourceInput(page)).toBeVisible();
  await expect(page.locator(previewSelector)).toBeVisible();
  // SSR exposes the controls before Svelte attaches event handlers. The root
  // layout's client-only color-scheme effect is the hydration marker.
  await expect
    .poll(() => page.locator("html").evaluate((html) => html.style.colorScheme))
    .toMatch(/^(light|dark)$/);
  // The initial empty srcdoc is SSR content. The rendered default heading
  // proves the Markdown route mounted and attached its input handlers.
  await expect(
    previewFrame(page).getByRole("heading", { name: "Markdown Previewer", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("Markdown Previewer", () => {
  test("is reachable from global search and exposes the local preview controls", async ({
    page,
  }) => {
    await page.goto("/");
    // Wait for the Svelte layout to hydrate before opening the client-side search panel.
    await expect
      .poll(() => page.locator("html").evaluate((html) => html.style.colorScheme))
      .toMatch(/^(light|dark)$/);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByPlaceholder("Search tools...").fill("mermaid");
    const searchResult = page
      .locator('a[href="/markdown-preview"]')
      .filter({ hasText: /Markdown Previewer/i })
      .first();
    await expect(searchResult).toBeVisible();
    await searchResult.click();

    await expect(page).toHaveURL(/\/markdown-preview$/);
    await expect(sourceInput(page)).toBeVisible();
    await expect(page.getByRole("group", { name: /compatibility mode/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /example/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^clear$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /copy source/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /download/i })).toBeVisible();
  });

  test("renders the required Mermaid diagram families independently as SVG", async ({ page }) => {
    await openMarkdownPreview(page);

    const markdown = [
      "# Diagram gallery",
      "",
      "```mermaid",
      "flowchart TD",
      "  A[Start] --> B[Finish]",
      "```",
      "",
      "```mermaid",
      "sequenceDiagram",
      "  Alice->>Bob: Hello",
      "```",
      "",
      "```mermaid",
      "classDiagram",
      "  class Animal",
      "  Animal : +String name",
      "```",
      "",
      "```mermaid",
      "stateDiagram-v2",
      "  [*] --> Still",
      "  Still --> [*]",
      "```",
      "",
      "```mermaid",
      "erDiagram",
      "  CUSTOMER ||--o{ ORDER : places",
      "```",
      "",
      "```mermaid",
      "gantt",
      "  title Project",
      "  dateFormat YYYY-MM-DD",
      "  section Work",
      "  Task :done, task, 2024-01-01, 1d",
      "```",
      "",
      "```mermaid",
      "pie title Pets",
      '  "Dogs" : 40',
      '  "Cats" : 60',
      "```",
      "",
      "```mermaid",
      "journey",
      "  title Release",
      "  section Build",
      "    Compile: 5: Dev",
      "```",
      "",
      "```mermaid",
      "gitGraph",
      "  commit",
      "  commit",
      "```",
      "",
      "```mermaid",
      "mindmap",
      "  root((Project))",
      "    Docs",
      "    Tests",
      "```",
      "",
      "```mermaid",
      "timeline",
      "  title History",
      "  2020 : Started",
      "```",
    ].join("\n");

    await sourceInput(page).fill(markdown);
    await settlePreview(page);

    const frame = previewFrame(page);
    await expect(frame.locator("svg")).toHaveCount(11, { timeout: 20_000 });
    await expect(frame.locator(".mermaid-error")).toHaveCount(0);
    const diagrams = frame.locator("figure.diagram");
    await expect(diagrams).toHaveCount(11);
    const knownLabels: Array<string | null> = [
      "Start",
      "Hello",
      "Animal",
      "Still",
      "CUSTOMER",
      "Task",
      "Dogs",
      "Compile",
      null,
      "Project",
      "Started",
    ];
    for (let index = 0; index < 11; index += 1) {
      const svg = diagrams.nth(index).locator("svg");
      await expect(svg).toHaveCount(1);
      const svgText = (await svg.locator("text, tspan").allTextContents()).join(" ").trim();
      expect(svgText).not.toBe("");
      const label = knownLabels[index];
      if (label) {
        expect(svgText).toContain(label);
      }
      const dimensions = await svg.evaluate((node) => {
        const box = (node as SVGGraphicsElement).getBBox();
        return { width: box.width, height: box.height };
      });
      expect(dimensions.width).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThan(0);
    }
    await expect(frame.getByText("Diagram gallery", { exact: true })).toBeVisible();
  });

  test("keeps repeated Mermaid diagrams isolated with unique SVG identifiers", async ({ page }) => {
    await openMarkdownPreview(page);
    await sourceInput(page).fill(
      [
        "```mermaid",
        "flowchart TD",
        "  A[Same] --> B[Chart]",
        "```",
        "",
        "```mermaid",
        "flowchart TD",
        "  A[Same] --> B[Chart]",
        "```",
      ].join("\n"),
    );
    await settlePreview(page);

    const frame = previewFrame(page);
    await expect(frame.locator("svg")).toHaveCount(2, { timeout: 20_000 });
    const identifiers = await frame
      .locator("[id]")
      .evaluateAll((elements) => elements.map((element) => element.id));
    expect(identifiers.length).toBeGreaterThan(0);
    expect(new Set(identifiers).size).toBe(identifiers.length);

    const fragmentReferences = await frame
      .locator("[marker-start], [marker-mid], [marker-end], [href^='#'], [xlink\\:href^='#']")
      .evaluateAll((elements) =>
        elements.flatMap((element) =>
          ["marker-start", "marker-mid", "marker-end", "href", "xlink:href"]
            .map((attribute) => element.getAttribute(attribute))
            .filter((value): value is string => value?.startsWith("#") === true)
            .map((value) => value.slice(1)),
        ),
      );
    expect(fragmentReferences.every((reference) => identifiers.includes(reference))).toBe(true);
  });

  test("keeps a broken diagram local and preserves the other diagram and source", async ({
    page,
  }) => {
    await openMarkdownPreview(page);
    await sourceInput(page).fill(
      [
        "```mermaid",
        "flowchart TD",
        "  A --> B",
        "```",
        "",
        "```mermaid",
        "this is not a valid diagram",
        "```",
        "",
        "after the error",
      ].join("\n"),
    );
    await settlePreview(page);

    const frame = previewFrame(page);
    await expect(frame.locator("svg")).toHaveCount(1, { timeout: 20_000 });
    await expect(frame.getByText("after the error", { exact: true })).toBeVisible();
    await expect(frame.locator(".mermaid-error")).toContainText(
      /not a valid diagram|mermaid.*error|diagram.*failed/i,
    );
    await expect(sourceInput(page)).toHaveValue(/this is not a valid diagram/);

    const details = frame.locator("details").filter({ hasText: /not a valid diagram/ });
    await expect(details).toBeVisible();
    await details.locator("summary").click();
    await expect(details.locator("code")).toContainText("this is not a valid diagram");
  });

  test("separates Enhanced extensions from CommonMark and renders math locally", async ({
    page,
  }) => {
    await openMarkdownPreview(page);
    const markdown = [
      "- [x] done",
      "- [ ] todo",
      "",
      "| Name | Value |",
      "| :--- | ---: |",
      "| One | 1 |",
      "",
      "~~removed~~ and https://example.com",
      "",
      "Inline $x^2$ and block:",
      "",
      "$$",
      "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}",
      "$$",
      "",
      "> [!NOTE]",
      "> A useful note",
      "",
      "[^1]: Footnote text",
      "",
      "Reference[^1]",
    ].join("\n");

    await sourceInput(page).fill(markdown);
    await settlePreview(page);
    const frame = previewFrame(page);
    await expect(frame.locator("table")).toBeVisible();
    await expect(frame.locator('input[type="checkbox"]')).toHaveCount(2);
    await expect(frame.getByText("removed", { exact: true })).toHaveCSS(
      "text-decoration-line",
      /line-through/,
    );
    await expect(frame.locator(".katex")).toHaveCount(2, { timeout: 15_000 });
    await expect(frame.getByText("A useful note", { exact: true })).toBeVisible();
    await expect(frame.getByText(/Footnote text/)).toBeVisible();

    await page
      .getByRole("group", { name: /compatibility mode/i })
      .getByRole("button", { name: "CommonMark" })
      .click();
    await settlePreview(page);
    await expect(frame.locator("table")).toHaveCount(0);
    await expect(frame.locator(".katex")).toHaveCount(0);
    await expect(frame.locator("blockquote").getByText(/\[!NOTE\]/)).toBeVisible();
    await expect(frame.getByText(/~~removed~~/)).toBeVisible();
  });

  test("preserves currency and invalid math locally while rendering safe static HTML", async ({
    page,
  }) => {
    await openMarkdownPreview(page);
    await sourceInput(page).fill(
      [
        "Price: $5.00",
        "",
        "Escaped \\$x\\$.",
        "",
        "Broken formula: $\\notARealCommand$",
        "",
        "<details><summary>Static details</summary><table><tr><td>Safe table</td></tr></table></details>",
      ].join("\n"),
    );
    await settlePreview(page);

    const frame = previewFrame(page);
    await expect(frame.getByText(/Price: \$5\.00/)).toBeVisible();
    await expect(frame.getByText(/Escaped \$x\$/)).toBeVisible();
    await expect(frame.locator(".markdown-error")).toContainText("notARealCommand");
    await expect(frame.locator("details")).toBeVisible();
    await frame.locator("details summary").click();
    await expect(frame.locator("table")).toBeVisible();
    await expect(
      frame.locator("script, iframe, object, embed, form, link, meta[http-equiv=refresh]"),
    ).toHaveCount(0);
  });

  test("supports import, copy, download, example, refresh, and clear without losing source", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as Window & { __copied?: string }).__copied = value;
          },
        },
      });
    });
    await openMarkdownPreview(page);

    const imported = "# Imported\n\nThis came from a file.\n";
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(imported),
    });
    await expect(sourceInput(page)).toHaveValue(imported);
    await expect(previewFrame(page).getByText("Imported", { exact: true })).toBeVisible();

    await fileInput.setInputFiles({
      name: "invalid.md",
      mimeType: "text/markdown",
      buffer: Buffer.from([0xc3, 0x28]),
    });
    await expect(page.getByRole("alert")).toContainText(/valid UTF-8/i);
    await expect(sourceInput(page)).toHaveValue(imported);

    await fileInput.setInputFiles({
      name: "oversized.md",
      mimeType: "text/markdown",
      buffer: Buffer.alloc(512 * 1024 + 1, 0x61),
    });
    await expect(page.getByRole("alert")).toContainText(/larger than.*KB limit/i);
    await expect(sourceInput(page)).toHaveValue(imported);

    await page.getByRole("button", { name: /copy source/i }).click();
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __copied?: string }).__copied))
      .toBe(imported);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /download/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.md$/i);
    const downloadedPath = await download.path();
    if (!downloadedPath) {
      throw new Error("The Markdown download did not expose a readable path.");
    }
    await expect.poll(() => readFile(downloadedPath, "utf8")).toBe(imported);

    await page.getByRole("button", { name: /example/i }).click();
    await expect(sourceInput(page)).not.toHaveValue(imported);
    await expect(page.getByText(/preview up to date|rendered|ready/i).first()).toBeVisible();

    await page.getByRole("button", { name: /^clear$/i }).click();
    await expect(sourceInput(page)).toHaveValue("");
    await expect(previewFrame(page).getByText(/empty|start writing|paste markdown/i)).toBeVisible();
    await page.reload();
    await expect(sourceInput(page)).toHaveValue(/# Markdown Previewer/);
    const persistedValues = await page.evaluate(() => [
      ...Object.values(localStorage),
      ...Object.values(sessionStorage),
    ]);
    expect(persistedValues.join("\n")).not.toContain(imported);
  });

  test("does not let stale renders win races, including clear, theme changes, and composition", async ({
    page,
  }) => {
    await openMarkdownPreview(page);
    await sourceInput(page).fill("# stale heading");
    await sourceInput(page).fill("# current heading");
    await page.getByRole("button", { name: /^clear$/i }).click();
    await settlePreview(page);
    await expect(previewFrame(page).getByText("stale heading", { exact: true })).toHaveCount(0);
    await expect(previewFrame(page).getByText("current heading", { exact: true })).toHaveCount(0);

    const source = sourceInput(page);
    await source.dispatchEvent("compositionstart");
    await source.fill("# composing");
    await expect(previewFrame(page).getByText("composing", { exact: true })).toHaveCount(0);
    await source.dispatchEvent("compositionend");
    await settlePreview(page);
    await expect(previewFrame(page).getByText("composing", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await source.fill("```mermaid\nflowchart TD\n A-->B\n```");
    const themeButton = page.locator('button[title^="Theme:"]');
    await expect(themeButton).toHaveAttribute("title", /Theme: System/i);
    await themeButton.click();
    await themeButton.click();
    await expect(themeButton).toHaveAttribute("title", /Theme: Dark/i);
    await settlePreview(page);
    await expect(previewFrame(page).locator("svg")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(previewFrame(page).locator("html")).toHaveClass("dark");
    await expect(previewFrame(page).locator("svg style")).toContainText(/#ccc/i);

    await themeButton.click();
    await expect(themeButton).toHaveAttribute("title", /Theme: System/i);
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(previewFrame(page).locator("html")).toHaveClass("light");
  });

  test("keeps the final iframe and Mermaid generation resource-safe", async ({ page, baseURL }) => {
    const applicationOrigin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
    const remoteRequests: string[] = [];
    const sentinelRequests: string[] = [];
    await page.on("request", (request) => {
      const url = request.url();
      if (/^https?:\/\//i.test(url) && new URL(url).origin !== applicationOrigin) {
        remoteRequests.push(url);
      }
      if (url.includes("e2e-sentinel")) {
        sentinelRequests.push(url);
      }
    });
    await openMarkdownPreview(page);
    remoteRequests.length = 0;
    sentinelRequests.length = 0;
    await sourceInput(page).fill(
      [
        '<script>alert("xss")</script>',
        '<img src="https://assets.example.invalid/remote.png" alt="remote image" onerror="alert(1)">',
        '<img src="/e2e-sentinel/relative.png" alt="relative image">',
        '<iframe src="https://assets.example.invalid/frame"></iframe>',
        '<base href="https://assets.example.invalid/">',
        `<style>@import url("http://127.0.0.1:4173/e2e-sentinel/style.css"); body { background: url("${externalImage}"); }</style>`,
        `<svg onload="alert(1)" href="${externalImage}"><circle /></svg>`,
        "$\\includegraphics{https://assets.example.invalid/math.png}$",
        "$\\htmlStyle{background:url(/e2e-sentinel/math.png)}{x}$",
        "```mermaid",
        "flowchart TD",
        "  A --> B",
        "```",
        "",
        "```mermaid",
        "%%{init: {'securityLevel':'loose'}}%%",
        "flowchart TD",
        "  C --> D",
        "```",
      ].join("\n"),
    );
    await settlePreview(page);

    expect(remoteRequests).toEqual([]);
    expect(sentinelRequests).toEqual([]);
    const frame = previewFrame(page);
    await expect(
      frame.locator("script, iframe, object, embed, form, link, meta[http-equiv=refresh]"),
    ).toHaveCount(0);
    await expect(frame.locator('base[href="about:srcdoc"]')).toHaveCount(1);
    await expect(frame.locator('base[href*="assets.example.invalid"]')).toHaveCount(0);
    await expect(frame.locator("[onerror], [onclick], [onload], [onmouseover]")).toHaveCount(0);
    await expect(frame.locator("img")).toHaveCount(0);
    await expect(frame.getByText(/remote image|relative image|Image unavailable/i)).toBeVisible();
    await expect(frame.locator(".mermaid-error")).toContainText(/security|disabled|directive/i);

    const iframe = page.locator(previewSelector);
    const sandbox = await iframe.getAttribute("sandbox");
    expect(sandbox).toBeTruthy();
    expect(sandbox).not.toMatch(/allow-scripts/);
    expect(sandbox).not.toMatch(
      /allow-scripts.*allow-same-origin|allow-same-origin.*allow-scripts/,
    );
    const srcdoc = await iframe.getAttribute("srcdoc");
    expect(srcdoc).toMatch(/content-security-policy/i);
    expect(srcdoc).not.toMatch(/connect-src\s+[^;]*\*/i);
    expect(srcdoc).not.toMatch(/script-src\s+[^;]*unsafe-inline/i);
  });

  test("does not load Mermaid or KaTeX for plain Markdown and enforces resource limits", async ({
    page,
  }) => {
    const heavyDependencyRequests: string[] = [];
    await page.on("request", (request) => {
      if (/mermaid|katex/i.test(request.url())) {
        heavyDependencyRequests.push(request.url());
      }
    });
    await openMarkdownPreview(page);
    await sourceInput(page).fill("# Plain Markdown\n\nNo diagrams or formulas here.");
    await settlePreview(page);
    expect(heavyDependencyRequests).toEqual([]);

    const oversized = `# Large document\n\n${"content ".repeat(40_000)}`;
    await sourceInput(page).fill(oversized);
    await settlePreview(page);
    await expect(
      page.getByText(/large document|input.*limit|document.*too large|size limit/i),
    ).toBeVisible();
    await expect(sourceInput(page)).toHaveValue(oversized);
    const refresh = page.getByRole("button", { name: /refresh preview/i });
    await expect(refresh).toBeVisible();
  });

  test("keeps Mermaid source and UTF-8 input caps readable", async ({ page }) => {
    await openMarkdownPreview(page);
    await expect(page.getByText(/preview up to date/i)).toBeVisible({ timeout: 15_000 });
    const oversizedDiagram = [
      "```mermaid",
      "flowchart TD",
      `%% ${"x".repeat(20_500)}`,
      "A-->B",
      "```",
    ].join("\n");
    await sourceInput(page).fill(oversizedDiagram);
    await settlePreview(page);
    await expect(page.getByText(/A Mermaid diagram exceeds 20,000 characters/i)).toBeVisible();
    await expect(previewFrame(page).locator("svg")).toHaveCount(0);
    await expect(previewFrame(page).locator("pre code")).toContainText("A-->B");
    await expect(sourceInput(page)).toHaveValue(oversizedDiagram);

    const hardLimit = `# Too large\n\n${"x".repeat(512 * 1024)}`;
    await sourceInput(page).fill(hardLimit);
    await expect(page.getByText(/input is too large/i)).toBeVisible();
    await expect(sourceInput(page)).toHaveValue(hardLimit);
    await expect(page.getByRole("button", { name: /refresh preview/i })).toBeEnabled();
  });

  test("keeps links, footnotes, HTML subsets, and narrow layouts usable", async ({ page }) => {
    await openMarkdownPreview(page);
    await sourceInput(page).fill(
      [
        "\uFEFF---",
        "title: Links",
        "---",
        "",
        "# Target",
        "",
        "[Encoded fragment](%23target)",
        "[Double encoded fragment](%2523target)",
        "",
        "[Example](https://example.com)",
        "",
        "A footnote[^1].",
        "",
        "[^1]: Footnote destination",
        "",
        "<details><summary>More</summary><p>Details body</p></details>",
      ].join("\n"),
    );
    await settlePreview(page);
    const frame = previewFrame(page);
    const externalLink = frame.locator('a[href^="https://example.com"]');
    await expect(externalLink).toHaveAttribute("target", "_blank");
    await expect(externalLink).toHaveAttribute("rel", /noopener/);
    await expect(externalLink).toHaveAttribute("rel", /noreferrer/);
    const hostUrl = page.url();
    const encodedFragment = frame.getByRole("link", { name: "Encoded fragment", exact: true });
    await expect(encodedFragment).toHaveAttribute("href", "#user-content-target");
    await expect(encodedFragment).toHaveAttribute("target", "_self");
    await encodedFragment.click();
    expect(page.url()).toBe(hostUrl);
    await expect(frame.getByRole("heading", { name: "Target", exact: true })).toBeVisible();
    const doubleEncodedFragment = frame.getByRole("link", {
      name: "Double encoded fragment",
      exact: true,
    });
    await expect(doubleEncodedFragment).toHaveAttribute("href", "#user-content-target");
    await doubleEncodedFragment.click();
    expect(page.url()).toBe(hostUrl);
    await expect(frame.getByRole("heading", { name: "Target", exact: true })).toBeVisible();
    const frontmatter = frame.locator("details").filter({ hasText: "Frontmatter" });
    await frontmatter.locator("summary").click();
    await expect(frontmatter.locator("code")).toHaveText("\uFEFF---\ntitle: Links\n---");
    const externalPopup = page.context().waitForEvent("page", { timeout: 5_000 });
    await externalLink.click();
    const popup = await externalPopup;
    expect(page.url()).toBe(hostUrl);
    await popup.close();
    const footnoteLink = frame.locator("a[data-footnote-ref]").first();
    await expect(footnoteLink).toBeVisible();
    await footnoteLink.click();
    expect(page.url()).toBe(hostUrl);
    const staticDetails = frame.locator("details").filter({ hasText: "Details body" });
    await expect(staticDetails).toBeVisible();
    await staticDetails.locator("summary").click();
    await expect(frame.getByText("Details body", { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const bodyScrollWidthType = await page
      .locator("body")
      .evaluate((body) => typeof body.scrollWidth);
    expect(bodyScrollWidthType).toBe("number");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(sourceInput(page)).toBeVisible();
    const mobileView = page.getByRole("group", { name: "Mobile view" });
    await expect(mobileView).toBeVisible();
    await mobileView.getByRole("button", { name: "Edit" }).click();
    await expect(sourceInput(page)).toBeVisible();
    await mobileView.getByRole("button", { name: "Preview" }).click();
    await expect(page.locator(previewSelector)).toBeVisible();
  });

  test("shows an isolated dependency failure and recovers through retry", async ({ page }) => {
    let blockMermaid = true;
    // Fail only the isolated Mermaid renderer frame; application and document
    // requests continue normally so this cannot mask a global network abort.
    await page.route(/mermaid-frame/i, async (route) => {
      if (blockMermaid) {
        await route.abort("failed");
      } else {
        await route.continue();
      }
    });
    await openMarkdownPreview(page);
    await sourceInput(page).fill("```mermaid\nflowchart TD\n A-->B\n```");
    await settlePreview(page);
    await expect(
      page.getByText(/Mermaid.*(failed|unavailable|timed out)|diagram.*dependency/i),
    ).toBeVisible({ timeout: 25_000 });
    await expect(sourceInput(page)).toHaveValue(/flowchart TD/);

    blockMermaid = false;
    await page.getByRole("button", { name: /retry|refresh preview/i }).click();
    await expect(previewFrame(page).locator("svg")).toBeVisible({ timeout: 20_000 });
  });
});
