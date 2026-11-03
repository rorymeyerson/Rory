// Shop facts shown at checkout. Keep in step with the SHOP block near the top of
// the <script> in index.html (the site shows the same facts in the order window).
// Anything left null is simply not shown — never put a guess here.

module.exports = {
  // Countries Stripe will ship to.
  SHIP_COUNTRIES: ['US', 'CA'],
  // What the buyer pays for shipping, in USD. 0 = free shipping (current behaviour).
  SHIPPING_USD: 0,
  // Delivery estimate in business days, e.g. { min: 7, max: 12 }. null = not shown.
  DELIVERY_DAYS: null,
  // One line describing the physical print, e.g. 'Archival giclée on cotton rag paper · unframed'.
  // null = not shown.
  PRINT_DETAILS: 'Unframed',
  // Most copies of one print allowed in a single order.
  MAX_QTY: 5,
};
