import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installGlobalErrorHandlers } from './lib/errorLogger';
import App from './App.tsx';
import './fonts.css';
import './index.css';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
