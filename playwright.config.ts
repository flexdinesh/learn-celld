import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  use: { baseURL: process.env.LAB_URL ?? "http://localhost:5173" },
  workers: 1,
  reporter: "list",
});
