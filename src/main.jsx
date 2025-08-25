// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './AuthContext';
import './index.css';

// ✅ KEINE eigene Service Worker Registrierung hier.
// OneSignal + VitePWA kümmern sich darum (PushInit in App.jsx initialisiert OneSignal).

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
