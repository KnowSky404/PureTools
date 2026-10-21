export const HASH_ALGORITHMS = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;

export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];
export type ChecksumStatus = "none" | "invalid" | "pending" | "match" | "mismatch";

export const HASH_LENGTHS: Record<HashAlgorithm, number> = {
  MD5: 32,
  "SHA-1": 40,
  "SHA-256": 64,
  "SHA-384": 96,
  "SHA-512": 128,
};

export const HASH_CHUNK_SIZE = 4 * 1024 * 1024;

export type HashWorkerRequest = { id: number; file: File; algorithm: HashAlgorithm };
export type HashWorkerResponse =
  | { id: number; type: "progress"; processed: number; total: number }
  | { id: number; type: "done"; value: string }
  | { id: number; type: "error"; message: string };

export function compareChecksum(
  expected: string,
  algorithm: HashAlgorithm,
  actual?: string,
): ChecksumStatus {
  const normalized = expected.trim();
  if (!normalized) {
    return "none";
  }
  if (!new RegExp(`^[a-fA-F0-9]{${HASH_LENGTHS[algorithm]}}$`).test(normalized)) {
    return "invalid";
  }
  if (!actual) {
    return "pending";
  }
  return normalized.toLowerCase() === actual.toLowerCase() ? "match" : "mismatch";
}

function requireWasm(): void {
  if (typeof WebAssembly === "undefined") {
    throw new Error("WebAssembly is required for MD5 and file hashing in this browser.");
  }
}

export async function hashText(text: string, algorithm: HashAlgorithm): Promise<string> {
  if (typeof TextEncoder === "undefined") {
    throw new Error("UTF-8 text encoding is not available in this browser.");
  }
  // Never trim or normalize: these are the exact UTF-8 bytes of the input.
  const bytes = new TextEncoder().encode(text);
  if (algorithm === "MD5") {
    requireWasm();
    const { md5 } = await import("hash-wasm");
    return md5(bytes);
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available. Use a browser with HTTPS support.");
  }
  const digest = await globalThis.crypto.subtle.digest(algorithm, bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Used in a dedicated Worker in the UI. Only one slice is retained at a time;
// terminating that Worker cancels reads, hashing and progress delivery together.
export async function hashFile(
  file: Blob,
  algorithm: HashAlgorithm,
  onProgress: (processed: number, total: number) => void = () => {},
): Promise<string> {
  requireWasm();
  if (typeof file.slice !== "function" || typeof Blob.prototype.arrayBuffer !== "function") {
    throw new Error("Chunked file reading is not available in this browser.");
  }
  const { createMD5, createSHA1, createSHA256, createSHA384, createSHA512 } = await import(
    "hash-wasm"
  );
  const factories = {
    MD5: createMD5,
    "SHA-1": createSHA1,
    "SHA-256": createSHA256,
    "SHA-384": createSHA384,
    "SHA-512": createSHA512,
  };
  const hasher = await factories[algorithm]();
  hasher.init();
  onProgress(0, file.size);
  for (let offset = 0; offset < file.size; offset += HASH_CHUNK_SIZE) {
    const end = Math.min(offset + HASH_CHUNK_SIZE, file.size);
    let chunk: ArrayBuffer;
    try {
      chunk = await file.slice(offset, end).arrayBuffer();
    } catch {
      throw new Error("Unable to read the file. Please select it again and retry.");
    }
    hasher.update(new Uint8Array(chunk));
    onProgress(end, file.size);
  }
  return hasher.digest("hex");
}
