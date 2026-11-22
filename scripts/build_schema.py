#!/usr/bin/env python3
"""Structured data (schema.org JSON-LD) for every page of the site.

Google and AI answer engines (ChatGPT, Gemini, Perplexity, Google AI Overviews)
read this hidden block to understand who Avigail is, what she sells and what
each page is about. It is built from what is visibly on the page, so it stays
truthful:

  - artwork, kesubah and print listings come from the art cards in index.html
    (a card showing <span class="sold-out"> is marked as sold),
  - print prices come from PRICES in api/create-checkout-session.js,
  - the original's price comes from ORIGINALS in api/_originals.js,
  - the FAQ comes from the visible "Frequently asked" section.

It runs automatically from scripts/build_pages.py, so after any change to
index.html just run:   python3 scripts/build_pages.py
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://avigailmeyerson.com"

PERSON_ID = f"{SITE}/#avigail"
BUSINESS_ID = f"{SITE}/#business"
WEBSITE_ID = f"{SITE}/#website"

EMAIL = "meyersonavigail@gmail.com"
PHONE = "+1-848-373-6066"
SHIPS_TO = ["US", "CA"]

PAGE_NAMES = {
    "about": "About",
    "collection": "Collection",
    "kesubahs": "Kesubahs",
    "prints": "Prints",
    "commissions": "Commissions",
}

LD_BLOCK = re.compile(r'  <script type="application/ld\+json">.*?</script>\n', re.S)


# ---------------------------------------------------------------- reading the site

def text(fragment):
    """Visible text of an HTML fragment."""
    t = re.sub(r"<[^>]+>", "", fragment)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def abs_url(path):
    return f"{SITE}/{path.lstrip('/')}"


def read_cards(source):
    cards = []
    for attrs, body in re.findall(r'<figure class="art-card"([^>]*)>(.*?)</figure>', source, re.S):
        def attr(name, where=body):
            m = re.search(rf'{name}="([^"]*)"', where)
            return html.unescape(m.group(1)) if m else None
        desc = re.search(r"<figcaption.*?<p>(.*?)</p>", body, re.S)
        cards.append({
            "category": attr("data-category", attrs),
            "title": attr("data-title"),
            "medium": attr("data-medium"),
            "image": abs_url(attr("data-src")),
            "alt": attr("alt"),
            "description": text(desc.group(1)) if desc else None,
            "product": attr("data-product") or ("print" if "Buy print" in body else None),
            "sold": 'class="sold-out"' in body,
        })
    return cards


def read_prices():
    js = (ROOT / "api" / "create-checkout-session.js").read_text()
    prices = {}
    for product, block in re.findall(r"(\w+): \{([^}]*)\}", js.split("const PRICES", 1)[1].split("};", 1)[0]):
        prices[product] = {k: int(v) for k, v in re.findall(r"'([^']+)': (\d+)", block)}
    originals_js = (ROOT / "api" / "_originals.js").read_text()
    block = originals_js.split("const ORIGINALS", 1)[1].split("};", 1)[0]
    originals = {k: int(v) for k, v in re.findall(r"'([^']+)': (\d+)", block)}
    return prices, originals


def read_faq(source):
    section = re.search(r'<section class="faq-wrap".*?</section>', source, re.S).group(0)
    return [(text(q), text(a)) for q, a in
            re.findall(r"<summary>(.*?)</summary>\s*<p>(.*?)</p>", section, re.S)]


# ---------------------------------------------------------------- building blocks

def person():
    return {
        "@type": "Person",
        "@id": PERSON_ID,
        "name": "Avigail Meyerson",
        "alternateName": "Avigail",
        "jobTitle": "Jewish Fine Artist",
        "description": ("Avigail Meyerson is a Jewish fine artist from New Jersey who paints "
                        "watercolor portraits of Gedolim and rabbanim, hand-painted kesubahs, "
                        "Judaica and holy scenes such as the Kotel, in oil and watercolor."),
        "url": f"{SITE}/about",
        "image": abs_url("assets/avigail-portrait.jpg"),
        "email": f"mailto:{EMAIL}",
        "telephone": PHONE,
        "homeLocation": {"@type": "Place", "address": {
            "@type": "PostalAddress", "addressRegion": "NJ", "addressCountry": "US"}},
        "knowsAbout": ["Jewish fine art", "Judaica", "Gedolim portraits", "Portraits of rabbanim",
                       "Kesubah (ketubah) art", "Watercolor painting", "Oil painting",
                       "Portraiture", "Paintings of the Kotel (Western Wall)"],
        "worksFor": {"@id": BUSINESS_ID},
    }


def business():
    return {
        "@type": "Organization",
        "@id": BUSINESS_ID,
        "name": "Art by Avigail",
        "alternateName": "Avigail Meyerson Fine Art",
        "description": ("Jewish fine art by Avigail Meyerson: Gedolim portraits, hand-painted "
                        "kesubahs, original oil and watercolor paintings, custom commissions and "
                        "fine-art prints shipped to the US and Canada."),
        "url": f"{SITE}/",
        "logo": abs_url("assets/icon-512.png"),
        "image": abs_url("assets/hero-kotel-gallery.jpg"),
        "email": EMAIL,
        "telephone": PHONE,
        "founder": {"@id": PERSON_ID},
        "areaServed": [{"@type": "Country", "name": c} for c in ("United States", "Canada")],
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "commissions and orders",
            "email": EMAIL,
            "telephone": PHONE,
            "availableLanguage": ["English"],
        },
        "knowsAbout": ["Jewish art", "Judaica", "Gedolim portraits", "Kesubahs", "Ketubah art"],
    }


def website():
    return {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        "url": f"{SITE}/",
        "name": "Art by Avigail",
        "description": "Jewish fine art by Avigail Meyerson: Gedolim portraits, kesubahs, commissions and prints.",
        "publisher": {"@id": BUSINESS_ID},
        "inLanguage": "en-US",
    }


def shipping():
    return {
        "@type": "OfferShippingDetails",
        "shippingRate": {"@type": "MonetaryAmount", "value": 0, "currency": "USD"},
        "shippingDestination": [{"@type": "DefinedRegion", "addressCountry": c} for c in SHIPS_TO],
    }


def offer(price, url, sold=False):
    return {
        "@type": "Offer",
        "price": price,
        "priceCurrency": "USD",
        "availability": "https://schema.org/SoldOut" if sold else "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "url": url,
        "seller": {"@id": BUSINESS_ID},
        "shippingDetails": shipping(),
    }


def artwork(card, page_url):
    medium = card["medium"] or ""
    item = {
        "@type": "VisualArtwork",
        "@id": f"{SITE}/collection#{slugify(card['title'])}",
        "name": card["title"],
        "image": card["image"],
        "creator": {"@id": PERSON_ID},
        "artform": "Painting",
        "artMedium": medium,
        "url": page_url,
    }
    if card["description"]:
        item["description"] = card["description"]
    elif card["alt"]:
        item["description"] = card["alt"]
    if card["category"] == "watercolor":
        item["genre"] = "Gedolim portrait"
        item["about"] = {"@type": "Person", "name": card["title"]}
    elif card["category"] == "kesubahs":
        item["genre"] = "Kesubah (ketubah)"
        item["artform"] = "Kesubah"
    return item


def portrait_print(card, sizes):
    url = f"{SITE}/prints"
    return {
        "@type": "Product",
        "@id": f"{url}#{slugify(card['title'])}",
        "name": f"{card['title']} — Gedolim watercolor portrait print",
        "description": (f"Unframed fine-art print of Avigail Meyerson's original watercolor portrait of "
                        f"{card['title']}. Available in {', '.join(s + ' in' for s in sizes)}. "
                        "Shipping to the US and Canada is included."),
        "image": card["image"],
        "brand": {"@id": BUSINESS_ID},
        "category": "Jewish art prints > Gedolim portraits",
        "subjectOf": {"@id": f"{SITE}/collection#{slugify(card['title'])}"},
        "size": list(sizes),
        "offers": {
            "@type": "AggregateOffer",
            "lowPrice": min(sizes.values()),
            "highPrice": max(sizes.values()),
            "offerCount": len(sizes),
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock",
            "offers": [dict(offer(p, url), name=f"{s} in print") for s, p in sizes.items()],
        },
    }


def kesubah_print(card, sizes):
    url = f"{SITE}/kesubahs"
    size, price = min(sizes.items(), key=lambda x: x[1])
    return {
        "@type": "Product",
        "@id": f"{url}#{slugify(card['title'])}",
        "name": f"{card['title']} — kesubah print",
        "description": (f"{card['description']} Fine-art print of Avigail Meyerson's watercolor kesubah, "
                        f"{size} in, with space for names and dates to be added. Shipping to the US and "
                        "Canada is included."),
        "image": card["image"],
        "brand": {"@id": BUSINESS_ID},
        "category": "Judaica > Kesubahs (ketubahs)",
        "size": f"{size} in",
        "offers": offer(price, url),
    }


def original_for_sale(card, price):
    url = f"{SITE}/collection"
    return {
        "@type": "Product",
        "@id": f"{url}#{slugify(card['title'])}-original",
        "name": f"{card['title']} — original {card['medium'].lower()} painting",
        "description": card["description"],
        "image": card["image"],
        "brand": {"@id": BUSINESS_ID},
        "category": "Original Jewish fine art",
        "subjectOf": {"@id": f"{SITE}/collection#{slugify(card['title'])}"},
        "offers": offer(price, url, sold=card["sold"]),
    }


def services():
    url = f"{SITE}/commissions"
    common = {
        "provider": {"@id": BUSINESS_ID},
        "areaServed": [{"@type": "Country", "name": c} for c in ("United States", "Canada")],
        "url": url,
    }
    return [
        dict(common, **{
            "@type": "Service",
            "@id": f"{url}#custom-kesubah",
            "name": "Custom hand-painted kesubah",
            "serviceType": "Custom kesubah (ketubah) commission",
            "description": ("A one-of-a-kind kesubah: the words of your kesubah surrounded by a "
                            "hand-painted watercolor landscape chosen together with you, such as rivers, "
                            "mountains, trees or a place that holds meaning for you as a couple. Starts "
                            "with a conversation and a sketch for your approval; commissions take 3–4 "
                            "weeks depending on size."),
            "image": abs_url("assets/kesubah-mountains.jpg"),
        }),
        dict(common, **{
            "@type": "Service",
            "@id": f"{url}#custom-painting",
            "name": "Custom oil painting and portrait commission",
            "serviceType": "Custom portrait and Judaica painting commission",
            "description": ("Commission an original oil painting by hand, from a portrait of a parent, "
                            "grandparent or rav to the Kotel at sunrise. Designed with you, from size and "
                            "composition to color, with a sketch for your approval first. Commissions take "
                            "3–4 weeks depending on size."),
            "image": abs_url("assets/oil-portrait-blue.jpg"),
        }),
    ]


def faq_page(source, url):
    return {
        "@type": "FAQPage",
        "@id": f"{url}#faq",
        "mainEntity": [{"@type": "Question", "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": a}}
                       for q, a in read_faq(source)],
    }


def breadcrumbs(slug):
    items = [{"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"}]
    if slug:
        items.append({"@type": "ListItem", "position": 2, "name": PAGE_NAMES[slug],
                      "item": f"{SITE}/{slug}"})
    return {"@type": "BreadcrumbList", "@id": f"{SITE}/{slug or ''}#breadcrumb", "itemListElement": items}


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def item_list(name, items, url):
    return {
        "@type": "ItemList",
        "@id": f"{url}#items",
        "name": name,
        "numberOfItems": len(items),
        "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": it}
                            for i, it in enumerate(items)],
    }


# ---------------------------------------------------------------- per page

def graph_for(slug, source, title, description):
    """slug is None for the homepage."""
    url = f"{SITE}/{slug}" if slug else f"{SITE}/"
    cards = read_cards(source)
    prices, originals = read_prices()

    page = {
        "@type": "ProfilePage" if slug == "about" else ("CollectionPage" if slug in ("collection", "prints", "kesubahs") else "WebPage"),
        "@id": f"{url}#webpage",
        "url": url,
        "name": title,
        "description": description,
        "isPartOf": {"@id": WEBSITE_ID},
        "about": {"@id": PERSON_ID if slug == "about" else BUSINESS_ID},
        "breadcrumb": {"@id": breadcrumbs(slug)["@id"]},
        "inLanguage": "en-US",
        "primaryImageOfPage": {"@type": "ImageObject", "url": abs_url("assets/hero-kotel-gallery.jpg")},
    }
    graph = [website(), business(), person(), page, breadcrumbs(slug)]

    portraits = [c for c in cards if c["category"] == "watercolor"]
    kesubahs = [c for c in cards if c["category"] == "kesubahs"]

    if slug is None:
        page["mainEntity"] = {"@id": BUSINESS_ID}
        graph += services()
        graph.append(faq_page(source, url))
        business_node = graph[1]
        business_node["makesOffer"] = [
            {"@type": "Offer", "itemOffered": {"@id": s["@id"]}} for s in services()
        ] + [{"@type": "AggregateOffer", "priceCurrency": "USD",
              "lowPrice": min(prices["watercolor"].values()),
              "highPrice": max(prices["watercolor"].values()),
              "itemOffered": {"@type": "Product", "name": "Gedolim watercolor portrait prints",
                              "url": f"{SITE}/prints"}},
             {"@type": "Offer", "price": min(prices["kesubah"].values()), "priceCurrency": "USD",
              "itemOffered": {"@type": "Product", "name": "Kesubah prints", "url": f"{SITE}/kesubahs"}}]
    elif slug == "about":
        page["mainEntity"] = {"@id": PERSON_ID}
    elif slug == "collection":
        works = [artwork(c, url) for c in cards]
        graph.append(item_list("Paintings by Avigail Meyerson", works, url))
        graph += [original_for_sale(c, originals[c["title"]]) for c in cards
                  if c["product"] == "original" and c["title"] in originals]
    elif slug == "prints":
        items = [portrait_print(c, prices["watercolor"]) for c in portraits if c["product"] == "print"]
        graph.append(item_list("Gedolim watercolor portrait prints", items, url))
    elif slug == "kesubahs":
        items = [kesubah_print(c, prices["kesubah"]) for c in kesubahs if c["product"] == "kesubah"]
        graph.append(item_list("Kesubah prints", items, url))
        graph.append(services()[0])
    elif slug == "commissions":
        page["mainEntity"] = [{"@id": s["@id"]} for s in services()]
        graph += services()
    return {"@context": "https://schema.org", "@graph": graph}


def render(graph):
    body = json.dumps(graph, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f'  <script type="application/ld+json">\n  {body}\n  </script>\n'


def apply(doc, slug, title, description):
    """Replace the page's JSON-LD block with a fresh one."""
    block = render(graph_for(slug, doc, title, description))
    new, n = LD_BLOCK.subn(lambda _m: block, doc, count=1)
    if n == 0:
        assert doc.count("</head>") == 1
        new = doc.replace("</head>", block + "</head>", 1)
    return new


def page_meta(doc):
    title = text(re.search(r"<title>(.*?)</title>", doc, re.S).group(1))
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', doc).group(1))
    return title, desc


if __name__ == "__main__":
    index = ROOT / "index.html"
    doc = index.read_text()
    index.write_text(apply(doc, None, *page_meta(doc)))
    print("updated index.html structured data")
