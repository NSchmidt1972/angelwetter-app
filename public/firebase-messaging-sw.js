importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

// Deine Initialisierung
firebase.initializeApp({
  apiKey: "...",
  // Rest siehe oben
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('Hintergrund-Push erhalten:', payload);
  const { title, body } = payload.notification;
  self.registration.showNotification(title, { body });
});

