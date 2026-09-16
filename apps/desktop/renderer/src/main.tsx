import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { App } from './App';
import { ThemeProvider } from './lib/theme';
import { LanguageProvider } from './lib/i18n';
import { CartProvider } from './lib/cart';
import { setApiBase } from './lib/api';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

void window.cafestock?.getApiUrl().then(setApiBase);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <CartProvider>
          <QueryClientProvider client={queryClient}>
            <App />
            <Toaster position="top-right" richColors />
          </QueryClientProvider>
        </CartProvider>
      </ThemeProvider>
    </LanguageProvider>
  </React.StrictMode>,
);
