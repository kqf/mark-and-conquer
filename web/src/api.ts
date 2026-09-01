// The fake backend. Every function here is async and returns what the real
// HTTP API will return, so replacing these three bodies with fetch() calls is
// the only change the rest of the app will ever see.
import type { Board, Color, Pixel } from "./types";

const BOARD: Board = {
  width: 32,
  height: 32,
  background: "#FFFFFF",
  palette: [
    "#FFFFFF", "#D4D7D9", "#898D90", "#000000", "#FF4500",
    "#FFA800", "#FFD635", "#00A368", "#2450A4", "#811E9F",
  ],
};

// The whole "database": "x,y" -> color.
const pixels = new Map<string, Color>(
  JSON.parse(localStorage.getItem("pixels") ?? "[]"),
);

const save = () => localStorage.setItem("pixels", JSON.stringify([...pixels]));

// Pretend the network is slow, so the UI has to cope with waiting from day one.
const delay = () => new Promise((resolve) => setTimeout(resolve, 80));

// Fraction of writes the fake server rejects. Optimistic updates are a bet, and
// a bet you always win teaches you nothing. Set to 0 to turn this off.
const FAILURE_RATE = 0.1;

const COOLDOWN_MS = 5000;

// When this user may place again. Persisted, because a cooldown a page refresh
// can clear is not a cooldown.
let nextAllowedAt = Number(localStorage.getItem("nextAllowedAt") ?? 0);

// Thrown when a write arrives too early. Carries the deadline so the client can
// correct itself instead of guessing.
export class CooldownError extends Error {
  nextAllowedAt: number;

  constructor(nextAllowedAt: number) {
    super("Still cooling down");
    this.nextAllowedAt = nextAllowedAt;
  }
}

// Asked once on load, so a refresh restores the timer instead of resetting it.
export async function getCooldown(): Promise<number> {
  await delay();
  return nextAllowedAt;
}

export async function getBoard(): Promise<Board> {
  await delay();
  return BOARD;
}

// One call returns the whole board, never one pixel at a time.
export async function getPixels(): Promise<Pixel[]> {
  await delay();
  return [...pixels].map(([key, color]) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y, color };
  });
}

// The server owns the clock. It decides whether a write is too early, and it
// returns the next deadline on every accepted write.
export async function setPixel(
  x: number,
  y: number,
  color: Color,
): Promise<number> {
  await delay();
  if (Date.now() < nextAllowedAt) throw new CooldownError(nextAllowedAt);
  if (Math.random() < FAILURE_RATE) throw new Error("the server rejected the write");

  pixels.set(`${x},${y}`, color);
  save();

  nextAllowedAt = Date.now() + COOLDOWN_MS;
  localStorage.setItem("nextAllowedAt", String(nextAllowedAt));
  return nextAllowedAt;
}
