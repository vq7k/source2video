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

test("L1 writing page completes feedback round and publishes a reusable rule package", async ({ page }) => {
  await page.goto("/writing");

  await page.getByPlaceholder("例如：为什么 RAG 不适合实时数据？").fill(fixture.quickIntake);
  await page.getByRole("button", { name: /生成结果/ }).click();

  await expect(page.getByText("Eval 最高")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("radio", { name: "更具体" }).click();
  await page
    .getByPlaceholder("补充一句要求（可选）：例如更具体一点，少用抽象比喻。")
    .fill("保留核心判断，但每段必须给出一个明确依据。");
  await page.getByRole("button", { name: "再来一轮" }).click();

  await expect(page.getByRole("button", { name: /第 2 轮 · 当前/ })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: /标为最终/ }).click();
  await expect(page.getByText("已标最终").first()).toBeVisible();

  await page.getByRole("button", { name: "生成规则包草稿" }).click();
  await expect(page.getByText("规则包草稿")).toBeVisible();
  await expect(page.getByText(/rule-package-v1/)).toBeVisible();

  await page.getByRole("button", { name: "发布规则包" }).click();
  await expect(page.getByRole("button", { name: "规则包已发布" })).toBeVisible();
  await expect(page.getByText("可复用", { exact: true })).toBeVisible();
});

test("L1 writing page deep-links to observation and restores the selected topic on return", async ({ page }) => {
  await page.goto("/writing");

  await page.getByPlaceholder("例如：为什么 RAG 不适合实时数据？").fill(fixture.quickIntake);
  await page.getByRole("button", { name: /生成结果/ }).click();

  await expect(page.getByText("Eval 最高")).toBeVisible({ timeout: 30_000 });

  const observeLink = page.getByRole("link", { name: "打开调用细节" });
  const href = await observeLink.getAttribute("href");
  expect(href).toBeTruthy();

  const diagnosticsUrl = new URL(href ?? "", "http://127.0.0.1:3911");
  expect(diagnosticsUrl.pathname).toBe("/framework");
  expect(diagnosticsUrl.searchParams.get("runId")).toBeTruthy();
  expect(diagnosticsUrl.searchParams.get("candidateId")).toBeTruthy();
  expect(diagnosticsUrl.searchParams.get("nodeRunId")).toBeTruthy();
  expect(diagnosticsUrl.searchParams.get("traceId")).toBeTruthy();
  expect(diagnosticsUrl.searchParams.get("returnTo")).toContain("/writing?");

  await observeLink.click();
  await expect(page.getByText("Trace 已定位")).toBeVisible();

  await page.getByRole("link", { name: "返回主工作台" }).click();
  await expect(page).toHaveURL(/\/writing\?/);
  await expect(page.getByText("Eval 最高")).toBeVisible();
  await expect(page.getByText("尚未生成")).toHaveCount(0);
});
