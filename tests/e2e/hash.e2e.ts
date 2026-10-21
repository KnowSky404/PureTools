import { createHash } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

const algorithms = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
const chunkSize = 4 * 1024 * 1024;
const md5abc = "900150983cd24fb0d6963f7d28e17f72";

function reference(data: string | Uint8Array, algorithm: string): string {
  return createHash(algorithm.toLowerCase().replace("-", "")).update(data).digest("hex");
}

function output(page: Page) {
  return page.getByLabel("Hash result", { exact: true });
}

async function openHash(page: Page): Promise<void> {
  await page.goto("/hash");
  await expect(page).toHaveTitle("Hash Calculator & Verifier | PureTools");
  await expect(page.getByRole("heading", { name: "Hash Calculator & Verifier" })).toBeVisible();
  await expect
    .poll(() => page.locator("html").evaluate((html) => html.style.colorScheme))
    .toMatch(/^(light|dark)$/);
}

async function fileMode(page: Page): Promise<void> {
  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(page.getByLabel("Drop one file here, or choose a file")).toBeVisible();
}

async function chooseFile(page: Page, name: string, buffer: Buffer): Promise<void> {
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType: "application/octet-stream", buffer });
}

test("global search finds the unified tool by every requested keyword", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await expect
    .poll(() => page.locator("html").evaluate((html) => html.style.colorScheme))
    .toMatch(/^(light|dark)$/);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  for (const keyword of ["md5", "hash", "checksum", "sha256", "file hash"]) {
    await page.getByPlaceholder("Search tools...").fill(keyword);
    await expect(page.locator('a[href="/hash"]').first()).toBeVisible();
  }
  expect(requests.some((url) => /hash-wasm|hash\.worker/.test(url))).toBe(false);
  await page.locator('a[href="/hash"]').first().click();
  await expect(page).toHaveURL(/\/hash$/);
});

test("all text algorithms preserve UTF-8, spaces and newlines; empty text is explicit", async ({
  page,
}) => {
  await openHash(page);
  await expect(page.getByLabel("Algorithm", { exact: true })).toHaveValue("SHA-256");
  await expect(output(page)).toHaveText("");
  const raw = "  中文🙂\n abc \n";
  await page.getByLabel("Text to hash").fill(raw);
  for (const algorithm of algorithms) {
    await page.getByLabel("Algorithm", { exact: true }).selectOption(algorithm);
    await expect(output(page)).toHaveText(reference(raw, algorithm));
  }
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.waitForTimeout(350);
  await expect(output(page)).toHaveText("");
  for (const algorithm of algorithms) {
    await page.getByLabel("Algorithm", { exact: true }).selectOption(algorithm);
    await page.getByRole("button", { name: "Calculate", exact: true }).click();
    await expect(output(page)).toHaveText(reference("", algorithm));
  }
  await page.getByLabel("Algorithm", { exact: true }).selectOption("MD5");
  await page.getByLabel("Text to hash").fill("abc");
  await expect(output(page)).toHaveText(md5abc);
  await page.getByRole("button", { name: "Swap hash into text" }).click();
  await expect(page.getByLabel("Text to hash")).toHaveValue(md5abc);
  await expect(output(page)).toHaveText(reference(md5abc, "MD5"));
});

test("text debounce invalidates output and delayed SHA work cannot overwrite newer input or clear", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    Object.defineProperty(crypto.subtle, "digest", {
      value: async (...args: Parameters<SubtleCrypto["digest"]>) => {
        const value = await digest(...args);
        await new Promise((resolve) => setTimeout(resolve, 700));
        return value;
      },
    });
  });
  await openHash(page);
  await page.getByLabel("Text to hash").fill("old input");
  await expect(page.getByText("Calculating…", { exact: true })).toBeVisible();
  await page.getByLabel("Text to hash").fill("new input");
  await expect(output(page)).toHaveText("");
  await expect(output(page)).toHaveText(reference("new input", "SHA-256"));
  await page.getByLabel("Text to hash").fill("clear me");
  await expect(page.getByText("Calculating…", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.waitForTimeout(800);
  await expect(output(page)).toHaveText("");
  await expect(page.getByRole("button", { name: "Copy hash" })).toBeDisabled();
});

