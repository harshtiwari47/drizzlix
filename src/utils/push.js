// Helper to encode VAPID public key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications(token) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push messaging is not supported.');
  }

  const registration = await navigator.serviceWorker.ready;
  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID public key is not configured');

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  const baseUrl = import.meta.env.VITE_API_URL || '/api';
  const response = await fetch(`${baseUrl}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(subscription)
  });

  if (!response.ok) {
    throw new Error('Failed to store push subscription on server');
  }

  return subscription;
}

export async function unsubscribeFromPushNotifications(token) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }

  const baseUrl = import.meta.env.VITE_API_URL || '/api';
  await fetch(`${baseUrl}/push/unsubscribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}
