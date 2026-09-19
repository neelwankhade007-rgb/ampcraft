import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import LandingPage from './components/LandingPage.jsx'
import { HistoryProvider } from './context/HistoryContext'

function Root() {
  const [view, setView] = useState('landing') // 'landing' | 'studio'
  const [initialModule, setInitialModule] = useState('separator')

  // Toggle scrolling: landing page needs scroll, studio needs overflow hidden
  useEffect(() => {
    const root = document.getElementById('root')
    if (view === 'landing') {
      document.documentElement.classList.add('lp-scroll')
      document.body.classList.add('lp-scroll')
      root?.classList.add('lp-scroll')
    } else {
      document.documentElement.classList.remove('lp-scroll')
      document.body.classList.remove('lp-scroll')
      root?.classList.remove('lp-scroll')
    }
  }, [view])

  if (view === 'landing') {
    return <LandingPage onOpenStudio={(mod = 'separator') => {
      setInitialModule(mod)
      setView('studio')
    }} />
  }

  return <App initialModule={initialModule} onNavigateHome={() => setView('landing')} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HistoryProvider>
      <Root />
    </HistoryProvider>
  </StrictMode>
)
