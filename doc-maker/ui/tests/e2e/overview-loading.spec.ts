import { expect, test } from "@playwright/test";

test("overview reserves the workspace layout while initial data loads", async ({ page }) => {
  let releaseWorkspace!: () => void;
  const workspaceRequestBlocked = new Promise<void>((resolve) => {
    releaseWorkspace = resolve;
  });

  await page.route("**/api/writing-runs", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await workspaceRequestBlocked;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ runs: [] }),
    });
  });
  await page.route("**/api/rule-packages", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await workspaceRequestBlocked;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rulePackages: [] }),
    });
  });

  await page.goto("/overview", { waitUntil: "domcontentloaded" });

  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.getByText("当前视图没有任务。")).toHaveCount(0);
  await expect(page.getByText("写作规则范围尚未生成")).toHaveCount(0);

  releaseWorkspace();

  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByText("当前视图没有任务。")).toBeVisible();
});
