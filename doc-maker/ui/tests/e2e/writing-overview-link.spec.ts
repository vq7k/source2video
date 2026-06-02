import { expect, test } from "@playwright/test";

test("writing workspace opens the full overview route", async ({ page }) => {
  await page.goto("/writing");

  await page.getByRole("link", { name: "打开完整工作区" }).click();

  await expect(page).toHaveURL(/\/overview$/);
});
