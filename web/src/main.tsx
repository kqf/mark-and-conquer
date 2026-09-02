import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The worker registers asynchronously, so the app must not render until it is
// listening — otherwise the first requests race it and escape to the real
// network. The dynamic import keeps MSW and the handlers out of the production
// bundle entirely: this branch is dead code in a build, so the bundler drops it.
async function startMocking() {
  if (!import.meta.env.DEV) return

  const { worker } = await import('./mocks/browser.ts')

  // "bypass" lets anything we have not written a handler for through to the
  // network without a warning. Use "warn" while building out the API if you
  // would rather be told about every request you forgot to mock.
  await worker.start({ onUnhandledRequest: 'bypass' })
}

startMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
