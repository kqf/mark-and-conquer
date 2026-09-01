import { useEffect, useState } from "react";
import { CooldownError, getBoard, getCooldown, getPixels, setPixel } from "./api";
import { BoardGrid } from "./Board";
import type { Board, Color, Pixel } from "./types";

export default function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [color, setColor] = useState<Color>("#FF4500");
  const [nextAllowedAt, setNextAllowedAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [pending, setPending] = useState(false);

  // Runs once, after the first render: load the board and its pixels.
  useEffect(() => {
    getBoard().then(setBoard);
    getPixels().then(setPixels);
    getCooldown().then(setNextAllowedAt);
  }, []);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, nextAllowedAt - Date.now()));
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [nextAllowedAt]);

  const locked = remaining > 0 || pending;

  // Paint locally first, then tell the server. Nobody should wait a round trip
  // to see their own click land.
  async function paint(x: number, y: number) {
    // Only a courtesy: it saves a doomed round trip. The server still checks.
    if (locked) return;
    setPending(true);

    setPixels((current) => [
      ...current.filter((p) => p.x !== x || p.y !== y),
      { x, y, color },
    ]);

    try {
      setNextAllowedAt(await setPixel(x, y, color));
    } catch (error) {
      // We were early after all — take the server's deadline over our own.
      if (error instanceof CooldownError) setNextAllowedAt(error.nextAllowedAt);

      // Either way the board on screen is now a lie. Ask the server what is
      // actually true and snap back to it.
      setPixels(await getPixels());
    } finally {
      setPending(false);
    }
  }

  if (!board) return <main>Loading…</main>;

  return (
    <main>
      <h1>Mark and Conquer</h1>
      <BoardGrid board={board} pixels={pixels} onPaint={paint} disabled={locked} />
      <p className="cooldown">
        {remaining > 0 ? `Next pixel in ${(remaining / 1000).toFixed(1)}s` : "Ready"}
      </p>
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
