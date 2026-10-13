// The iframe cannot inherit the application stylesheet. These rules belong to
// the application, never to the document being previewed.
export const PREVIEW_CSS = `
:root { color-scheme:light; --paper:#fff; --ink:#171717; --muted:#525252; --line:#d4d4d4; --surface:#f5f5f5; --accent:#4338ca; }
:root.dark { color-scheme:dark; --paper:#171717; --ink:#f5f5f5; --muted:#a3a3a3; --line:#404040; --surface:#262626; --accent:#a5b4fc; }
* { box-sizing:border-box; }
html { background:var(--paper); color:var(--ink); overflow-wrap:anywhere; }
body { margin:0; padding:24px; font:16px/1.65 system-ui,sans-serif; min-width:0; }
h1,h2,h3,h4,h5,h6 { line-height:1.3; margin:1.5em 0 .6em; scroll-margin-top:16px; }
h1 { font-size:2em; } h2 { font-size:1.5em; } h3 { font-size:1.25em; }
body > :first-child { margin-top:0; }
p,ul,ol,blockquote,pre,table,details,figure { margin:1em 0; }
li > p { margin:.4em 0; } li > ul,li > ol { margin:.4em 0; }
a { color:var(--accent); } a:focus-visible,summary:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
blockquote { border-left:4px solid var(--line); padding:.2em 1em; color:var(--muted); }
hr { border:0; border-top:1px solid var(--line); margin:2em 0; }
pre,code,kbd { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.875em; }
code,kbd { padding:.15em .35em; border-radius:4px; background:var(--surface); }
pre { padding:16px; background:var(--surface); border:1px solid var(--line); border-radius:8px; overflow:auto; max-width:100%; white-space:pre; overflow-wrap:normal; }
pre code { padding:0; background:transparent; font-size:inherit; }
table { border-collapse:collapse; display:block; width:max-content; max-width:100%; overflow:auto; }
th,td { padding:8px 12px; border:1px solid var(--line); } th { background:var(--surface); }
td[align=right],th[align=right] { text-align:right; } td[align=center],th[align=center] { text-align:center; }
details { border:1px solid var(--line); border-radius:8px; padding:10px 14px; }
summary { cursor:pointer; font-weight:600; }
.markdown-alert { border-left:4px solid var(--accent); background:var(--surface); border-radius:4px; padding:8px 16px; margin:1em 0; }
.markdown-alert-warning,.markdown-alert-caution { border-color:#d97706; }
.markdown-image-placeholder,.markdown-empty { color:var(--muted); }
.markdown-error,.mermaid-error,.markdown-limit-error { color:#b91c1c; }
.dark .markdown-error,.dark .mermaid-error,.dark .markdown-limit-error { color:#fca5a5; }
.diagram { margin:1.5em 0; max-width:100%; }
.diagram-scroll { max-width:100%; max-height:48rem; overflow:auto; padding:12px; border:1px solid var(--line); border-radius:8px; }
.diagram svg { display:block; max-width:none; min-width:0; height:auto; }
.math-display,.katex-display { max-width:100%; overflow:auto; padding:4px 0; }
.math-inline { display:inline-block; max-width:100%; overflow-x:auto; vertical-align:middle; }
.footnotes { font-size:.9em; border-top:1px solid var(--line); margin-top:2em; }
.sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
.hljs-comment,.hljs-quote { color:var(--muted); }
.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-built_in { color:#7c3aed; }
.hljs-string,.hljs-attr,.hljs-regexp { color:#047857; }
.hljs-number,.hljs-title,.hljs-type { color:#b45309; }
.dark .hljs-keyword,.dark .hljs-selector-tag,.dark .hljs-literal,.dark .hljs-built_in { color:#c4b5fd; }
.dark .hljs-string,.dark .hljs-attr,.dark .hljs-regexp { color:#6ee7b7; }
.dark .hljs-number,.dark .hljs-title,.dark .hljs-type { color:#fcd34d; }
@media(max-width:600px) { body { padding:16px; font-size:15px; } }
`;
