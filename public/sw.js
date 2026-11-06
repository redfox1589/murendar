/* Мурендарь service worker: push-уведомления */
const BEACON = 'https://hvesduszevnjtygnrqhh.supabase.co/functions/v1/api/beacon';

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const tag = data.tag || 'murendar';
  event.waitUntil(
    // Сначала маячок: фиксируем на сервере, что пуш дошёл до service worker
    fetch(BEACON + '?tag=' + encodeURIComponent(tag)).catch(() => {})
      .then(() =>
        self.registration.showNotification(data.title || 'Мур! Напоминание 🐾', {
          body: data.body || '',
          tag: tag,
          data: { url: data.url || './' },
        })
          .then(() => fetch(BEACON + '?tag=' + encodeURIComponent(tag + ':shown')).catch(() => {}))
          .catch((err) =>
            fetch(BEACON + '?tag=' + encodeURIComponent(tag + ':error:' + String(err && err.message || err).slice(0, 80))).catch(() => {})
          )
      )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
