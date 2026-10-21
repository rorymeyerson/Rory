// Receives the commission request form and emails it to Avigail via Resend
// (https://resend.com). Requires the RESEND_API_KEY environment variable in Vercel.
//
// Optional environment variables:
//   COMMISSION_TO   - where requests go (default: meyersonavigail@gmail.com)
//   COMMISSION_FROM - sender address (default: Resend's shared test sender, which can
//                     only deliver to the email the Resend account was created with;
//                     after verifying avigailmeyerson.com in Resend, set this to e.g.
//                     "Art by Avigail <requests@avigailmeyerson.com>")

const TO = process.env.COMMISSION_TO || 'meyersonavigail@gmail.com';
const FROM = process.env.COMMISSION_FROM || 'Art by Avigail <onboarding@resend.dev>';
const MAX_PHOTOS = 5;
const MAX_TOTAL_BYTES = 3.5 * 1024 * 1024; // keeps the request under Vercel's 4.5 MB body limit

const clean = (value, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    // Not set up yet: the page falls back to opening the visitor's email app.
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  const body = req.body || {};

  // Hidden "website" field: real visitors leave it empty, spam bots fill it in.
  if (clean(body.website)) {
    res.status(200).json({ ok: true });
    return;
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const phone = clean(body.phone, 60);
  const type = clean(body.type, 120);
  const details = clean(body.details, 5000);

  if (!name || !type || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please fill in your name, a valid email, and the commission type.' });
    return;
  }

  const photos = Array.isArray(body.photos) ? body.photos.slice(0, MAX_PHOTOS) : [];
  let totalBytes = 0;
  const attachments = [];
  for (const [i, photo] of photos.entries()) {
    const content = photo && typeof photo.content === 'string' ? photo.content : '';
    if (!/^[A-Za-z0-9+/=]+$/.test(content)) continue;
    totalBytes += Math.floor(content.length * 0.75);
    if (totalBytes > MAX_TOTAL_BYTES) {
      res.status(413).json({ error: 'Your photos are too large to send together. Please choose fewer photos.' });
      return;
    }
    const base = clean(photo.filename, 80).replace(/[^\w.\- ]+/g, '').replace(/\.[^.]*$/, '') || `reference-${i + 1}`;
    attachments.push({ filename: `${base}.jpg`, content });
  }

  const lines = [
    ['Name', name],
    ['Email', email],
    ['Phone', phone || '-'],
    ['Commission type', type],
    ['Reference photos', attachments.length ? `${attachments.length} attached` : 'none'],
  ];

  const text = [...lines.map(([k, v]) => `${k}: ${v}`), '', 'Their idea:', details || '(no details given)', '', 'Reply to this email to answer them directly.'].join('\n');
  const html = `
    <div style="font-family:Georgia,serif;color:#271d19;max-width:600px">
      <h2 style="font-weight:500;margin:0 0 16px">New commission request</h2>
      <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
        ${lines.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#6b5c54">${k}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`).join('')}
      </table>
      <h3 style="font-weight:500;margin:24px 0 8px">Their idea</h3>
      <p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(details || '(no details given)')}</p>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#6b5c54;margin-top:24px">Reply to this email to answer ${escapeHtml(name)} directly.</p>
    </div>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `Commission request: ${type} from ${name}`,
        text,
        html,
        attachments: attachments.length ? attachments : undefined,
      }),
    });

    if (!response.ok) {
      console.error('Resend error:', response.status, await response.text());
      res.status(502).json({ error: 'send_failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Commission request error:', err);
    res.status(502).json({ error: 'send_failed' });
  }
};
