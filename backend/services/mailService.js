const nodemailer = require('nodemailer');

function configuration() {
  const { CALAR_SMTP_HOST, CALAR_SMTP_USER, CALAR_SMTP_PASSWORD, CALAR_MAIL_FROM, CALAR_PUBLIC_URL } = process.env;
  if (!CALAR_SMTP_HOST || !CALAR_SMTP_USER || !CALAR_SMTP_PASSWORD || !CALAR_MAIL_FROM || !CALAR_PUBLIC_URL) {
    throw new Error('SMTP configuration is missing');
  }
  const url = new URL(CALAR_PUBLIC_URL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid public URL');
  return { host: CALAR_SMTP_HOST, user: CALAR_SMTP_USER, password: CALAR_SMTP_PASSWORD, from: CALAR_MAIL_FROM, url };
}

async function sendLink(email, token, kind) {
  const config = configuration();
  const verification = kind === 'verification';
  const url = new URL(verification ? '/verify-email' : '/reset-password', config.url);
  // Fragment avoids exposing the token in server access logs and Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  const transport = nodemailer.createTransport({
    host: config.host,
    port: Number(process.env.CALAR_SMTP_PORT || 587),
    secure: process.env.CALAR_SMTP_SECURE === 'true',
    requireTLS: process.env.CALAR_SMTP_SECURE !== 'true',
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10000, socketTimeout: 15000,
  });
  await transport.sendMail({
    from: config.from, to: email, subject: verification ? '[월계] 이메일 인증' : '[월계] 비밀번호 재설정',
    text: `${verification ? '아래 링크에서 이메일 인증을 완료해 주세요.' : '아래 링크에서 새 비밀번호를 설정해 주세요.'} 링크는 15분 동안 한 번만 사용할 수 있습니다.\n\n${url}\n\n요청하지 않으셨다면 이 메일을 무시해 주세요.`,
  });
}

module.exports = {
  configuration,
  sendPasswordReset: (email, token) => sendLink(email, token, 'recovery'),
  sendVerification: (email, token) => sendLink(email, token, 'verification'),
};
