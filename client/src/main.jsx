import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import ChatApp from './ChatApp.jsx';

const r = ReactDOM.createRoot(document.getElementById('root'));

r.render(<React.StrictMode><ChatApp /></React.StrictMode>);
