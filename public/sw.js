self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || '🎣 Neuer Fang', {
      body: data.body || 'Ein neuer Fang wurde eingetragen!',
      icon: '/icons/icon-192.png'
    })
  );
});
