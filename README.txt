Art by Avigail — website source files
=====================================
Updated 2026-09-16.

Contents:
- index.html                    : the site (HTML + CSS + JavaScript)
- assets/                       : all images used by the site (logo, portraits, paintings)
- api/create-checkout-session.js: serverless function that starts a Stripe Checkout session
- package.json                  : declares the "stripe" dependency the function needs
- .env.example                  : shows the one environment variable required (STRIPE_SECRET_KEY)

How the print orders work now:
- The order form no longer opens an email draft or asks for Zelle payment.
- Selecting a size and clicking "Continue to secure checkout" calls
  /api/create-checkout-session, which creates a Stripe Checkout session for
  the chosen artwork/size/price and redirects the buyer there.
- Stripe Checkout collects the card payment, buyer email, and shipping
  address directly — no card details ever touch this site's own code.
- After a successful payment, Stripe redirects back to the site
  (?order=success) which shows an on-page confirmation.
- Order and shipping details show up in the Stripe Dashboard, and Stripe's
  own account notification emails (Settings → Notifications) can alert
  meyersonavigail@gmail.com whenever a payment comes in.

Deploying (Vercel, free tier):
1. Create a free account at https://vercel.com and a Stripe account at
   https://stripe.com (use Stripe test keys first to try it out).
2. Import this GitHub repo into Vercel as a new project. Vercel
   auto-detects index.html/assets as static files and api/ as a
   serverless function — no extra config needed.
3. In the Vercel project's Settings → Environment Variables, add:
     STRIPE_SECRET_KEY = <your Stripe secret key>
   (Test key while testing: starts with sk_test_. Switch to the sk_live_
   key once ready to accept real payments.)
4. Deploy. Vercel gives a *.vercel.app URL immediately; a custom domain
   (e.g. artbyavigail.com) can be attached free under Settings → Domains.
5. In Stripe Dashboard → Settings → Notifications, turn on email
   notifications for successful payments so Avigail is alerted per order.

Print sizes/prices (USD): 10x14 $50, 14x20 $80, 18x26 $140, 26x38 $220.
These are defined in api/create-checkout-session.js (VALID_SIZES) and in
the <select> in index.html — update both together if prices change.

Section pages (added 2026-10-11):
- about.html, collection.html, kesubahs.html, prints.html, commissions.html are
  GENERATED from index.html by scripts/build_pages.py, so Google can list each
  section as its own page (avigailmeyerson.com/kesubahs, /prints, ...).
- After any change to index.html, run:  python3 scripts/build_pages.py
  and commit the regenerated pages and sitemap.xml along with it.
- vercel.json turns on clean URLs, so /kesubahs serves kesubahs.html.

Commission requests (added 2026-10-21):
- The commission form posts to /api/commission-request, which emails the
  request (with up to 5 reference photos, shrunk to JPEG) to
  meyersonavigail@gmail.com through Resend (https://resend.com). Replying to
  that email replies straight to the customer.
- Needs RESEND_API_KEY in Vercel → Settings → Environment Variables.
  Until it is set, the form falls back to opening the visitor's email app.
- Optional: COMMISSION_TO (recipient) and COMMISSION_FROM (sender). The default
  sender, onboarding@resend.dev, only delivers to the email the Resend account
  was created with. To send from your own domain, verify avigailmeyerson.com in
  Resend → Domains; emails then come from requests@avigailmeyerson.com
  automatically (until then the code falls back to the shared sender).

Original paintings (added 2026-10-22):
- Originals for sale are listed in api/_originals.js (ORIGINALS: title -> USD
  price). The title must match data-title on the painting's card in index.html,
  and its button uses data-product="original".
- Stripe is the record of what sold — no database. Each original's checkout is
  tagged with metadata.original. Once a paid order exists, /api/originals
  reports it as sold, the page swaps its button to "Sold" automatically
  (within about a minute), and checkout refuses any further purchase.
- While one buyer is on the Stripe payment page, the painting is held for them
  for up to 30 minutes; if they press back/cancel it is released immediately
  (/api/release-checkout).
- After a sale you may still want to change the card to the static
  <span class="sold-out">Sold</span> so it shows even if Stripe is unreachable.

Images (added 2026-10-22):
- The page shows light WebP copies from assets/web/ (cards 900px wide). The
  full-size originals in assets/ are only loaded when a visitor clicks a piece
  (lightbox, magnifier, print order window, Stripe product image).
- When adding a new piece: put the full image in assets/, make a 900px-wide
  WebP copy in assets/web/ for the card's <img src>, and point data-src at
  the full image.

Automatic print fulfillment with FinerWorks (added 2026-10-22):
- When a checkout is paid, Stripe notifies /api/stripe-webhook. It fetches the
  order from Stripe and, for a print, places it with FinerWorks
  (api/_finerworks.js → POST /v3/submit_orders_v2) using the buyer's shipping
  address. Avigail gets an email either way.
- Portrait and kesubah prints are sent (SKUs in PRINT_SKUS / KESUBAH_SKUS).
  Originals and prints with no SKU set are NOT sent; Avigail is
  emailed the order details to handle by hand.
- Setup:
  1. FinerWorks: upload each hi-res image to your inventory, create the four
     print sizes as products, and paste each product's SKU into PRINT_SKUS in
     api/_finerworks.js. Keep a payment method on file in FinerWorks.
  2. Vercel env vars: FINERWORKS_WEB_API_KEY, FINERWORKS_APP_KEY.
     Orders go in TEST MODE until FINERWORKS_LIVE=true is also set.
  3. Stripe → Developers → Webhooks → Add endpoint:
     https://www.avigailmeyerson.com/api/stripe-webhook, event
     checkout.session.completed. (No signing secret needed: the endpoint
     re-reads every event from Stripe directly.)
- The FinerWorks order number is saved on the Stripe payment (metadata
  finerworks_order), which also prevents duplicate orders.
