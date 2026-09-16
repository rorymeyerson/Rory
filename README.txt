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
