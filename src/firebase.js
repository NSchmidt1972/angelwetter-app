// src/firebase.js

import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Dein Firebase Config (einfach hier reinkopiert):
const firebaseConfig = {
  apiKey: "AIzaSyDqI809hFmeQ-K_eJSTgPPiVQPcDdavlmA",
  authDomain: "angelwetter-app.firebaseapp.com",
  projectId: "angelwetter-app",
  storageBucket: "angelwetter-app.appspot.com",
  messagingSenderId: "656005849246",
  appId: "1:656005849246:web:330d523db82e6e64541b8f",
  measurementId: "G-HRCMPRWC6D"
};

// Initialisiere Firebase App
const app = initializeApp(firebaseConfig);

// Initialisiere Cloud Messaging (für Push)
const messaging = getMessaging(app);

// Exportiere Messaging + Token Funktionen, damit du überall importieren kannst
export { messaging, getToken, onMessage };
