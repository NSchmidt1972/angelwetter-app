import React from 'react';
import ReactDOM from 'react-dom/client';
import SuperAdminApp from './SuperAdminApp';
import { AuthProvider } from './AuthContext';
import './index.css';
import './styles/tokens.css';
import './styles/themes/light.css';
import './styles/themes/dark.css';
import './styles/base.css';
import { installGlobalErrorMonitoring } from '@/services/opsAlert';

installGlobalErrorMonitoring();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SuperAdminApp />
    </AuthProvider>
  </React.StrictMode>,
);
