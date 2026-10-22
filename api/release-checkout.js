// POST /api/release-checkout { session_id }
// Called when a buyer leaves Stripe Checkout with "back" / cancel, so an original
// they were holding becomes available again right away instead of after 30 minutes.
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const id = (req.body && req.body.session_id) || '';
  if (typeof id !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(id)) {
    res.status(400).json({ error: 'Invalid session.' });
    return;
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    if (session.status === 'open' && session.metadata && session.metadata.original) {
      await stripe.checkout.sessions.expire(id);
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Release checkout error:', err);
    res.status(200).json({ ok: false });
  }
};
