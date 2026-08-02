import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <main><h1>Northstar Studio</h1><p>Product strategy and delivery for growing teams.</p></main>;
}

const mount = document.querySelector('#app');
if (mount) createRoot(mount).render(<App />);
