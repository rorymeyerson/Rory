// Shared helpers for one-of-a-kind original paintings.
// (Files in api/ that start with "_" are helpers, not public endpoints.)
//
// There is no database: Stripe itself is the record of what has sold.
// Every checkout for an original is tagged with metadata.original = <title>.
//   - a completed, paid checkout with that tag  -> the painting is SOLD
//   - an open (unfinished) checkout with that tag -> the painting is RESERVED
//     for up to 30 minutes while that buyer is on the payment page

// Titles must match data-title on the painting's card in index.html. Price in USD.
const ORIGINALS = {
  'Stories of Our Mountain': 1800,
};

// Stripe's minimum lifetime for a checkout page; also how long a reservation lasts.
const RESERVATION_MINUTES = 30;

async function findSessions(stripe, status, matches) {
  const found = [];
  for await (const session of stripe.checkout.sessions.list({ status, limit: 100 })) {
    if (session.metadata && session.metadata.original && matches(session)) found.push(session);
  }
  return found;
}

// Titles of originals that have been paid for.
async function soldOriginals(stripe) {
  const paid = await findSessions(stripe, 'complete', s => s.payment_status === 'paid');
  return new Set(paid.map(s => s.metadata.original));
}

// 'sold' | 'reserved' | 'available' for one original.
async function originalStatus(stripe, title) {
  const sold = await findSessions(stripe, 'complete', s => s.metadata.original === title && s.payment_status === 'paid');
  if (sold.length) return 'sold';
  const now = Math.floor(Date.now() / 1000);
  const open = await findSessions(stripe, 'open', s => s.metadata.original === title && s.expires_at > now);
  return open.length ? 'reserved' : 'available';
}

module.exports = { ORIGINALS, RESERVATION_MINUTES, soldOriginals, originalStatus };
