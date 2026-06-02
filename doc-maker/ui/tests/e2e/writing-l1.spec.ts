import { expect, test } from "@playwright/test";

import fixture from "../fixtures/l1-writing-regression.json";

test("L1 writing page generates candidates and exposes completion actions", async ({ page }) => {
  await page.goto("/writing");

  await expect(page.getByText("文本生成")).toBeVisible();
  await expect(page.getByText("输入文本").first()).toBeVisible();

  await page.getByPlaceholder("例如：为什么 RAG 不适合实时数据？").fill(fixture.quickIntake);
  await page.getByRole("button", { name: /生成结果/ }).click();

  await expect(page.getByText("正在生成结果")).toBeVisible();
  await expect(page.getByText("历史结果")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Eval 最高")).toBeVisible();
  await expect(page.getByRole("button", { name: /复制文本/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /标为最终/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /再来一轮/ })).toBeVisible();

  await page.getByRole("button", { name: /标为最终/ }).click();
  await expect(page.getByText("已标最终").first()).toBeVisible();
});
