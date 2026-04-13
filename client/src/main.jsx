import React from 'react';
import ReactDOM from 'react-dom/client';
import scienceStylesheetUrl from './science.css?url';
import chatStylesheetUrl from './styles.css?url';

const r = ReactDOM.createRoot(document.getElementById('root'));
const hiddenChatHash = atob('I3E5ci14dA==');
const stylesheetLinkId = 'chatfr-route-stylesheet';
let currentRoute = null;
let renderToken = 0;

async function renderRoute() {
  const nextRoute = location.hash === hiddenChatHash ? 'chat' : 'science';

  if (nextRoute === currentRoute) {
    return;
  }

  currentRoute = nextRoute;
  const nextToken = ++renderToken;

  document.documentElement.classList.toggle('science-mode', nextRoute === 'science');
  document.body.classList.toggle('science-mode', nextRoute === 'science');

  setRouteStylesheet(nextRoute === 'chat' ? chatStylesheetUrl : scienceStylesheetUrl);

  const Module = nextRoute === 'chat' ? await import('./ChatApp.jsx') : await import('./App.jsx');

  if (nextToken !== renderToken) {
    return;
  }

  r.render(<React.StrictMode><Module.default /></React.StrictMode>);
}

function setRouteStylesheet(href) {
  let link = document.getElementById(stylesheetLinkId);

  if (!link) {
    link = document.createElement('link');
    link.id = stylesheetLinkId;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  if (link.getAttribute('href') !== href) {
    link.setAttribute('href', href);
  }
}

window.addEventListener('hashchange', () => {
  renderRoute().catch((error) => {
    console.error('Failed to switch Chatfr route', error);
  });
});

renderRoute().catch((error) => {
  console.error('Failed to start Chatfr', error);
});
