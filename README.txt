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
  Resend → Domains and set COMMISSION_FROM="Art by Avigail <requests@avigailmeyerson.com>".
