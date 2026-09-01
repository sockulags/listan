import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Overlay from './Overlay'

// One bundle serves both windows; the overlay is loaded with #overlay.
const isOverlay = window.location.hash === '#overlay'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>{isOverlay ? <Overlay /> : <App />}</StrictMode>
)
