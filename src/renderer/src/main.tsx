import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Overlay from './Overlay'

// The palette in main.css carries a full dark set behind .dark; the class is
// put on <html> here so both windows follow the system theme.
function applyTheme(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark)
}

window.listan.getTheme().then(applyTheme)
window.listan.onTheme(applyTheme)

// One bundle serves both windows; the overlay is loaded with #overlay.
const isOverlay = window.location.hash === '#overlay'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>{isOverlay ? <Overlay /> : <App />}</StrictMode>
)
