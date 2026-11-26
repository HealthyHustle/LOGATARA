// Live User Auth & Onboarding Event Logger -> n8n Webhook -> Google Sheets
// Never transmits plaintext passwords; sends non-blocking telemetry with 8s timeout.

const DEFAULT_USER_EVENTS_WEBHOOK_URL =
  'https://dpwppijabar.app.n8n.cloud/webhook/logatara-user-events';

function getUserEventsWebhookUrl() {
  if (process.env.N8N_USER_EVENTS_WEBHOOK_URL !== undefined) {
    return process.env.N8N_USER_EVENTS_WEBHOOK_URL.trim();
  }
  return DEFAULT_USER_EVENTS_WEBHOOK_URL;
}

export function formatWibTimestamp(date = new Date()) {
  try {
    return (
      date.toLocaleString('sv-SE', {
        timeZone: 'Asia/Jakarta',
        hour12: false,
      }) + ' WIB'
    );
  } catch {
    return date.toISOString();
  }
}

export function summarizeUserAgent(rawUa = '') {
  const ua = String(rawUa || '');
  if (!ua) return 'Unknown Client';
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(ua);
  const os = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iOS/i.test(ua)
      ? 'iOS'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac OS/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Other';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome\//i.test(ua)
      ? 'Chrome'
      : /Firefox\//i.test(ua)
        ? 'Firefox'
        : /Safari\//i.test(ua)
          ? 'Safari'
          : ua.slice(0, 32);
  return `${isMobile ? 'Mobile' : 'Desktop'} ${browser} / ${os}`;
}

export function logUserEventLive({
  event,
  userId = 0,
  fullName = '-',
  email = '-',
  status = 'BERHASIL',
  knownLanguages = '-',
  targetLanguage = '-',
  currentLevel = 1,
  totalXp = 0,
  source = 'Localhost',
  userAgent = '',
}) {
  const webhookUrl = getUserEventsWebhookUrl();
  if (!webhookUrl) return;

  const payload = {
    timestamp: formatWibTimestamp(),
    event: String(event || 'LOGIN'),
    userId: Number(userId || 0),
    fullName: String(fullName || '-'),
    email: String(email || '-'),
    status: String(status || 'BERHASIL'),
    knownLanguages: String(knownLanguages || '-'),
    targetLanguage: String(targetLanguage || '-'),
    currentLevel: Number(currentLevel || 1),
    totalXp: Number(totalXp || 0),
    source: String(source || 'Localhost'),
    userAgent: summarizeUserAgent(userAgent),
  };

  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  }).catch((err) => {
    console.warn('[LOGATARA User Event Logger] Failed to push event to n8n:', err?.message || err);
  });
}
