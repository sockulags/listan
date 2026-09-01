import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Overlay from './Overlay'
import Detail from './Detail'
import Settings from './Settings'

// The palette in main.css carries a full dark set behind .dark; the class is
// put on <html> here so every window follows the same theme.
function applyTheme(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark)
}

window.listan.getTheme().then(applyTheme)
window.listan.onTheme(applyTheme)

// One bundle serves every window; the hash says which one this is.
function route(): React.JSX.Element {
  const hash = window.location.hash.slice(1)

  if (hash === 'overlay') return <Overlay />
  if (hash === 'settings') return <Settings />
  if (hash.startsWith('row/')) return <Detail id={hash.slice(4)} />
  return <App />
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>{route()}</StrictMode>
)
