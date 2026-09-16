const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const VALID_SIZES = {
  '10 × 14': 50,
  '14 × 20': 80,
  '18 × 26': 140,
  '26 × 38': 220,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { artwork, size, image } = req.body || {};

  if (typeof artwork !== 'string' || !artwork.trim()) {
    res.status(400).json({ error: 'Missing artwork.' });
    return;
  }
  const amount = VALID_SIZES[size];
  if (!amount) {
    res.status(400).json({ error: 'Invalid print size.' });
    return;
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;
  const imageUrl = typeof image === 'string' && image.startsWith('http') ? image : undefined;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${artwork} — ${size} print`,
              images: imageUrl ? [imageUrl] : undefined,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      success_url: `${origin}/?order=success`,
      cancel_url: `${origin}/?order=cancelled`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout session error:', err);
    res.status(500).json({ error: 'Could not start checkout. Please try again shortly.' });
  }
};
