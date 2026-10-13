export type MarkdownMode = "enhanced" | "commonmark";

export type MarkdownSlotKind = "mermaid" | "math" | "code";

export interface MarkdownSlot {
  id: string;
  kind: MarkdownSlotKind;
  source: string;
  language?: string;
  display?: boolean;
  line?: number;
}

export interface MarkdownParseResult {
  html: string;
  slots: MarkdownSlot[];
  warnings: string[];
}

export interface MarkdownLimits {
  /** Maximum UTF-8 input size accepted by the parser. */
  maxInputBytes: number;
  /** Suggested point at which the UI should switch to manual rendering. */
  manualRenderThresholdBytes: number;
  /** Maximum number of Mermaid blocks that can be rendered as diagrams. */
  maxDiagrams: number;
  /** Maximum source size of one Mermaid block. */
  maxDiagramChars: number;
  /** Maximum Mermaid edge declarations in one block. */
  maxDiagramEdges: number;
  /** Maximum source size of one math expression. */
  maxMathChars: number;
  /** Maximum source size of one code block. */
  maxCodeChars: number;
}

export const DEFAULT_MARKDOWN_LIMITS: Readonly<MarkdownLimits> = {
  maxInputBytes: 512 * 1024,
  manualRenderThresholdBytes: 64 * 1024,
  maxDiagrams: 20,
  maxDiagramChars: 20_000,
  maxDiagramEdges: 500,
  maxMathChars: 20_000,
  maxCodeChars: 256 * 1024,
};

/** Short alias for consumers that prefer the existing utility naming style. */
export const MARKDOWN_LIMITS = DEFAULT_MARKDOWN_LIMITS;

/** Public name used by callers that want the immutable default policy. */
export const LIMITS = DEFAULT_MARKDOWN_LIMITS;

/** Attribute used by the preview to replace trusted generated slot placeholders. */
export const MARKDOWN_SLOT_ATTRIBUTE = "data-puretools-slot";

/** Prefix reserved for generated slot ids; user HTML never gets this attribute. */
export const MARKDOWN_SLOT_PREFIX = "pt-slot-";
