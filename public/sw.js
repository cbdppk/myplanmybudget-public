self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Baseline pass-through fetch handler to establish service-worker control.
self.addEventListener("fetch", () => {
  // Intentionally no-op for now.
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload?.title ?? "MyplanMybudget";
  const body = payload?.body ?? "You have a new reminder.";
  const url = payload?.url ?? "/reminders";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url ?? "/reminders";
  event.waitUntil(clients.openWindow(targetUrl));
});
