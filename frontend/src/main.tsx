import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import { isUnauthorized } from './apiError'

const queryClient = new QueryClient({
  // Retrying does not help without a login; show the login right away.
  defaultOptions: { queries: { retry: (failures, error) => !isUnauthorized(error) && failures < 3 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
