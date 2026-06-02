import { describe, expect, it } from "vitest";

describe("health route", () => {
  it("returns ok for container health checks", async () => {
    const { GET } = await import("../../app/api/health/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
