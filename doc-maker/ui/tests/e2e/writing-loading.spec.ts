import { expect, test } from "@playwright/test";

test("writing page reserves initial loading layout while loading runs", async ({ page }) => {
  let releaseRuns!: () => void;
  const runsRequestBlocked = new Promise<void>((resolve) => {
    releaseRuns = resolve;
  });

  await page.route("**/api/writing-runs", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await runsRequestBlocked;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ runs: [] }),
    });
  });

  await page.goto("/writing", { waitUntil: "domcontentloaded" });

  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.getByText("尚未生成")).toHaveCount(0);

  releaseRuns();

  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByText("尚未生成")).toBeVisible();
});
