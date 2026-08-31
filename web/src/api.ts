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

export async function setPixel(x: number, y: number, color: Color): Promise<void> {
  await delay();
  pixels.set(`${x},${y}`, color);
  save();
}
