// Wires the handlers to a Service Worker. `setupWorker` is the browser half of
// MSW; `setupServer` from "msw/node" is the other half, and both take exactly
// these handlers — which is why a mock written for the app is already a mock
// your tests can use.
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers.ts";

export const worker = setupWorker(...handlers);
