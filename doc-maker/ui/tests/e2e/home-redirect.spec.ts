import { expect, test } from "@playwright/test";

test("default entry opens the writing workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/writing$/);
  await expect(page.getByText("文本生成")).toBeVisible();
});
