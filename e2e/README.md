# End-to-end tests

These drive a real browser against the **production artifact**: the SPA that
`npm run build` produces, served by Flask on one origin next to the real API
and a real SQLite database. Nothing is mocked — MSW is dev-only (see
`web/src/main.tsx`), so a built bundle talks to Flask and only to Flask.

That is the point of this layer. `web`'s vitest suite already proves the
components behave against fake handlers, and `api`'s pytest suite already
proves the routes behave against a test client. What neither can catch is the
seam between them: a renamed field, a path that does not route, a cookie that
does not survive, a bundle that never got rebuilt.

## Running them

    cd e2e
    npm ci
    npx playwright install chromium   # once
    npm test

`npm test` builds `web/`, starts Flask on a throwaway database, runs the specs,
and stops the server. Nothing is left behind.

    npm run test:headed    # watch it happen
    npm run test:ui        # Playwright's interactive runner
    npm run report         # open the HTML report from the last run

## Pointing them somewhere else

Set `E2E_BASE_URL` and the specs run against whatever is already listening
instead of starting their own server. The same suite then covers the container
and the deployment:

    docker build -t mark-and-conquer .
    docker run --rm -p 8080:8080 mark-and-conquer
    E2E_BASE_URL=http://127.0.0.1:8080 npm test

    E2E_BASE_URL=https://mark-and-conquer.example.com npm test

Against a shared deployment the specs paint real pixels on the real board, so
prefer a throwaway instance.

## Writing more

Keep them few and keep them about the seam. Both the cells and the palette
swatches carry a `title`, so `cellAt(page, x, y)` and `swatch(page, color)` in
`tests/board.spec.ts` are all the selectors anyone should need.

The board is shared mutable state and the cooldown is five seconds of real
time, so the suite runs on a single worker and each spec paints its own
coordinates. Take a fresh coordinate when you add one.
