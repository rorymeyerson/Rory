// Sends a notification email to Avigail through Resend (same setup as the commission form).
const TO = process.env.ORDERS_TO || process.env.COMMISSION_TO || 'meyersonavigail@gmail.com';
const FROM = process.env.ORDERS_FROM || 'Art by Avigail Orders <orders@avigailmeyerson.com>';
const FALLBACK_FROM = 'Art by Avigail <onboarding@resend.dev>';

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// rows: [[label, value], ...]
async function notify(subject, intro, rows = []) {
  if (!process.env.RESEND_API_KEY) return false;
  const text = [intro, '', ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;color:#271d19;max-width:600px;font-size:14px;line-height:1.6">
      <p>${escapeHtml(intro).replace(/\n/g, '<br>')}</p>
      <table style="border-collapse:collapse">
        ${rows.map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#6b5c54;vertical-align:top">${escapeHtml(k)}</td><td style="padding:3px 0"><strong>${escapeHtml(v).replace(/\n/g, '<br>')}</strong></td></tr>`).join('')}
      </table>
    </div>`;
  const send = from => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [TO], subject, text, html }),
  });
  try {
    let r = await send(FROM);
    if (!r.ok && (r.status === 403 || r.status === 422)) r = await send(FALLBACK_FROM);
    if (!r.ok) console.error('Order email failed:', r.status, await r.text());
    return r.ok;
  } catch (err) {
    console.error('Order email error:', err);
    return false;
  }
}

module.exports = { notify };
