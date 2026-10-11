#!/usr/bin/env python3
"""Build the section pages (about, collection, kesubahs, prints, commissions) from index.html.

index.html is the one source of truth. Each section page is a copy of it with:
  - its own <title>, description, canonical link and social-preview tags (what Google shows),
  - a page heading and short introduction in place of the homepage's Kotel opening,
  - the relevant section moved to the top and the right collection tab opened.

Run this after every change to index.html:
    python3 scripts/build_pages.py
"""
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://avigailmeyerson.com"

PAGES = [
    {
        "slug": "about",
        "title": "About Avigail Meyerson | Art by Avigail",
        "description": "Meet Avigail Meyerson, an artist from New Jersey who paints portraits, holy scenes, Judaica and kesubahs in oil and watercolor.",
        "kicker": "Meet Avigail",
        "h1": "About the Artist",
        "lede": "The artist behind Art by Avigail: portraits, holy scenes, Judaica and kesubahs in oil and watercolor.",
        "first": "about",
        "tab": None,
        "body_class": "subpage subpage-about",
    },
    {
        "slug": "collection",
        "title": "Collection: Oil Paintings & Watercolor Portraits | Art by Avigail",
        "description": "Browse Avigail Meyerson's watercolor portraits, original oil paintings and kesubahs, with fine-art prints of selected works.",
        "kicker": "Selected paintings",
        "h1": "The Collection",
        "lede": "Watercolor portraits, original oil paintings and kesubahs by Avigail Meyerson. Select any piece to see it up close.",
        "first": "collection",
        "tab": "watercolor",
        "body_class": "subpage subpage-collection",
    },
    {
        "slug": "kesubahs",
        "title": "Hand-Painted Kesubahs | Art by Avigail",
        "description": "Kesubahs by Avigail Meyerson, with the words of the kesubah set within her original watercolor artwork. Order a fine-art print or commission your own.",
        "kicker": "Kesubahs",
        "h1": "Hand-Painted Kesubahs",
        "lede": "Each kesubah sets the words of the kesubah within Avigail's original watercolor artwork. Order a fine-art print, or commission a kesubah painted for your wedding.",
        "first": "collection",
        "tab": "kesubahs",
        "body_class": "subpage subpage-collection",
    },
    {
        "slug": "prints",
        "title": "Fine-Art Prints | Art by Avigail",
        "description": "Fine-art prints of Avigail Meyerson's watercolor portraits and kesubahs. Choose a size and check out securely; your print ships to you.",
        "kicker": "Prints",
        "h1": "Fine-Art Prints",
        "lede": "Prints of Avigail's watercolor portraits and kesubahs. Select a piece, choose a size, and check out securely; shipping details are collected at checkout.",
        "first": "collection",
        "tab": "prints",
        "body_class": "subpage subpage-collection",
    },
    {
        "slug": "commissions",
        "title": "Commission Artwork | Art by Avigail",
        "description": "Commission an original painting or kesubah from Avigail Meyerson: a personal conversation, a sketch for your approval, then a piece painted by hand.",
        "kicker": "Commissions",
        "h1": "Commission a Painting",
        "lede": "Every commission begins with a conversation about your vision, the people or places that matter to you, and the space it will live in. Avigail prepares a sketch for your approval, then paints your piece by hand.",
        "first": "collection",
        "tab": "commission-info",
        "body_class": "subpage subpage-collection",
    },
]


def cut_section(doc, start_marker):
    """Return (doc_without_section, section_text) for a top-level <section> starting at start_marker."""
    a = doc.index(start_marker)
    b = doc.index("    </section>\n", a) + len("    </section>\n")
    return doc[:a] + doc[b:], doc[a:b]


def set_meta(doc, page):
    url = f"{SITE}/{page['slug']}"
    t, d = html.escape(page["title"]), html.escape(page["description"])
    subs = [
        (r"<title>.*?</title>", f"<title>{t}</title>"),
        (r'<meta name="description" content="[^"]*" />', f'<meta name="description" content="{d}" />'),
        (r'<link rel="canonical" href="[^"]*" />', f'<link rel="canonical" href="{url}" />'),
        (r'<meta property="og:title" content="[^"]*" />', f'<meta property="og:title" content="{t}" />'),
        (r'<meta property="og:description" content="[^"]*" />', f'<meta property="og:description" content="{d}" />'),
        (r'<meta property="og:url" content="[^"]*" />', f'<meta property="og:url" content="{url}" />'),
        (r'<meta name="twitter:title" content="[^"]*" />', f'<meta name="twitter:title" content="{t}" />'),
        (r'<meta name="twitter:description" content="[^"]*" />', f'<meta name="twitter:description" content="{d}" />'),
    ]
    for pattern, repl in subs:
        doc, n = re.subn(pattern, repl, doc, count=1, flags=re.S)
        assert n == 1, f"could not set {pattern} on {page['slug']}"
    return doc


def build(page, source):
    doc = set_meta(source, page)

    # Replace the homepage opening with this page's heading and introduction
    doc, _hero = cut_section(doc, '    <section class="hero"')
    intro = f'''    <section class="page-intro" aria-labelledby="page-title">
      <div class="page-intro-inner">
        <p class="section-label">{html.escape(page["kicker"])}</p>
        <h1 id="page-title">{html.escape(page["h1"])}</h1>
        <p class="page-lede">{html.escape(page["lede"])}</p>
        <a class="page-home" href="/">Art by Avigail home</a>
      </div>
    </section>
'''
    # Put the page's own section directly after the introduction
    doc, first = cut_section(doc, f'    <section class="section" id="{page["first"]}"' if page["first"] == "collection"
                             else f'    <section class="about-wrap" id="{page["first"]}"')
    anchor = '  <main id="top">\n'
    assert doc.count(anchor) == 1
    doc = doc.replace(anchor, anchor + intro + "\n" + first + "\n", 1)

    attrs = f' class="{page["body_class"]}" data-page="{page["slug"]}"'
    if page["tab"]:
        attrs += f' data-open-tab="{page["tab"]}"'
    assert doc.count("<body>") == 1
    doc = doc.replace("<body>", f"<body{attrs}>", 1)

    out = ROOT / f'{page["slug"]}.html'
    out.write_text(doc)
    return out


def write_sitemap(today):
    urls = [f"{SITE}/"] + [f"{SITE}/{p['slug']}" for p in PAGES]
    rows = "\n".join(
        f"  <url>\n    <loc>{u}</loc>\n    <lastmod>{today}</lastmod>\n    <changefreq>monthly</changefreq>\n"
        f"    <priority>{'1.0' if u.endswith('/') else '0.8'}</priority>\n  </url>"
        for u in urls
    )
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows + "\n</urlset>\n"
    )


if __name__ == "__main__":
    import datetime
    source = (ROOT / "index.html").read_text()
    for page in PAGES:
        print("built", build(page, source).name)
    write_sitemap(datetime.date.today().isoformat())
    print("updated sitemap.xml")
