importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

// Deine Firebase Config HIER identisch wie in deiner src/firebase.js
firebase.initializeApp({
  apiKey: "AIzaSyDqI809hFmeQ-K_eJSTgPPiVQPcDdavlmA",
  authDomain: "angelwetter-app.firebaseapp.com",
  projectId: "angelwetter-app",
  storageBucket: "angelwetter-app.appspot.com",
  messagingSenderId: "656005849246",
  appId: "1:656005849246:web:330d523db82e6e64541b8f",
  measurementId: "G-HRCMPRWC6D"
});

// Initialisiere Messaging
const messaging = firebase.messaging();

// Verarbeitung eingehender Hintergrund-Pushes:
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Hintergrundnachricht empfangen', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/logo.png'  // optional dein App-Icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
