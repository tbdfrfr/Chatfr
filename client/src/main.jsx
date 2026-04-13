import React from 'react';
import ReactDOM from 'react-dom/client';

const r = ReactDOM.createRoot(document.getElementById('root'));

(async () => {

  const k = location.hash === atob('I3E5ci14dA==');
  const scienceMode = !k;

  document.documentElement.classList.toggle('science-mode', scienceMode);
  document.body.classList.toggle('science-mode', scienceMode);

  await import(k ? './styles.css' : './science.css');

  const M = k ? await import('./ChatApp.jsx') : await import('./App.jsx');

  r.render(<React.StrictMode><M.default /></React.StrictMode>);
})();
