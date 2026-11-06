/* A/B-тест: отправка через эталонную библиотеку web-push */
const fs = require('fs');
const webpush = require('web-push');

const VAPID_PUBLIC = 'BFaRFw0A7ycW_QXoZv24EL8lcXr0zDBUg8JkoZ5LtNWbvRnxtWaqJNTpLOnk8vca-DEJc9yXVIjSwpMVP-6mAb4';
const VAPID_PRIVATE = 'hR6jpZFPjDxzE2Wv4u-FFguszhhtZ3dA1CMVwddZ0Pk';

webpush.setVapidDetails('mailto:murendar@redfox1589.github.io', VAPID_PUBLIC, VAPID_PRIVATE);

(async () => {
  const subs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))[0].subs;
  console.log('subscriptions:', subs.length);
  for (const sub of subs) {
    try {
      const res = await webpush.sendNotification(sub, JSON.stringify({
        title: 'Мур! Тест v2 🐾',
        body: 'Этот отправлен эталонной библиотекой',
        tag: 'manual-test-2',
        url: './',
      }), { TTL: 3600, urgency: 'high' });
      console.log(sub.endpoint.slice(0, 50), '→', res.statusCode);
    } catch (e) {
      console.log(sub.endpoint.slice(0, 50), '→ ERROR', e.statusCode || '', e.message.slice(0, 150));
    }
  }
})();