test("real file workers hash binary data across chunks for all algorithms and ignore filenames", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openHash(page);
  await fileMode(page);
  const bytes = Buffer.alloc(chunkSize * 2 + 31);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = i % 256;
  }
  await chooseFile(page, "binary.dat", bytes);
  await expect(page.getByText("binary.dat", { exact: true })).toBeVisible();
  await expect(output(page)).toHaveText("");
  for (const algorithm of algorithms) {
    await page.getByLabel("Algorithm", { exact: true }).selectOption(algorithm);
    await page.getByRole("button", { name: "Calculate", exact: true }).click();
    await expect(output(page)).toHaveText(reference(bytes, algorithm), { timeout: 15_000 });
    await expect(page.getByRole("progressbar")).toHaveAttribute("value", "100");
  }
  await chooseFile(page, "same-bytes-renamed.bin", bytes);
  await expect(output(page)).toHaveText("");
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(output(page)).toHaveText(reference(bytes, "SHA-512"));
});

test("zero-byte files work for every algorithm", async ({ page }) => {
  await openHash(page);
  await fileMode(page);
  await chooseFile(page, "empty.bin", Buffer.alloc(0));
  await expect(page.getByText("0 B", { exact: true })).toBeVisible();
  for (const algorithm of algorithms) {
    await page.getByLabel("Algorithm", { exact: true }).selectOption(algorithm);
    await page.getByRole("button", { name: "Calculate", exact: true }).click();
    await expect(output(page)).toHaveText(reference("", algorithm));
  }
});

test("drag/drop accepts raw binary and rejects multiple files", async ({ page }) => {
  await openHash(page);
  await fileMode(page);
  await page.getByLabel("Algorithm", { exact: true }).selectOption("MD5");
  await page.getByRole("group", { name: "File drop area" }).evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([0, 255, 1, 128])], "dropped.bin"));
    element.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });
  await expect(page.getByText("dropped.bin", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(output(page)).toHaveText(reference(new Uint8Array([0, 255, 1, 128]), "MD5"));
  await page.getByRole("group", { name: "File drop area" }).evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["one"], "one.txt"));
    transfer.items.add(new File(["two"], "two.txt"));
    element.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });
  await expect(page.getByRole("alert")).toHaveText("Choose one file at a time.");
  await expect(output(page)).toHaveText("");
});

test("checksum validation ignores case and outer whitespace without rehashing the file", async ({
  page,
}) => {
  let workers = 0;
  page.on("worker", () => {
    workers += 1;
  });
  await openHash(page);
  await fileMode(page);
  await page.getByLabel("Algorithm", { exact: true }).selectOption("MD5");
  const expected = page.getByLabel("Expected Hash (optional)");
  const status = page.locator("#checksum-status");
  await expected.fill(md5abc);
  await expect(status).toHaveText("Calculate a hash to compare.");
  await chooseFile(page, "abc.txt", Buffer.from("abc"));
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(output(page)).toHaveText(md5abc);
  await expect(status).toHaveText("Match");
  await expected.fill(`  ${md5abc.toUpperCase()}  `);
  await expect(status).toHaveText("Match");
  await expected.fill("0".repeat(32));
  await expect(status).toHaveText("Mismatch");
  await expected.fill("not a checksum");
  await expect(status).toContainText("Invalid checksum");
  await expected.fill("");
  await expect(status).toHaveText("");
  expect(workers).toBe(1);
  await page.getByLabel("Algorithm", { exact: true }).selectOption("SHA-256");
  await expected.fill(reference("abc", "SHA-256"));
  await expect(status).toHaveText("Calculate a hash to compare.");
});

test("copy reports actual clipboard success and failure", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copiedHash = text;
        },
      },
    });
  });
  await openHash(page);
  await page.getByLabel("Algorithm", { exact: true }).selectOption("MD5");
  await page.getByLabel("Text to hash").fill("abc");
  await expect(output(page)).toHaveText(md5abc);
  await page.getByRole("button", { name: "Copy hash" }).click();
  await expect(page.getByText("Copied!", { exact: true })).toBeVisible();
  expect(await page.locator("html").getAttribute("data-copied-hash")).toBe(md5abc);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("Clipboard denied")) },
    });
  });
  await page.getByRole("button", { name: "Copy hash" }).click();
  await expect(page.getByText("Copy failed — select and copy the hash manually.")).toBeVisible();
});

