import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './app/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
