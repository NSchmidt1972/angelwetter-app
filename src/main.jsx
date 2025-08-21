import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './AuthContext';
import './index.css';


// ✅ KEINE eigene Service Worker Registrierung mehr nötig.
// OneSignal übernimmt die Registrierung automatisch.



ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
