// main.jsx: where the app starts. index.html has an empty <div id="root">;
// this renders <App /> into it. StrictMode adds extra checks during development only.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
