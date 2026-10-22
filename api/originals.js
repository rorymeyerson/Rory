// GET /api/originals -> { "Stories of Our Mountain": "available" | "sold", ... }
// The page uses this to switch an original's button to "Sold" automatically.
const Stripe = require('stripe');
const { ORIGINALS, soldOriginals } = require('./_originals');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  try {
    const sold = await soldOriginals(stripe);
    const status = {};
    for (const title of Object.keys(ORIGINALS)) status[title] = sold.has(title) ? 'sold' : 'available';
    // Cache at Vercel's edge for a minute so Stripe isn't asked on every page view.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(status);
  } catch (err) {
    console.error('Originals status error:', err);
    res.status(500).json({ error: 'unavailable' });
  }
};
