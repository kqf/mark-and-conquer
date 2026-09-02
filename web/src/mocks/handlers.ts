// The mock backend. Everything the real server will one day own — the board,
// the pixels, the clock — lives here and nowhere else in the app.
//
// These handlers run inside the page (not inside the Service Worker), so they
// can close over plain variables like the `pixels` Map below. That is the whole
// trick: an ordinary JS object pretending to be a database, reached over real
// HTTP.
import { http, HttpResponse } from "msw";
import type { Board, Color, Pixel } from "../types.ts";

const BOARD: Board = {
  width: 32,
  height: 32,
  background: "#FFFFFF",
  palette: [
    "#FFFFFF", "#D4D7D9", "#898D90", "#000000", "#FF4500",
    "#FFA800", "#FFD635", "#00A368", "#2450A4", "#811E9F",
  ],
};

// The whole "database": "x,y" -> color. Seeded from localStorage so a refresh
// does not wipe the board.
const pixels = new Map<string, Color>(
  JSON.parse(localStorage.getItem("pixels") ?? "[]"),
);

const save = () => localStorage.setItem("pixels", JSON.stringify([...pixels]));

// Fraction of writes the mock server rejects. Optimistic updates are a bet, and
// a bet you always win teaches you nothing. Set to 0 to turn this off.
const FAILURE_RATE = 0.1;

const COOLDOWN_MS = 5000;

// When this user may place again. Persisted, because a cooldown a page refresh
// can clear is not a cooldown.
let nextAllowedAt = Number(localStorage.getItem("nextAllowedAt") ?? 0);

// Pretend the network is slow, so the UI has to cope with waiting from day one.
const delay = () => new Promise((resolve) => setTimeout(resolve, 80));

export const handlers = [
  http.get("/api/board", async () => {
    await delay();
    return HttpResponse.json(BOARD);
  }),

  // One call returns the whole board, never one pixel at a time.
  http.get("/api/pixels", async () => {
    await delay();
    const body: Pixel[] = [...pixels].map(([key, color]) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y, color };
    });
    return HttpResponse.json(body);
  }),

  // Asked once on load, so a refresh restores the timer instead of resetting it.
  http.get("/api/cooldown", async () => {
    await delay();
    return HttpResponse.json({ nextAllowedAt });
  }),

  // The server owns the clock. It decides whether a write is too early, and it
  // returns the next deadline on every accepted write.
  http.put("/api/pixels/:x/:y", async ({ params, request }) => {
    await delay();

    const x = Number(params.x);
    const y = Number(params.y);
    const { color } = (await request.json()) as { color: Color };

    if (x < 0 || x >= BOARD.width || y < 0 || y >= BOARD.height) {
      return HttpResponse.json({ error: "Pixel out of board bounds" }, { status: 400 });
    }

    // 429 Too Many Requests is what "you are rate limited" means in HTTP, and
    // Retry-After is where the deadline belongs. We send the timestamp in the
    // body too, because the client wants an absolute time, not a duration.
    if (Date.now() < nextAllowedAt) {
      return HttpResponse.json(
        { nextAllowedAt },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((nextAllowedAt - Date.now()) / 1000)) },
        },
      );
    }

    if (Math.random() < FAILURE_RATE) {
      return HttpResponse.json({ error: "the server rejected the write" }, { status: 500 });
    }

    pixels.set(`${x},${y}`, color);
    save();

    nextAllowedAt = Date.now() + COOLDOWN_MS;
    localStorage.setItem("nextAllowedAt", String(nextAllowedAt));
    return HttpResponse.json({ nextAllowedAt });
  }),
];
