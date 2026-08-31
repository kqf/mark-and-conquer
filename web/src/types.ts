// A hex color, e.g. "#FF4500".
export type Color = string;

export type Pixel = {
  x: number;
  y: number;
  color: Color;
};

export type Board = {
  width: number;
  height: number;
  background: Color;
  palette: Color[];
};
