const Stripe = require('stripe');
const { ORIGINALS, RESERVATION_MINUTES, originalStatus } = require('./_originals');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  watercolor: {
    '10 × 14': 50,
    '14 × 20': 80,
    '18 × 26': 140,
    '26 × 38': 220,
  },
  kesubah: {
    '12 × 18': 300,
  },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { artwork, size, image, product = 'watercolor' } = req.body || {};
  const isOriginal = product === 'original';
  const sizes = isOriginal ? { Original: ORIGINALS[artwork] } : PRICES[product];
  if (!sizes) {
    res.status(400).json({ error: 'Invalid product.' });
    return;
  }

  if (typeof artwork !== 'string' || !artwork.trim()) {
    res.status(400).json({ error: 'Missing artwork.' });
    return;
  }
  const amount = sizes[size];
  if (!amount) {
    res.status(400).json({ error: isOriginal ? 'This original is not available.' : 'Invalid print size.' });
    return;
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;
  const imageUrl = typeof image === 'string' && image.startsWith('http') ? image : undefined;

  try {
    if (isOriginal) {
      // Only one buyer can ever pay for an original.
      const status = await originalStatus(stripe, artwork);
      if (status === 'sold') {
        res.status(409).json({ error: 'Sorry, this original painting has already been sold.', sold: true });
        return;
      }
      if (status === 'reserved') {
        res.status(409).json({ error: 'Someone is checking out with this painting right now. If they don’t complete the purchase, it will be available again within 30 minutes.' });
        return;
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: isOriginal
                ? `${artwork} — original watercolor painting`
                : `${artwork} — ${size} ${product === 'kesubah' ? 'kesubah print' : 'print'}`,
              images: imageUrl ? [imageUrl] : undefined,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      success_url: `${origin}/?order=success`,
      cancel_url: `${origin}/?order=cancelled&cs={CHECKOUT_SESSION_ID}`,
      ...(isOriginal && {
        metadata: { original: artwork },
        payment_intent_data: { metadata: { original: artwork } },
        expires_at: Math.floor(Date.now() / 1000) + RESERVATION_MINUTES * 60 + 60,
      }),
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout session error:', err);
    res.status(500).json({ error: 'Could not start checkout. Please try again shortly.' });
  }
};
