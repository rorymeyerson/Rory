Art by Avigail — website source files
=====================================
Exported 2026-09-16.

Contents:
- index.html : the entire site (HTML + CSS + JavaScript in one file)
- assets/    : all images used by the site (logo, portraits, paintings)

How to use:
1. Put index.html and the assets/ folder on any web hosting, keeping
   them side by side (index.html next to assets/).
2. Point a domain name at that hosting and the site will look identical
   to the current version.

Notes for the web designer:
- The site is a static page: no server, database, or build step needed.
- The print-order popup currently opens the buyer's own email app with a
  pre-filled draft (it cannot send email by itself). On real hosting with
  a server, this should be replaced with a proper form that emails order
  details (buyer name, email, shipping address, artwork, size) to
  meyersonavigail@gmail.com and sends the buyer payment instructions.
- Print sizes/prices (USD): 10x14 $50, 14x20 $80, 18x26 $140, 26x38 $220.
- Payment is via Zelle to +1 848 373 6066 (shown in the order confirmation).
