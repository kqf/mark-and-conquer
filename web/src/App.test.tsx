import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import App from "./App.tsx";
import { server } from "./mocks/server.ts";

// The app asks for these three on mount; pin them so no test depends on the
// mock backend's leftover state.
function boot(pixels: { x: number; y: number; color: string }[] = [], nextAllowedAt = 0) {
  server.use(
    http.get("/api/pixels", () => HttpResponse.json(pixels)),
    http.get("/api/cooldown", () => HttpResponse.json({ nextAllowedAt })),
  );
}

const cell = (x: number, y: number) => screen.getByTitle(`${x},${y}`);

describe("App", () => {
  it("waits for the board before drawing anything", async () => {
    boot();
    render(<App />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "Mark and Conquer" }))
      .toBeInTheDocument();
  });

  it("draws a cell per board coordinate and a swatch per palette color", async () => {
    boot();
    render(<App />);
    await screen.findByRole("heading", { name: "Mark and Conquer" });

    expect(document.querySelectorAll(".cell")).toHaveLength(32 * 32);
    expect(document.querySelectorAll(".swatch")).toHaveLength(10);
  });

  it("paints the pixels the server already has", async () => {
    boot([{ x: 1, y: 2, color: "#FF4500" }]);
    render(<App />);
    await screen.findByRole("heading", { name: "Mark and Conquer" });

    expect(cell(1, 2)).toHaveStyle({ background: "rgb(255, 69, 0)" });
    expect(cell(0, 0)).toHaveStyle({ background: "rgb(255, 255, 255)" });
  });

  it("selects the swatch you click", async () => {
    boot();
    render(<App />);
    await screen.findByRole("heading", { name: "Mark and Conquer" });

    const blue = screen.getByTitle("#2450A4");
    await userEvent.click(blue);

    expect(blue).toHaveClass("selected");
    expect(screen.getByTitle("#FF4500")).not.toHaveClass("selected");
  });

  it("paints optimistically and then starts the cooldown", async () => {
    boot();
    server.use(
      http.put("/api/pixels/:x/:y", () =>
        HttpResponse.json({ nextAllowedAt: Date.now() + 5000 }),
      ),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Mark and Conquer" });

    await userEvent.click(cell(3, 4));

    expect(cell(3, 4)).toHaveStyle({ background: "rgb(255, 69, 0)" });
    await waitFor(() => expect(screen.getByText(/Next pixel in/)).toBeInTheDocument());
    await waitFor(() => expect(cell(0, 0)).toBeDisabled());
  });

  it("snaps back to the server's truth when a write is rejected", async () => {
    boot();
    server.use(
      http.put("/api/pixels/:x/:y", () =>
        HttpResponse.json({ error: "the server rejected the write" }, { status: 500 }),
      ),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Mark and Conquer" });

    await userEvent.click(cell(3, 4));

    // The optimistic paint landed, then the refetch wiped it.
    await waitFor(() =>
      expect(cell(3, 4)).toHaveStyle({ background: "rgb(255, 255, 255)" }),
    );
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("takes the server's deadline when it says we were early", async () => {
    boot();
    server.use(
      http.put("/api/pixels/:x/:y", () =>
        HttpResponse.json({ nextAllowedAt: Date.now() + 5000 }, { status: 429 }),
      ),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Mark and Conquer" });

    await userEvent.click(cell(3, 4));

    await waitFor(() => expect(screen.getByText(/Next pixel in/)).toBeInTheDocument());
  });

  it("ignores clicks while the cooldown is running", async () => {
    boot([], Date.now() + 5000);
    render(<App />);
    await screen.findByRole("heading", { name: "Mark and Conquer" });

    await waitFor(() => expect(cell(3, 4)).toBeDisabled());

    // No PUT handler is registered, so a leaked request would fail the test.
    const board = document.querySelector(".board") as HTMLElement;
    await userEvent.click(within(board).getByTitle("3,4"), { pointerEventsCheck: 0 });

    expect(cell(3, 4)).toHaveStyle({ background: "rgb(255, 255, 255)" });
  });
});
