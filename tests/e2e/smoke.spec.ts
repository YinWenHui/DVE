import { expect, test } from "@playwright/test";

test("mock administrator opens the seeded application and uses report controls", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await page.setViewportSize({ width: 950, height: 1050 });
  await page.goto("/login"); await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await page.getByRole("button", { name: /Administrator/ }).click(); await expect(page).toHaveURL(/\/apps/, { timeout: 20_000 });
  await page.getByRole("link", { name: /Digital Verse Demo/ }).click(); await expect(page).toHaveURL(/\/app\/digital-verse-demo\/report\//, { timeout: 20_000 });
  await expect(page.getByText("Daily Report")).toBeVisible(); await expect(page.getByText("Actual by Line")).toBeVisible();
  await page.getByTitle("Toggle theme").dispatchEvent("click"); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const refreshButton = page.getByTitle("Refresh now"); await refreshButton.dispatchEvent("click");
  await expect(refreshButton).toBeDisabled(); await expect(refreshButton).toBeEnabled({ timeout: 20_000 }); await expect(page.getByText(/Refresh in/)).toBeVisible();
  const filterLatency = await page.getByRole("button", { name: "Filters", exact: true }).evaluate(async (button) => { const started = performance.now(); (button as HTMLButtonElement).click(); await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); return performance.now() - started; });
  expect(filterLatency).toBeLessThan(1_000);
  const filtersPane = page.getByLabel("Report filters");
  await expect(filtersPane).toBeVisible(); await filtersPane.getByLabel("Line").selectOption("Line A");
  await expect(page.getByText("Line A", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Bookmarks", exact: true }).dispatchEvent("click");
  const bookmarksPane = page.getByLabel("Personal bookmarks");
  await bookmarksPane.getByLabel("Bookmark name").evaluate((element) => { const input = element as HTMLInputElement; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; setter?.call(input, "Line A view"); input.dispatchEvent(new Event("input", { bubbles: true })); }); await bookmarksPane.getByRole("button", { name: "Add" }).dispatchEvent("click");
  await expect(bookmarksPane.getByText("Line A view")).toBeVisible(); await bookmarksPane.getByLabel("Close bookmarks").dispatchEvent("click");
  await page.getByRole("button", { name: "Show data for Actual by Line" }).dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: /Actual by Line — underlying data/ })).toBeVisible(); await page.getByRole("button", { name: "Close dialog" }).dispatchEvent("click");
  await page.getByRole("button", { name: "Focus Actual by Line" }).dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: /Actual by Line — focus mode/ })).toBeVisible(); await page.getByRole("button", { name: "Close dialog" }).dispatchEvent("click");
  const reportViewport = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(reportViewport.scrollWidth).toBeLessThanOrEqual(reportViewport.clientWidth + 1);
  await page.goto("/admin/alerts");
  await expect(page.getByRole("heading", { name: "Structured alert rules" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Achievement below target" })).toBeVisible();
  await page.goto("/app/digital-verse-demo/report/dl-report-dc-line");
  await expect(page.getByText("Actual by Line")).toBeVisible();
  await page.goto("/admin/reports/report-1/edit"); await expect(page.getByText("Canvas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Gauge" }).dispatchEvent("click"); await page.getByRole("button", { name: "Format" }).dispatchEvent("click");
  await expect(page.getByText("Format visual")).toBeVisible(); await expect(page.getByText("Show title")).toBeVisible();
  const builderViewport = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(builderViewport.scrollWidth).toBeLessThanOrEqual(builderViewport.clientWidth + 1);
  expect(browserErrors).toEqual([]);
});

test("viewer is blocked from administration", async ({ page }) => {
  await page.goto("/login"); await page.getByRole("button", { name: /Viewer/ }).click(); await expect(page).toHaveURL(/\/apps/, { timeout: 20_000 }); await page.goto("/admin"); await expect(page).toHaveURL(/\/apps/, { timeout: 20_000 });
});
