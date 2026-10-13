import mermaid from "mermaid";

type MermaidTheme = "light" | "dark";

type RenderMessage = {
  type: "render";
  requestId: number;
  renderId: string;
  source: string;
  theme: MermaidTheme;
};

type FrameMessage =
  | { type: "ready" }
  | { type: "result"; requestId: number; svg: string }
  | { type: "error"; requestId: number; error: string };

const MERMAID_SECURITY_CONFIG = Object.freeze({
  securityLevel: "strict" as const,
  startOnLoad: false,
  secure: [
    "secure",
    "securityLevel",
    "startOnLoad",
    "maxTextSize",
    "maxEdges",
    "theme",
    "themeVariables",
    "themeCSS",
    "fontFamily",
    "htmlLabels",
  ],
  maxTextSize: 20_000,
  maxEdges: 500,
  fontFamily: "Arial, sans-serif",
  htmlLabels: false,
});

function send(message: FrameMessage): void {
  window.parent.postMessage(message, "*");
}

function initialize(theme: MermaidTheme): void {
  mermaid.initialize({
    ...MERMAID_SECURITY_CONFIG,
    theme: theme === "dark" ? "dark" : "default",
    // These values are application-controlled.  In particular, do not copy
    // themeVariables, themeCSS, callbacks, or security options from source.
    themeVariables:
      theme === "dark"
        ? {
            background: "#171717",
            primaryColor: "#262626",
            primaryTextColor: "#f5f5f5",
            lineColor: "#a3a3a3",
          }
        : {
            background: "#ffffff",
            primaryColor: "#f5f5f5",
            primaryTextColor: "#171717",
            lineColor: "#525252",
          },
  });
}

async function render(message: RenderMessage): Promise<void> {
  try {
    initialize(message.theme);
    const result = await mermaid.render(message.renderId, message.source);
    send({ type: "result", requestId: message.requestId, svg: result.svg });
  } catch (error) {
    send({
      type: "error",
      requestId: message.requestId,
      error: error instanceof Error ? error.message : "Mermaid could not render this diagram.",
    });
  } finally {
    // Mermaid may create a temporary render node.  Never retain generated
    // document state across requests in the isolated frame.
    document.body.replaceChildren();
  }
}

window.addEventListener("message", (event: MessageEvent<RenderMessage>) => {
  if (event.source !== window.parent || !event.data || event.data.type !== "render") {
    return;
  }
  void render(event.data);
});

send({ type: "ready" });
