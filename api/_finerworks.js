// FinerWorks print fulfillment: settings and the API call that places an order.
// API docs: https://api.finerworks.com/Help  (POST /v3/submit_orders_v2)
//
// Environment variables (Vercel → Settings → Environment Variables):
//   FINERWORKS_WEB_API_KEY  - from finerworks.com → My Account → Web API
//   FINERWORKS_APP_KEY      - application key issued by FinerWorks
//   FINERWORKS_LIVE         - set to "true" to place REAL orders. Anything else
//                             (or unset) sends orders in test mode: FinerWorks
//                             checks them but does not print, ship or bill them.
//   FINERWORKS_SHIPPING     - optional shipping method code (default "SD" = ground;
//                             "EC" = economy, "FS" = fastest available)

// Which FinerWorks product to print for each print sold on the site.
// Each print size of each painting is a product in Gail's FinerWorks
// "virtual inventory" (upload the hi-res image there, create the print sizes,
// and copy each product's SKU here). Titles and sizes must match the site exactly.
// A blank SKU means that print is NOT sent automatically; Gail gets an email
// with the order details instead, so she can place it by hand.
const PRINT_SKUS = {
  'Rebbe of Slonim': { '10 × 14': '', '14 × 20': '', '18 × 26': '', '26 × 38': '' },
  'Rabbi Lopiansky': { '10 × 14': '', '14 × 20': '', '18 × 26': '', '26 × 38': '' },
  'Rabbi Dessler': { '10 × 14': '', '14 × 20': '', '18 × 26': '', '26 × 38': '' },
  'Rabbi Jaeger': { '10 × 14': '', '14 × 20': '', '18 × 26': '', '26 × 38': '' },
  'Rabbi Shmuelevitz': { '10 × 14': '', '14 × 20': '', '18 × 26': '', '26 × 38': '' },
};

const API_URL = 'https://v2.api.finerworks.com/v3/submit_orders_v2';

const isLive = () => process.env.FINERWORKS_LIVE === 'true';
const isConfigured = () => Boolean(process.env.FINERWORKS_WEB_API_KEY && process.env.FINERWORKS_APP_KEY);
const skuFor = (artwork, size) => ((PRINT_SKUS[artwork] || {})[size] || '').trim();

const cut = (value, max) => String(value || '').trim().slice(0, max);

// Turn a Stripe shipping address into a FinerWorks recipient.
function recipientFrom({ name, address, phone, email }) {
  const parts = cut(name, 101).split(/\s+/).filter(Boolean);
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || 'Customer';
  const last = parts.length > 1 ? parts[parts.length - 1] : '-';
  const us = address.country === 'US';
  return {
    first_name: cut(first, 50),
    last_name: cut(last, 50),
    address_1: cut(address.line1, 100),
    address_2: cut(address.line2, 100) || null,
    city: cut(address.city, 50),
    state_code: us ? cut(address.state, 2).toUpperCase() : null,
    province: us ? null : cut(address.state, 50) || null,
    zip_postal_code: cut(address.postal_code, 10),
    country_code: cut(address.country, 2).toUpperCase(),
    phone: cut(phone, 50) || null,
    email: cut(email, 50) || null,
  };
}

// Places one order. Resolves to { orderId, testMode } or throws with FinerWorks' message.
async function submitOrder({ orderPo, recipient, sku, title, qty = 1 }) {
  const testMode = !isLive();
  const body = {
    orders: [
      {
        order_po: cut(orderPo, 50),
        recipient,
        order_items: [{ product_order_po: cut(orderPo, 50), product_qty: qty, product_sku: sku, product_title: cut(title, 50) }],
        shipping_code: process.env.FINERWORKS_SHIPPING || 'SD',
        test_mode: testMode,
        source: 'avigailmeyerson.com',
      },
    ],
    validate_only: false,
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      web_api_key: process.env.FINERWORKS_WEB_API_KEY,
      app_key: process.env.FINERWORKS_APP_KEY,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch (e) { /* not JSON */ }
  const status = data.status || {};
  const order = (data.orders || [])[0] || {};
  if (!response.ok || status.success === false || !(order.order_id || order.order_confirmation_id)) {
    const why = status.message || (data.debug && JSON.stringify(data.debug)) || text.slice(0, 300) || `HTTP ${response.status}`;
    throw new Error(`FinerWorks rejected the order: ${why}`);
  }
  return { orderId: String(order.order_id || order.order_confirmation_id), testMode };
}

module.exports = { PRINT_SKUS, isLive, isConfigured, skuFor, recipientFrom, submitOrder };
