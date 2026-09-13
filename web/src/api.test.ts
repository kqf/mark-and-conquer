import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { CooldownError, getBoard, getCooldown, getPixels, setPixel } from "./api.ts";
import { server } from "./mocks/server.ts";

describe("reads", () => {
  it("fetches the board", async () => {
    const board = await getBoard();

    expect(board.width).toBe(32);
    expect(board.height).toBe(32);
    expect(board.background).toBe("#FFFFFF");
    expect(board.palette).toHaveLength(10);
  });

  it("fetches the pixels the server knows about", async () => {
    server.use(
      http.get("/api/pixels", () =>
        HttpResponse.json([{ x: 1, y: 2, color: "#FF4500" }]),
      ),
    );

    await expect(getPixels()).resolves.toEqual([{ x: 1, y: 2, color: "#FF4500" }]);
  });

  it("unwraps the cooldown deadline", async () => {
    server.use(
      http.get("/api/cooldown", () => HttpResponse.json({ nextAllowedAt: 1234 })),
    );

    await expect(getCooldown()).resolves.toBe(1234);
  });
});

describe("setPixel", () => {
  it("returns the deadline the server hands back", async () => {
    server.use(
      http.put("/api/pixels/:x/:y", () => HttpResponse.json({ nextAllowedAt: 9999 })),
    );

    await expect(setPixel(3, 4, "#FF4500")).resolves.toBe(9999);
  });

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
