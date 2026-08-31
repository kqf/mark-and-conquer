import { useEffect, useState } from "react";
import { getBoard, getPixels, setPixel } from "./api";
import { BoardGrid } from "./Board";
import type { Board, Color, Pixel } from "./types";

export default function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [color, setColor] = useState<Color>("#FF4500");

  // Runs once, after the first render: load the board and its pixels.
  useEffect(() => {
    getBoard().then(setBoard);
    getPixels().then(setPixels);
  }, []);

  async function paint(x: number, y: number) {
    await setPixel(x, y, color);
    setPixels(await getPixels());
  }

  if (!board) return <main>Loading…</main>;

  return (
    <main>
      <h1>Mark and Conquer</h1>
      <BoardGrid board={board} pixels={pixels} onPaint={paint} />
      <div className="palette">
        {board.palette.map((swatch) => (
          <button
            key={swatch}
            className={swatch === color ? "swatch selected" : "swatch"}
            style={{ background: swatch }}
            onClick={() => setColor(swatch)}
            title={swatch}
          />
        ))}
      </div>
    </main>
  );
}
