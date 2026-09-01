import type { Board, Pixel } from "./types";

type Props = {
  board: Board;
  pixels: Pixel[];
  onPaint: (x: number, y: number) => void;
  disabled: boolean;
};

export function BoardGrid({ board, pixels, onPaint, disabled }: Props) {
  const painted = new Map(pixels.map((p) => [`${p.x},${p.y}`, p.color]));

  const cells = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const key = `${x},${y}`;
      cells.push(
        <button
          key={key}
          className="cell"
          style={{ background: painted.get(key) ?? board.background }}
          onClick={() => onPaint(x, y)}
          disabled={disabled}
          title={key}
        />,
      );
    }
  }

  return (
    <div
      className="board"
      style={{ gridTemplateColumns: `repeat(${board.width}, 16px)` }}
    >
      {cells}
    </div>
  );
}