// A deliberately uncooperative worker delivers queued events after termination.
// This exercises task isolation independently of how quickly a real machine hashes.
async function installDelayedWorker(page: Page): Promise<void> {
  await page.addInitScript(
    ({ oldHash, newHash }) => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.dataset.terminated = "0";
      });
      class DelayedWorker {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: ErrorEvent) => void) | null = null;
        onmessageerror: (() => void) | null = null;
        postMessage(request: { id: number; file: File }): void {
          const slow = request.file.name === "old.bin";
          setTimeout(
            () =>
              this.onmessage?.(
                new MessageEvent("message", {
                  data: { id: request.id, type: "progress", processed: 1, total: 4 },
                }),
              ),
            10,
          );
          setTimeout(
            () =>
              this.onmessage?.(
                new MessageEvent("message", {
                  data: { id: request.id, type: "done", value: slow ? oldHash : newHash },
                }),
              ),
            slow ? 500 : 30,
          );
        }
        terminate(): void {
          document.documentElement.dataset.terminated = String(
            Number(document.documentElement.dataset.terminated ?? "0") + 1,
          );
        }
      }
      Object.defineProperty(window, "Worker", { value: DelayedWorker, configurable: true });
    },
    { oldHash: reference("old", "SHA-256"), newHash: reference("new", "MD5") },
  );
}

test("reselection and algorithm changes prevent stale worker progress/results from overwriting a new result", async ({
  page,
}) => {
  await installDelayedWorker(page);
  await openHash(page);
  await fileMode(page);
  await chooseFile(page, "old.bin", Buffer.from("old"));
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "25");
  await page.getByLabel("Algorithm", { exact: true }).selectOption("MD5");
  await chooseFile(page, "new.bin", Buffer.from("new"));
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(output(page)).toHaveText(reference("new", "MD5"));
  await page.waitForTimeout(550);
  await expect(output(page)).toHaveText(reference("new", "MD5"));
  expect(Number(await page.locator("html").getAttribute("data-terminated"))).toBeGreaterThanOrEqual(
    2,
  );
});

test("cancel, clear, mode change and navigation terminate work and invalidate queued messages", async ({
  page,
}) => {
  await installDelayedWorker(page);
  await openHash(page);
  await fileMode(page);
  await chooseFile(page, "old.bin", Buffer.from("old"));
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Cancelled. Calculate to retry.")).toBeVisible();
  await page.waitForTimeout(550);
  await expect(output(page)).toHaveText("");
  await expect(page.getByText("Cancelled. Calculate to retry.")).toBeVisible();
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.waitForTimeout(550);
  await expect(output(page)).toHaveText("");
  await expect(page.getByRole("button", { name: "Calculate", exact: true })).toBeDisabled();
  await chooseFile(page, "old.bin", Buffer.from("old"));
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await page
    .getByRole("group", { name: "Input mode" })
    .getByRole("button", { name: "Text", exact: true })
    .click();
  await page.waitForTimeout(550);
  await expect(output(page)).toHaveText("");
  await fileMode(page);
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  const before = Number(await page.locator("html").getAttribute("data-terminated"));
  await page.getByRole("link", { name: "PureTools home" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(Number(await page.locator("html").getAttribute("data-terminated"))).toBe(before + 1);
});

test("actual file read failures and missing worker capabilities give recoverable errors", async ({
  page,
}) => {
  await page.route(/hash\.worker[^/]*\.(ts|js)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `
        const nativeRead = Blob.prototype.arrayBuffer;
        Blob.prototype.arrayBuffer = function() {
          return this.size === 4
            ? Promise.reject(new Error("read denied"))
            : nativeRead.call(this);
        };
        ${await response.text()}
      `,
    });
  });
  await openHash(page);
  await fileMode(page);
  await chooseFile(page, "unreadable.bin", Buffer.from("fail"));
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to read the file");
  await expect(page.getByRole("button", { name: "Calculate", exact: true })).toBeEnabled();
  await page.unrouteAll({ behavior: "wait" });
  // WebKit can retain intercepted worker scripts in its resource cache.
  // The injected failure applies to the unreadable fixture, so a newly selected
  // readable file exercises recovery even when that script is cached.
  await chooseFile(page, "readable.bin", Buffer.from("abc"));
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(output(page)).toHaveText(reference("abc", "SHA-256"));
  await page.evaluate(() => {
    Object.defineProperty(window, "Worker", { value: undefined });
  });
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Web Workers are required");
});

