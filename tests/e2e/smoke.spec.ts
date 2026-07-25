import { expect, test } from "@playwright/test";

test("mock administrator opens the seeded application and uses report controls", async ({ page }) => {
  await page.goto("/login"); await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await page.getByRole("button", { name: /Administrator/ }).click(); await expect(page).toHaveURL(/\/apps/, { timeout: 20_000 });
  await page.getByRole("link", { name: /Digital Verse Demo/ }).click(); await expect(page).toHaveURL(/\/app\/digital-verse-demo\/report\//, { timeout: 20_000 });
  await expect(page.getByText("Daily Report")).toBeVisible(); await expect(page.getByText("Actual by Line")).toBeVisible();
  await page.getByTitle("Toggle theme").dispatchEvent("click"); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByTitle("Refresh now").dispatchEvent("click"); await expect(page.getByText(/Refresh in/)).toBeVisible();
});

test("viewer is blocked from administration", async ({ page }) => {
  await page.goto("/login"); await page.getByRole("button", { name: /Viewer/ }).click(); await expect(page).toHaveURL(/\/apps/, { timeout: 20_000 }); await page.goto("/admin"); await expect(page).toHaveURL(/\/apps/, { timeout: 20_000 });
});
