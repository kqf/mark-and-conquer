import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 5173);

// Point this at a container or a deployment and the specs run against that
// instead, without starting anything of their own.
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests",

  // One board, one database, and a cooldown measured in real seconds: these
  // specs share state by design, so they run one at a time.
  workers: 1,
  fullyParallel: false,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    // Cheap until something fails, and then it is the whole story: every
    // request, every DOM snapshot, replayable with `npm run report`.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // Chromium alone. This layer is here to catch a broken seam between the SPA
  // and Flask, which is not a thing that differs by browser engine.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: external
    ? undefined
    : {
        command: "sh ./serve.sh",
        // /health is the API answering, which means Flask is up and the
        // blueprint is registered -- a better ready signal than a static file.
        url: `${baseURL}/health`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: { PORT: String(PORT) },
        stdout: "pipe",
        stderr: "pipe",
      },
});
