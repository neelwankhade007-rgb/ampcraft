import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { HistoryProvider } from './context/HistoryContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HistoryProvider>
      <App />
    </HistoryProvider>
  </StrictMode>
)
