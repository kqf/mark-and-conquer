import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { CooldownError, setPixel } from "./api.ts";
import { server } from "./mocks/server.ts";

describe("setPixel", () => {
  it("sends the color as the body", async () => {
    let body: unknown;
    server.use(
      http.put("/api/pixels/:x/:y", async ({ request, params }) => {
        body = { ...(await request.json() as object), ...params };
        return HttpResponse.json({ nextAllowedAt: 0 });
      }),
    );

    await setPixel(3, 4, "#2450A4");

    expect(body).toEqual({ color: "#2450A4", x: "3", y: "4" });
  });

  it("turns a 429 into a CooldownError carrying the deadline", async () => {
    server.use(
      http.put("/api/pixels/:x/:y", () =>
        HttpResponse.json({ nextAllowedAt: 4242 }, { status: 429 }),
      ),
    );

    await expect(setPixel(0, 0, "#000000")).rejects.toThrow(CooldownError);
    await expect(setPixel(0, 0, "#000000")).rejects.toMatchObject({
      nextAllowedAt: 4242,
    });
  });

  it("surfaces the server's error message", async () => {
    server.use(
      http.put("/api/pixels/:x/:y", () =>
        HttpResponse.json({ error: "the server rejected the write" }, { status: 500 }),
      ),
    );

    await expect(setPixel(0, 0, "#000000")).rejects.toThrow(
      "the server rejected the write",
    );
  });

  it("falls back to the status code when the body carries no message", async () => {
    server.use(
      http.put("/api/pixels/:x/:y", () => new HttpResponse(null, { status: 503 })),
    );

    await expect(setPixel(0, 0, "#000000")).rejects.toThrow(
      "Request failed with 503",
    );
  });
});
