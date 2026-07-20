// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  type ChromeAIModelAvailability = "available" | "downloadable" | "downloading" | "unavailable";

  interface ChromeAIModelDownloadProgressEvent extends Event {
    loaded: number;
  }

  interface ChromeAIModelMonitor extends EventTarget {
    addEventListener(
      type: "downloadprogress",
      listener: (event: ChromeAIModelDownloadProgressEvent) => void,
    ): void;
  }

  interface ChromeAIModelCreateOptions {
    monitor?: (monitor: ChromeAIModelMonitor) => void;
  }

  interface ChromeTranslatorCreateOptions extends ChromeAIModelCreateOptions {
    sourceLanguage: string;
    targetLanguage: string;
  }

  interface ChromeTranslator {
    translate(input: string): Promise<string>;
    translateStreaming(input: string): ReadableStream<string>;
    destroy(): void;
  }

  interface ChromeTranslatorFactory {
    availability(options: {
      sourceLanguage: string;
      targetLanguage: string;
    }): Promise<ChromeAIModelAvailability>;
    create(options: ChromeTranslatorCreateOptions): Promise<ChromeTranslator>;
  }

  interface ChromeLanguageDetectionResult {
    detectedLanguage: string;
    confidence: number;
  }

  interface ChromeLanguageDetector {
    detect(input: string): Promise<ChromeLanguageDetectionResult[]>;
    destroy(): void;
  }

  interface ChromeLanguageDetectorFactory {
    availability(): Promise<ChromeAIModelAvailability>;
    create(options?: ChromeAIModelCreateOptions): Promise<ChromeLanguageDetector>;
  }

  interface Window {
    Translator?: ChromeTranslatorFactory;
    LanguageDetector?: ChromeLanguageDetectorFactory;
  }

  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
