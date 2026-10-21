import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  compareChecksum,
  HASH_ALGORITHMS,
  HASH_CHUNK_SIZE,
  HASH_LENGTHS,
  type HashAlgorithm,
  hashFile,
  hashText,
} from "./hash";

function reference(data: string | Uint8Array, algorithm: HashAlgorithm): string {
  return createHash(algorithm.toLowerCase().replace("-", "")).update(data).digest("hex");
}

describe("local hash correctness", () => {
  test("MD5 standard vectors", async () => {
    expect(await hashText("abc", "MD5")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(await hashText("", "MD5")).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  for (const algorithm of HASH_ALGORITHMS) {
    test(`${algorithm}: exact UTF-8 text and empty/binary files`, async () => {
      for (const text of ["abc", "", "中文🙂🚀", "  first\n second \n", "é", "e\u0301"]) {
        const expected = reference(text, algorithm);
        expect(await hashText(text, algorithm)).toBe(expected);
        expect(await hashFile(new File([text], "text.txt"), algorithm)).toBe(expected);
        expect(expected).toHaveLength(HASH_LENGTHS[algorithm]);
      }
      const binary = new Uint8Array([0, 255, 128, 1, 13, 10, 0, 254]);
      const expected = reference(binary, algorithm);
      expect(await hashFile(new File([binary], "first.bin"), algorithm)).toBe(expected);
      expect(await hashFile(new File([binary], "different-name.dat"), algorithm)).toBe(expected);
    });

    test(`${algorithm}: ordered multi-chunk hashing without whole-file reads`, async () => {
      const bytes = Uint8Array.from({ length: HASH_CHUNK_SIZE * 2 + 37 }, (_, i) => i % 251);
      const slices: number[] = [];
      class ChunkOnlyBlob extends Blob {
        override arrayBuffer(): Promise<ArrayBuffer> {
          throw new Error("Whole-file reads are forbidden.");
        }
        override slice(start?: number, end?: number): Blob {
          const chunk = super.slice(start, end);
          slices.push(chunk.size);
          return chunk;
        }
      }
      const progress: number[] = [];
      const file = new ChunkOnlyBlob([bytes]);
      expect(
        await hashFile(file, algorithm, (processed, total) => {
          expect(total).toBe(bytes.length);
          progress.push(processed);
        }),
      ).toBe(reference(bytes, algorithm));
      expect(slices.join(",")).toBe([HASH_CHUNK_SIZE, HASH_CHUNK_SIZE, 37].join(","));
      expect(progress.join(",")).toBe(
        [0, HASH_CHUNK_SIZE, HASH_CHUNK_SIZE * 2, bytes.length].join(","),
      );
    });
  }

  test("does not trim or normalize text", async () => {
    expect((await hashText(" abc ", "MD5")) === (await hashText("abc", "MD5"))).toBe(false);
    expect((await hashText("é", "MD5")) === (await hashText("e\u0301", "MD5"))).toBe(false);
  });

  test("reports a failed slice read without falling back to a whole-file read", async () => {
    class UnreadableBlob extends Blob {
      override slice(): Blob {
        const slice = new Blob(["data"]);
        slice.arrayBuffer = () => Promise.reject(new Error("File is no longer readable."));
        return slice;
      }
    }
    let message = "";
    try {
      await hashFile(new UnreadableBlob(["data"]), "MD5");
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toBe("Unable to read the file. Please select it again and retry.");
  });

  test("explains missing WebAssembly support", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "WebAssembly");
    Object.defineProperty(globalThis, "WebAssembly", { value: undefined, configurable: true });
    try {
      let message = "";
      try {
        await hashText("abc", "MD5");
      } catch (error) {
        message = error instanceof Error ? error.message : "";
      }
      expect(message).toContain("WebAssembly is required");
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, "WebAssembly", descriptor);
      }
    }
  });
});

describe("checksum comparison", () => {
  for (const algorithm of HASH_ALGORITHMS) {
    test(`${algorithm}: format, case, whitespace and pending results`, () => {
      const actual = reference("abc", algorithm);
      expect(compareChecksum(` \n${actual.toUpperCase()}\t`, algorithm, actual)).toBe("match");
      expect(compareChecksum("0".repeat(HASH_LENGTHS[algorithm]), algorithm, actual)).toBe(
        "mismatch",
      );
      expect(compareChecksum(actual, algorithm)).toBe("pending");
      expect(compareChecksum(actual.slice(1), algorithm, actual)).toBe("invalid");
      expect(compareChecksum("g".repeat(HASH_LENGTHS[algorithm]), algorithm, actual)).toBe(
        "invalid",
      );
      expect(compareChecksum(`${actual.slice(0, 4)} ${actual.slice(5)}`, algorithm, actual)).toBe(
        "invalid",
      );
      expect(compareChecksum(" \n ", algorithm, actual)).toBe("none");
    });
  }
});
