import { expect, test, type Page } from "@playwright/test";

// A few of the palette entries from api/markandconquer/app.py. The server
// rejects anything that is not in that list, so these have to match it.
const RED = "#FF4500"; // what App.tsx starts with selected
const GREEN = "#00A368";
const BLUE = "#2450A4";
const BLANK = "#FFFFFF"; // BOARD.background

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const cellAt = (page: Page, x: number, y: number) =>
  page.getByTitle(`${x},${y}`, { exact: true });

const swatch = (page: Page, color: string) =>
  page.getByTitle(color, { exact: true });

const cooldown = (page: Page) => page.locator(".cooldown");

test("loads the board and palette the API serves", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Mark and Conquer" })).toBeVisible();

  // 32x32 and ten colors come from BOARD in app.py. If the SPA were talking to
  // anything other than the real API, it would not know that.
  await expect(page.locator(".cell")).toHaveCount(32 * 32);
  await expect(page.locator(".swatch")).toHaveCount(10);

  // A visitor who has never painted has no cooldown to restore.
  await expect(cooldown(page)).toHaveText("Ready");
});

test("paints a pixel in the selected color and starts the cooldown", async ({ page }) => {
  await page.goto("/");

  const cell = cellAt(page, 1, 1);
  await expect(cell).toHaveCSS("background-color", rgb(BLANK));

  await swatch(page, GREEN).click();
  await cell.click();

  await expect(cell).toHaveCSS("background-color", rgb(GREEN));

  // The deadline in that text came back from the PUT, so seeing it means the
  // write reached Flask and Flask answered.
  await expect(cooldown(page)).toHaveText(/^Next pixel in \d+\.\d+s$/);
  await expect(cell).toBeDisabled();
});

test("stores the pixel server-side, for this visitor and for everyone", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await swatch(page, BLUE).click();
  await cellAt(page, 5, 7).click();
  await expect(cellAt(page, 5, 7)).toHaveCSS("background-color", rgb(BLUE));

  // App.tsx paints optimistically, so the click alone proves nothing. A reload
  // throws that away and asks the database.
  await page.reload();
  await expect(cellAt(page, 5, 7)).toHaveCSS("background-color", rgb(BLUE));

  // A second context is a second cookie, which the server reads as a second
  // person: same board, own cooldown.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/");

  await expect(cellAt(otherPage, 5, 7)).toHaveCSS("background-color", rgb(BLUE));
  await expect(cooldown(otherPage)).toHaveText("Ready");

  await other.close();
});

test("holds the board locked until the cooldown expires", async ({ page }) => {
  await page.goto("/");
  await cellAt(page, 10, 10).click();

  // The whole board goes, not just the cell that was clicked.
  await expect(cellAt(page, 11, 10)).toBeDisabled();

  // COOLDOWN_MS is 5s of real time; the timeout is slack, not an expectation.
  await expect(cooldown(page)).toHaveText("Ready", { timeout: 15_000 });

  await cellAt(page, 11, 10).click();
  await expect(cellAt(page, 11, 10)).toHaveCSS("background-color", rgb(RED));
});
