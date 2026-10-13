import { defineConfig } from "@playwright/test";
import serverlessChromium from "@sparticuz/chromium";

// The npm serverless package ships x64 binaries only. Other architectures use
// Playwright's native browser installation, just like macOS and Windows.
const useBundledChromium = process.platform === "linux" && process.arch === "x64";
const executablePath = useBundledChromium ? await serverlessChromium.executablePath() : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    launchOptions: {
      executablePath,
      args: useBundledChromium ? serverlessChromium.args : undefined,
    },
  },
  webServer: {
    command: "bun run dev --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
