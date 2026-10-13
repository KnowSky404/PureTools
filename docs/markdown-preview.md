# Markdown Previewer

PureTools' Markdown Previewer is a local, browser-only tool at [`/markdown-preview`](../src/routes/markdown-preview/+page.svelte). The source stays in the current page's memory. The tool does not upload Markdown, call a remote Markdown/Mermaid service, read adjacent files, or save input to browser storage.

## Compatibility modes

| Mode | Parser features | Deliberately excluded |
| --- | --- | --- |
| Enhanced (default) | CommonMark, GFM, footnotes, `$...$` and `$$...$$` math, Mermaid fences, GitHub-style alerts, YAML frontmatter display, and the safe static HTML subset | MDX/JSX, executable expressions, arbitrary plugins, remote resources, and source-controlled Mermaid configuration |
| CommonMark | CommonMark parsing and the same safety/resource policy | GFM, math, Mermaid rendering, frontmatter handling, alerts, and other semantic extensions |

CommonMark mode leaves a `mermaid` fence as an ordinary code block. Both modes sanitize raw HTML and apply the same link, image, embedding, script, CSS, and resource restrictions. The preview is a compatibility aid; it does not promise byte-for-byte output from GitHub, CommonMark implementations, or any other Markdown platform.

Both modes add deterministic heading IDs for local navigation; this changes presentation attributes, not how Markdown syntax is parsed. Frontmatter disclosure shows the original metadata including its delimiters.

## Rendering pipeline and versions

The route loads the Markdown pipeline only when it is opened. Mermaid and the heavier rendering code are dynamically loaded after the parser identifies an Enhanced Mermaid fence. The default example contains no Mermaid or math, so visiting the route does not automatically initialize those renderers.

The package versions currently installed for this implementation are:

| Role | Package | Version |
| --- | --- | --- |
| Markdown AST | `unified`, `remark-parse` | 11.0.5, 11.0.0 |
| GFM, math, frontmatter | `remark-gfm`, `remark-math`, `remark-frontmatter` | 4.0.1, 6.0.0, 5.0.0 |
| AST to HTML | `remark-rehype`, `rehype-raw`, `rehype-sanitize`, `rehype-stringify` | 11.1.2, 7.0.0, 6.0.0, 10.0.1 |
| Code highlighting | `highlight.js` | 11.12.0 |
| Formula rendering | `katex` | 0.19.0 |
| Diagram rendering and SVG filtering | `mermaid`, `dompurify` | 12.1.0, 3.4.17 |

The pipeline parses Markdown into mdast, extracts Mermaid/math/code nodes, converts the remaining tree to hast, sanitizes that tree, and only then inserts trusted application-generated slots. Mermaid SVG and KaTeX HTML are treated as separate generated outputs and are filtered before they are inserted into the final preview document. Mermaid 12.1.0 carries `marked` as an internal transitive dependency; PureTools still has one application Markdown pipeline based on unified/remark/rehype and does not expose `marked` as a second parser.