test("large file reading is bounded, reports progress and can be cancelled while the UI responds", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route(/hash\.worker[^/]*\.(ts|js)/, async (route) => {
    const response = await route.fetch();
    const instrumentation = `
      const nativeRead = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = function() {
        if (this.size > ${chunkSize}) throw new Error("Whole-file read detected");
        self.postMessage({ probe: "read", size: this.size });
        return nativeRead.call(this);
      };
    `;
    await route.fulfill({ response, body: instrumentation + (await response.text()) });
  });
  await page.addInitScript(() => {
    const state = { readSizes: [] as number[], progress: [] as number[], frames: 0, terminated: 0 };
    Object.defineProperty(window, "hashProbe", { value: state });
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        let active = true;
        const frame = (): void => {
          if (active) {
            state.frames += 1;
            requestAnimationFrame(frame);
          }
        };
        requestAnimationFrame(frame);
        const terminate = this.terminate.bind(this);
        this.terminate = (): void => {
          active = false;
          state.terminated += 1;
          terminate();
        };
        this.addEventListener("message", (event) => {
          if (event.data.probe === "read") {
            state.readSizes.push(event.data.size);
          }
          if (event.data.type === "progress" && event.data.processed > 0) {
            state.progress.push(event.data.processed);
            if (event.data.processed >= 12 * 1024 * 1024) {
              Array.from(document.querySelectorAll("button"))
                .find((button) => button.textContent?.trim() === "Cancel")
                ?.click();
            }
          }
        });
      }
    };
  });
  await openHash(page);
  await fileMode(page);
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    const block = new Uint8Array(1024 * 1024).fill(255);
    transfer.items.add(
      new File(
        Array.from({ length: 128 }, () => block),
        "large-128MiB.bin",
      ),
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("File input missing");
    }
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByText("large-128MiB.bin", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByText("Cancelled. Calculate to retry.")).toBeVisible({ timeout: 20_000 });
  const probe = await page.evaluate(
    () =>
      (
        window as unknown as {
          hashProbe: {
            readSizes: number[];
            progress: number[];
            frames: number;
            terminated: number;
          };
        }
      ).hashProbe,
  );
  expect(probe.readSizes.length).toBeGreaterThanOrEqual(3);
  expect(Math.max(...probe.readSizes)).toBe(chunkSize);
  expect(probe.progress).toContain(12 * 1024 * 1024);
  expect(probe.frames).toBeGreaterThan(0);
  expect(probe.terminated).toBe(1);
  await expect(output(page)).toHaveText("");
});

test("local processing makes no uploads or input persistence; responsive light and dark views are healthy", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const requests: { url: string; method: string }[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string): void {
      if (key !== "theme") {
        throw new Error(`Unexpected storage write: ${key}`);
      }
      setItem.call(this, key, value);
    };
    Object.defineProperty(window, "indexedDB", {
      get: () => {
        throw new Error("Unexpected IndexedDB access");
      },
    });
  });
  await openHash(page);
  await page.getByLabel("Algorithm", { exact: true }).selectOption("MD5");
  await page.getByLabel("Text to hash").fill("abc");
  await expect(output(page)).toHaveText(md5abc);
  await page.getByLabel("Expected Hash (optional)").fill(md5abc);
  await expect(page.locator("#checksum-status")).toHaveText("Match");
  await page.screenshot({
    path: `/tmp/puretools-hash-${testInfo.project.name || "chromium"}-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await fileMode(page);
  await chooseFile(page, "private-中文-file.bin", Buffer.from("abc"));
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(output(page)).toHaveText(md5abc);
  await expect(page.locator("#checksum-status")).toHaveText("Match");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await page.screenshot({
    path: `/tmp/puretools-hash-${testInfo.project.name || "chromium"}-mobile-dark.png`,
    fullPage: true,
  });
  expect(requests.filter((request) => request.method !== "GET")).toHaveLength(0);
  // The existing app shell loads Google Fonts; hashing adds only local assets.
  const unexpected = requests.filter((request) => {
    const url = new URL(request.url);
    return (
      url.origin !== new URL(page.url()).origin &&
      !["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname)
    );
  });
  expect(unexpected).toEqual([]);
  expect(requests.some((request) => /abc|private-|900150983cd24fb0/.test(request.url))).toBe(false);
  expect(errors).toEqual([]);
});
