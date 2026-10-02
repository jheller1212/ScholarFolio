import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installGlobalErrorHandlers } from './lib/errorLogger';
import { captureCvPreset } from './lib/cvPreset';
import App from './App.tsx';
import './fonts.css';
import './index.css';

installGlobalErrorHandlers();
captureCvPreset();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