The renderer APIs used here are documented by the projects themselves: [Mermaid browser usage and supported runtimes](https://github.com/mermaid-js/mermaid/blob/develop/docs/config/usage.md#supported-browsers-and-runtimes), [Mermaid `render()`](https://github.com/mermaid-js/mermaid/blob/develop/docs/config/setup/mermaid/interfaces/Mermaid.md), [KaTeX browser support](https://github.com/KaTeX/KaTeX/blob/main/docs/browser.md), and [KaTeX API usage](https://github.com/KaTeX/KaTeX/blob/main/README.md#api). Mermaid v12 published bundles target ES2024 and document Safari 17.4+ as the support target; KaTeX documents support for major browsers. These are upstream compatibility statements, not a claim that PureTools has verified every browser.

### Mermaid coverage

Enhanced mode recognizes a `mermaid` fenced code node from the parsed Markdown tree. It uses Mermaid's normal browser package entry, not the tiny build, and calls the browser `initialize`/`render` API with an application-owned strict configuration. The first acceptance scope covers these documented diagram families:

| Diagram family | Status in this tool |
| --- | --- |
| `flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`, `erDiagram`, `gantt`, `pie`, `journey`, `mindmap`, `timeline` | Normal Mermaid syntax; rendered when the installed Mermaid parser accepts the source |
| `gitGraph` | Built into the package, but Mermaid's package README labels it experimental; errors remain local and the source is retained |
| Requirement, C4, quadrant, XY chart, Sankey, packet, block, architecture, event modeling, radar, Venn, tree view, use case, Kanban, and Ishikawa | Exposed by the current normal Mermaid package/docs surface; not individually promised by this page until a matching browser acceptance sample passes |
| `wardley-beta`, `cynefin`, `railroad`, ZenUML, and externally registered diagrams | Beta, experimental, or add-on surface; no external diagram registration is performed by PureTools, so these may remain source code with an explanation |

The package configuration types also expose layout-related options. The normal package includes ELK; the tiny build omits ELK and falls back to Dagre. PureTools does not silently switch to that reduced build. Mermaid source directives, frontmatter, theme CSS, callbacks, external URLs, image/icon declarations, and security overrides are rejected before Mermaid receives the source. A diagram error affects only that diagram, keeps its source in a native `details` block, and does not discard the rest of the document. Generated SVG IDs are namespaced per render.

The normal browser package does not make every Mermaid feature a compatibility promise. Rich HTML labels are disabled (`htmlLabels: false`) and generated `foreignObject` elements are removed. Diagram-internal math, icon/image packs, content-driven images, custom layouts, callbacks, and plugin or external-diagram registration are restricted or left as source. Independent KaTeX math in the Markdown pipeline remains supported. This keeps Mermaid's full normal browser build while rejecting feature paths that would require extra resources, richer DOM capabilities, or user-controlled extensions.

This table records the current package/docs boundary rather than claiming that every Mermaid grammar is supported by every browser or every future Mermaid release. Mermaid's own documentation and the installed package remain the source of truth when a new diagram family is added.

### Math and code

Enhanced mode renders inline `$...$` and block `$$...$$` expressions with KaTeX. It uses bounded, application-controlled rendering with trust disabled and does not provide a complete LaTeX document or arbitrary package execution environment. Invalid expressions remain visible as local source/error text. Escaped dollars, currency-like text, inline code, and fenced code are kept out of the math slot pipeline. `\(...\)` and `\[...\]` are not part of the compatibility promise.

Code blocks are highlighted locally with the fixed, on-demand registrations for JavaScript/JSX, TypeScript/TSX, JSON, XML/HTML, CSS, Bash/sh, Python, SQL, and YAML/YML. Unknown languages remain readable plain code. Highlighting never rescans the final HTML and does not change the source text.

## Safety and resource policy

Unclosed inline dollar delimiters remain literal. Display-math fences follow remark-math's fence behavior: end of file can terminate a block without a closing fence. Currency-like numeric prose stays literal; numeric-only `$5$` is also treated as currency. Macros are fresh for each expression, so definitions do not persist into other expressions or documents.

The final preview is an iframe with a restrictive sandbox that allows `allow-same-origin` for the application's bundled KaTeX font URLs, but never allows scripts. It also permits only the narrowly required popup behavior. The application controls copy/download actions outside the iframe. The Mermaid generation frame is a separate `allow-scripts`-only iframe with no `allow-same-origin`, and a restrictive CSP; it has no network connections, forms, frames, objects, or external images. Production builds use a full self-contained IIFE worker asset produced by Vite with `inlineDynamicImports`; the generation CSP pins `script-src` to that exact asset. Development uses the ESM worker asset with the server CORS policy restricted to the sandbox's opaque `null` origin. Mermaid output is sanitized before it reaches the final iframe.

The preview policy has these boundaries:

- Raw HTML is limited to the sanitized static subset needed for documentation, such as `table`, `details`, `summary`, `sup`, `sub`, `kbd`, and `br`.
- `script`, event attributes, `iframe`, `object`, `embed`, forms, `meta` refresh, `base`, arbitrary style, and active SVG content are removed.
- Generated SVG styles may use internal fragment references such as `url(#marker)`, while external CSS URLs, imports, `data:`, `javascript:`, and similar resource escapes are rejected. Mermaid's default HTML labels remain off and `foreignObject` is removed.
- Markdown and raw HTML images become an unavailable-image placeholder. Remote, relative, `data:`, and local-file image sources are never fetched; the user is told that this preview has no adjacent-file or remote-image context.
- Hash anchors remain available only when their target exists in the current document. Absolute `http:`, `https:`, and `mailto:` links are allowed with `noopener noreferrer` and open only after user activation. Relative links, protocol-relative links, dangerous protocols, and obfuscated `javascript:` forms are disabled.
- Forbidden raw HTML such as `script`, `style`, event-bearing markup, and SVG is escaped back into readable source text at the Markdown AST boundary. The subsequent sanitizer is a second defense and removes any active elements that survive parsing.
- Frontmatter is display-only source text. It is not executed, injected into application configuration, or used to make a request. Mermaid configuration syntax is handled separately and cannot lower the renderer's security settings.
- MDX, JSX, Svelte/Vue components, JavaScript expressions, code cells, automatic webpage fetching, and file-system scanning are not executed or supported.

The current limits are explicit and errors preserve source instead of silently truncating it: the page and parser accept at most 512 KiB (524,288 UTF-8 bytes), automatically render while the document is at most 64 KiB (65,536 bytes), and switch larger documents to manual refresh. The reusable parser policy allows 20 Mermaid diagrams, 20,000 characters per diagram, 500 counted edges per diagram, 20,000 characters per math expression, and 256 KiB per code block. The isolated Mermaid engine applies the same 20,000-character and 500-edge ceilings. These limits can be tightened by the caller and should be treated as product policy rather than a promise that every browser can render the maximum size smoothly.

Input, timers, asynchronous rendering, Mermaid queues, caches, and object URLs are scoped to the page and invalidated when the page changes or is destroyed. There is no localStorage, sessionStorage, IndexedDB, URL, history, telemetry, or error-reporting copy of the Markdown source.

Mermaid runs in an isolated browser document, not a DOM-free Web Worker. Its 15-second watchdog can report delayed asynchronous work and retire that frame before another job, but cannot preempt synchronous computation on the browser thread. Large documents require manual refresh, and resource caps reduce the work admitted to each diagram.

Copy uses the browser Clipboard API. It requires the browser's secure-context/permission rules (normally HTTPS); when access is unavailable, the toolbar reports that Clipboard API access failed and instructs the user to select and copy the source manually.

## Deliberate non-goals

The first release does not provide multi-document workspaces, cloud saving, collaboration, rich-text editing, Markdown fetched from a URL, HTML/PDF/Word export, arbitrary HTML, remote images, a plugin marketplace, or a complete implementation of every platform-specific Markdown extension.

## Verification status

The implementation includes Bun unit tests for parser modes, node-slot boundaries, safety guards, limits, duplicate IDs, and render-session invalidation, plus Playwright coverage for navigation, controls, diagrams, math, error isolation, responsive views, themes, and resource policy.

The final verification on 2026-10-13 used Ubuntu 24.04 arm64, Bun 1.4.3, and Playwright 1.61.1 with native browser installations. The Browser plugin was unavailable, so validation used Playwright CLI and a separate screenshot/request probe.

| Check | Final result |
| --- | --- |
| `bun run lint:fix` | Passed; no unrelated changes |
| `bun run check` | Passed; 0 errors and 0 warnings |
| `bun run lint` | Passed |
| `bun run test:unit` | 60 passed, 246 assertions across 6 files |
| `bun run test:e2e` | 14 passed on Chromium 149.0.7827.0, including the existing exchange-rate test |
| `bun run build` | Passed with `@sveltejs/adapter-cloudflare` |
| Firefox 151.0 | All 13 Markdown tests passed |
| WebKit 26.5 | All 13 Markdown tests passed |

Chromium also ran all 14 tests against the final production build using `bun run test:e2e --config /tmp/puretools-playwright-production-final.config.mts`. Firefox and WebKit used temporary configuration files selecting their native browser, the same production preview, and the 13 Markdown tests. Firefox retained normal content sandboxing. The browser tests cover all 11 required diagram families, real SVG labels and bounds, duplicate IDs, local diagram failures, math, modes, import/copy/download, stale work, composition, resource caps, links, footnotes, encoded anchors, BOM frontmatter, and dependency failure/retry. Security tests record actual requests; only the dedicated failure/retry case aborts the Mermaid dependency.

The screenshot/request probe used 1440 × 1000 and 390 × 844 viewports. Page identity, meaningful content, controls, light/dark rendering, and screenshots passed with no framework overlay or console errors. The mobile page had 0 pixels of horizontal overflow; diagrams retain readable intrinsic dimensions inside a local scroll area. Request classification used the build manifest, including hashed KaTeX and Mermaid chunks: the home page, JSON tool, and default Markdown document fetched none of those renderer resources. A document containing math and a diagram then fetched the local renderer chunks, one Mermaid bundle, and the necessary bundled fonts.

These results verify the tested Linux browser engines and viewports. Actual Safari on macOS/iOS, physical mobile devices, older browsers, and every additional Mermaid grammar remain unverified. Upstream browser support statements do not replace this project-level evidence.

### Build impact

The comparison uses the clean baseline commit `92a81790d4e98ec120a5e522acdba083e3eb3966` and the final build's `.svelte-kit/output/client` files. Gzip figures sum each JavaScript file compressed separately; they are artifact measurements, not initial-page transfer sizes or runtime benchmarks.

| Measurement | Baseline | Final | Increase |
| --- | ---: | ---: | ---: |
| Client files | 70 | 158 | 88 |
| All client bytes | 1,412,022 | 8,504,661 | 7,092,639 |
| JavaScript bytes | 355,742 | 6,347,536 | 5,991,794 |
| JavaScript gzip bytes | 129,890 | 1,841,414 | 1,711,524 |

The full Mermaid IIFE is one lazy asset of 5,193,475 bytes (1,458,721 gzip bytes). That is a substantial first-diagram download. Keeping the normal Mermaid package satisfies diagram coverage; route and syntax-based loading keep it out of the home page, other tools, and ordinary Markdown. No CPU-duration or maximum-size throughput benchmark is claimed.

### Issues corrected during verification

- The existing Linux Playwright configuration selected an x64-only serverless Chromium binary on arm64. It now uses the native Playwright browser on non-x64 platforms.
- Initial builds exposed incompatible worker chunk splitting and duplicate production retry bundles. The full Mermaid build now uses one self-contained IIFE; retry URL variants remain in the development branch.
- Diagram sizing initially accessed an XML node without SVG style APIs. The final implementation parses the already-sanitized SVG in a detached HTML document and adds only numeric dimensions. Dark-theme SVG styles permit local fragment references while retaining the external-resource guard.
- Encoded fragments could navigate the preview away from `srcdoc`; decoded anchors are now remapped to existing IDs and kept in the frame. BOM-aware source offsets preserve currency, alerts, and complete frontmatter, whose boundaries come from the parsed node.
- Earlier browser fixture failures included controls used before route hydration and inaccurate selectors/fixtures. The tests now wait for the route's initial client-rendered document and assert the actual supported syntax.
- Restricted-environment `EROFS` errors required writable cache, registry, and log paths. Its loopback proxy also required same-host browser/server execution. Concurrent development and build commands invalidated preview chunks during an intermediate run; final acceptance used a completed build with only the production preview running. These interrupted runs are not counted as passing acceptance.
