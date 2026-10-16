import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import App from './App'
import './index.css'
import { shouldRetryQuery, queryRetryDelay } from './lib/queryRetry'

// Lets plain CSS (which can't call Capacitor APIs) target one native platform specifically —
// e.g. `.platform-ios` for a WebKit-only quirk, `.platform-android` for a WebView-only one —
// instead of every such fix needing an inline Capacitor.getPlatform() check in a component.
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add(`platform-${Capacitor.getPlatform()}`)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: shouldRetryQuery, retryDelay: queryRetryDelay },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
