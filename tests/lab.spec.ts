import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("real request flow, experiments, evidence, desktop and mobile layouts", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await request.post("/api/traces/clear");
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Send request", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Cell name", { exact: true }).fill(`ui-${Date.now()}`);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(page.locator(".counter-value")).toHaveText("1");
  await expect(page.locator(".owner-text")).toContainText("node-");
  await page.getByLabel("Ingress node").selectOption("node-b");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(page.locator(".counter-value")).toHaveText("2");
  await page.getByRole("tab", { name: /Bucket explorer/ }).click();
  await expect(page.locator(".object-key").first()).toBeVisible();
  await page.getByRole("tab", { name: /Request timeline/ }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: /A hundred writers/ }).click();
  await page
    .getByRole("button", { name: "Run experiment", exact: true })
    .click();
  await expect(page.locator(".feedback.success")).toContainText(
    "100 distinct revisions",
  );
  await expect(page.locator(".feedback.success")).toContainText("Verified");
  await page.getByRole("button", { name: /Divide the work/ }).click();
  await page
    .getByRole("button", { name: "Run experiment", exact: true })
    .click();
  await expect(page.locator(".feedback.success")).toContainText(
    "Three independent rooms",
  );
  await page.getByRole("button", { name: /One cell, any node/ }).click();
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(page.locator(".counter-value")).toBeVisible();
  await expect(page.locator(".feedback.success")).toContainText("acknowledged");
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await mkdir(".impeccable/review", { recursive: true });
  await page.screenshot({
    path: ".impeccable/review/desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Cell name", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: ".impeccable/review/mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
