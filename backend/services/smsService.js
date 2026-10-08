const { createHmac, randomBytes } = require('node:crypto');
const HttpError = require('../utils/httpError');

function configuration() {
  const key = process.env.SOLAPI_API_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV === 'production') throw new HttpError(503, 'SMS authentication is not configured');
    return { mock: true };
  }
  const secret = process.env.SOLAPI_API_SECRET?.trim();
  const sender = (process.env.SOLAPI_SENDER || '').replace(/\D/g, '');
  if (!secret || !/^0\d{8,10}$/.test(sender)) throw new HttpError(503, 'SMS authentication is not configured');
  return { key, secret, sender, mock: false };
}

function authorization(config) {
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString('hex');
  const signature = createHmac('sha256', config.secret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${config.key}, date=${date}, salt=${salt}, signature=${signature}`;
}

function codeMessage(code, appHash, ios = false) {
  if (appHash && !/^[A-Za-z0-9+/]{11}$/.test(appHash)) throw new HttpError(400, 'Invalid app hash');
  if (appHash) return `<#> [CALAR] Code: ${code} (10 min)\n${appHash}`;
  let domain;
  try { const url = new URL(process.env.CALAR_PUBLIC_URL); if (!ios && url.protocol === 'https:') domain = url.hostname; } catch { /* Plain SMS works without a public domain. */ }
  return `[CALAR] Code: ${code} (10 min)${domain ? `\n@${domain} #${code}` : ''}`;
}
async function sendCode(phone, code, appHash, ios = false) {
  const config = configuration();
  if (config.mock) return { mock: true };
  let response, data;
  try {
    response = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: authorization(config), 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ to: `0${phone.slice(3)}`, from: config.sender, type: 'SMS', text: codeMessage(code, appHash, ios) }] }),
    });
    data = await response.json();
  } catch { throw new HttpError(503, 'SMS provider unavailable'); }
  if (!response.ok || data.failedMessageList?.length || !data.groupInfo?.count?.registeredSuccess) {
    console.error('[SOLAPI] SMS submission failed:', response.status, data.errorCode || data.failedMessageList?.[0]?.statusCode || 'submission rejected');
    if (response.status === 429) throw new HttpError(429, 'Too many SMS attempts');
    throw new HttpError(503, 'SMS provider unavailable');
  }
  return { mock: false };
}

module.exports = { configuration, authorization, sendCode, codeMessage };
