// POST /api/stripe-webhook — Stripe calls this when a checkout is paid.
//
// Stripe setup: Dashboard → Developers → Webhooks → Add endpoint
//   URL:    https://www.avigailmeyerson.com/api/stripe-webhook
//   Event:  checkout.session.completed
//
// Security: the notification body is not trusted. Only its event id is read,
// and the event and order are then fetched directly from Stripe with the
// secret key, so a fake request can't create an order.
//
// What happens for each paid order:
//   - Print with a FinerWorks SKU  -> order placed with FinerWorks automatically
//   - Print or kesubah print with a FinerWorks SKU -> placed with FinerWorks automatically
//   - Print without a SKU, or an original -> Gail is emailed to handle it
// Stripe is the record: the result is saved on the payment (metadata
// finerworks_order / finerworks_status), so repeat notifications never
// place a second order.
const Stripe = require('stripe');
const { isConfigured, skuFor, recipientFrom, submitOrder } = require('./_finerworks');
const { notify } = require('./_email');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = req.body;
  if (raw === undefined) {
    raw = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  return JSON.parse(raw.toString());
}

const money = cents => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

function shippingOf(session) {
  const ship = (session.collected_information && session.collected_information.shipping_details) || session.shipping_details;
  const cust = session.customer_details || {};
  if (!ship || !ship.address) return null;
  return { name: ship.name || cust.name, address: ship.address, phone: cust.phone, email: cust.email };
}

function addressLines(s) {
  if (!s) return 'not collected';
  const a = s.address;
  return [s.name, a.line1, a.line2, `${a.city || ''}${a.state ? ', ' + a.state : ''} ${a.postal_code || ''}`.trim(), a.country].filter(Boolean).join('\n');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let eventId;
  try {
    eventId = (await readBody(req)).id;
  } catch (e) {
    res.status(400).json({ error: 'Bad request' });
    return;
  }
  if (typeof eventId !== 'string' || !/^evt_[A-Za-z0-9_]+$/.test(eventId)) {
    res.status(400).json({ error: 'Bad request' });
    return;
  }

  try {
    const event = await stripe.events.retrieve(eventId);
    if (event.type !== 'checkout.session.completed') {
      res.status(200).json({ ignored: event.type });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(event.data.object.id, { expand: ['payment_intent'] });
    const pi = session.payment_intent;
    if (session.payment_status !== 'paid' || !pi || typeof pi !== 'object') {
      res.status(200).json({ ignored: 'not paid' });
      return;
    }

    const meta = session.metadata || {};
    const piMeta = pi.metadata || {};
    if (piMeta.finerworks_order || piMeta.finerworks_status === 'handled') {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    const product = meta.product || (meta.original ? 'original' : '');
    const artwork = meta.artwork || meta.original || '(unknown — see Stripe)';
    const size = meta.size || '';
    const ship = shippingOf(session);
    const rows = [
      ['Artwork', artwork],
      ['Item', product === 'original' ? 'Original painting' : product === 'kesubah' ? `Kesubah print, ${size}` : `Print, ${size}`],
      ['Paid', money(session.amount_total || 0)],
      ['Buyer email', (session.customer_details || {}).email || '-'],
      ['Ship to', addressLines(ship)],
      ['Stripe payment', pi.id],
    ];
    const markHandled = extra => stripe.paymentIntents.update(pi.id, { metadata: { finerworks_status: 'handled', ...extra } });

    // Things FinerWorks shouldn't print automatically: Gail handles these herself.
    let manualReason = '';
    if (product === 'original') manualReason = 'This is the ORIGINAL painting, so it ships from you, not FinerWorks.';
    else if (!product || !size) manualReason = 'This order was placed before automatic printing was set up.';
    else if (!skuFor(artwork, size, product)) manualReason = `There is no FinerWorks SKU yet for “${artwork}” at ${size} (api/_finerworks.js), so please place this print order in FinerWorks yourself.`;
    else if (!isConfigured()) manualReason = 'FinerWorks API keys are not set in Vercel yet, so please place this print order in FinerWorks yourself.';
    else if (!ship) manualReason = 'Stripe did not collect a shipping address for this order.';

    if (manualReason) {
      await notify(`New order to handle: ${artwork}`, `A new order was paid on avigailmeyerson.com.\n${manualReason}`, rows);
      await markHandled({ finerworks_note: manualReason.slice(0, 450) });
      res.status(200).json({ ok: true, manual: true });
      return;
    }

    try {
      const { orderId, testMode } = await submitOrder({
        orderPo: pi.id,
        recipient: recipientFrom(ship),
        sku: skuFor(artwork, size, product),
        title: `${artwork} ${size}`,
      });
      await stripe.paymentIntents.update(pi.id, {
        metadata: { finerworks_order: orderId, finerworks_test: String(testMode), finerworks_status: 'handled' },
      });
      await notify(
        `${testMode ? '[TEST] ' : ''}Print order sent to FinerWorks: ${artwork}`,
        testMode
          ? 'A print was paid for and sent to FinerWorks in TEST MODE. It will NOT be printed. Set FINERWORKS_LIVE=true in Vercel to place real orders.'
          : 'A print was paid for and automatically sent to FinerWorks for printing and shipping. Nothing for you to do.',
        [...rows, ['FinerWorks order', orderId]],
      );
      res.status(200).json({ ok: true, finerworks_order: orderId });
    } catch (err) {
      // Tell Gail once; Stripe will keep retrying the notification for up to 3 days.
      console.error(err);
      if (piMeta.finerworks_status !== 'failed') {
        await notify(
          `Action needed: print order not sent to FinerWorks (${artwork})`,
          `A print was paid for, but sending it to FinerWorks failed. The site will keep retrying automatically; if you don't get a "sent to FinerWorks" email soon, please place it in FinerWorks by hand.\n\nError: ${err.message}`,
          rows,
        );
        await stripe.paymentIntents.update(pi.id, { metadata: { finerworks_status: 'failed', finerworks_error: err.message.slice(0, 450) } });
      }
      res.status(500).json({ error: 'FinerWorks submission failed; will retry' });
    }
  } catch (err) {
    console.error('Stripe webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
