import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { initSentry } from './lib/sentry'
import './index.css'
import App from './App.tsx'
import { useAuthStore } from './store/auth-store'
import { ErrorBoundary } from './components/ErrorBoundary'

// Initialize Sentry BEFORE rendering (catches early errors)
initSentry();

function AppWrapper() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppWrapper />
    </ErrorBoundary>
  </StrictMode>,
)
