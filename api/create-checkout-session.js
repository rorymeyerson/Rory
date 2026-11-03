const Stripe = require('stripe');
const { ORIGINALS, RESERVATION_MINUTES, originalStatus } = require('./_originals');
const SHOP = require('./_shop');

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
  const qty = Math.trunc(Number((req.body || {}).quantity) || 1);
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

  if (qty < 1 || qty > SHOP.MAX_QTY || (isOriginal && qty !== 1)) {
    res.status(400).json({ error: 'Invalid quantity.' });
    return;
  }

  // What Stripe shows under the item name in the order summary.
  const details = isOriginal
    ? 'One-of-a-kind original watercolor, painted by hand.'
    : [`${size} in`, SHOP.PRINT_DETAILS].filter(Boolean).join(' · ');
  const delivery = SHOP.DELIVERY_DAYS
    ? { minimum: { unit: 'business_day', value: SHOP.DELIVERY_DAYS.min }, maximum: { unit: 'business_day', value: SHOP.DELIVERY_DAYS.max } }
    : undefined;

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
              description: details,
              images: imageUrl ? [imageUrl] : undefined,
            },
            unit_amount: amount * 100,
          },
          quantity: qty,
        },
      ],
      // Charge and display in US dollars for everyone. (Adaptive Pricing would
      // otherwise show visitors abroad a converted price, e.g. shekels from Israel.)
      adaptive_pricing: { enabled: false },
      shipping_address_collection: { allowed_countries: SHOP.SHIP_COUNTRIES },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: SHOP.SHIPPING_USD ? 'Shipping (US & Canada)' : 'Shipping included (US & Canada)',
            fixed_amount: { amount: SHOP.SHIPPING_USD * 100, currency: 'usd' },
            ...(delivery && { delivery_estimate: delivery }),
          },
        },
      ],
      phone_number_collection: { enabled: true },
      success_url: `${origin}/?order=success`,
      cancel_url: `${origin}/?order=cancelled&cs={CHECKOUT_SESSION_ID}`,
      // Read by /api/stripe-webhook to send the print to FinerWorks.
      metadata: { artwork: artwork.slice(0, 450), size, product, qty: String(qty), ...(isOriginal && { original: artwork }) },
      ...(isOriginal && {
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
