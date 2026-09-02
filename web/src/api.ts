// The HTTP client. Every function here talks to the real network; in
// development MSW answers instead of Flask, but this file cannot tell the
// difference and does not care. When the real API is ready, only API_URL
// changes.
import type { Board, Color, Pixel } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

// Thrown when a write arrives too early. Carries the deadline so the client can
// correct itself instead of guessing.
export class CooldownError extends Error {
  nextAllowedAt: number;

  constructor(nextAllowedAt: number) {
    super("Still cooling down");
    this.nextAllowedAt = nextAllowedAt;
  }
}

// fetch() only rejects when the network itself fails; a 500 is a perfectly
// successful round trip as far as it is concerned. So every non-2xx has to be
// turned into an exception by hand, exactly once, here.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (response.status === 429) {
    const { nextAllowedAt } = await response.json();
    throw new CooldownError(nextAllowedAt);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  return response.json();
}

export async function getBoard(): Promise<Board> {
  return request<Board>("/board");
}

// One call returns the whole board, never one pixel at a time.
export async function getPixels(): Promise<Pixel[]> {
  return request<Pixel[]>("/pixels");
}

// Asked once on load, so a refresh restores the timer instead of resetting it.
export async function getCooldown(): Promise<number> {
  const { nextAllowedAt } = await request<{ nextAllowedAt: number }>("/cooldown");
  return nextAllowedAt;
}

// The server owns the clock, and hands back the next deadline on every
// accepted write.
export async function setPixel(x: number, y: number, color: Color): Promise<number> {
  const { nextAllowedAt } = await request<{ nextAllowedAt: number }>(
    `/pixels/${x}/${y}`,
    { method: "PUT", body: JSON.stringify({ color }) },
  );
  return nextAllowedAt;
}
