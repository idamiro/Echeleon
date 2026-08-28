#!/usr/bin/env python3
"""Generate Vulcet blog index + articles for the publication system."""
from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent

ROOT = Path("/workspace")
BLOG = ROOT / "blog"

from article_human_check_body import human_check_body, human_check_faq  # noqa: E402

HEADER = '''<!DOCTYPE html><html lang="en" data-root="/"><head>
  <meta charset="utf-8"><meta name="robots" content="index,follow"><meta name="viewport" content="width=device-width, initial-scale=1">
  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag('consent','default',{{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500}});gtag('js',new Date());gtag('config','G-BD641SSN63',{{anonymize_ip:true}});</script>
  <script async="" src="https://www.googletagmanager.com/gtag/js?id=G-BD641SSN63"></script>
  <meta name="description" content="{description}">
  <link rel="canonical" href="{canonical}">
  <meta property="og:title" content="{og_title}">
  <meta property="og:description" content="{og_description}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:site_name" content="Vulcet">
  <meta property="og:image" content="{og_image}">
  <meta property="og:locale" content="en_US">
  {article_meta}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{og_title}">
  <meta name="twitter:description" content="{twitter_description}">
  <meta name="twitter:image" content="{og_image}">
  <meta name="theme-color" content="#f7f5f1">
  <title>{title}</title>
  <link rel="icon" href="/favicon.ico?v=20260821-mark4" sizes="any"><link rel="icon" href="/favicon-48.png?v=20260821-mark4" type="image/png" sizes="48x48"><link rel="icon" href="/favicon.svg?v=20260821-mark4" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20260821-mark4"><link rel="manifest" href="/site.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&amp;family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=20260824-hero"><link rel="stylesheet" href="/editorial.css?v=20260813-4"><link rel="stylesheet" href="/blog.css?v=20260828-hc"><link rel="stylesheet" href="/consent.css?v=20260807-1">
  <script src="/script.js?v=20260823-visible" defer=""></script><script src="/consent.js?v=20260724-18" defer=""></script><script src="/blog.js?v=20260824-pub" defer=""></script>
  <script type="application/ld+json">{schema}</script>
</head>
<body class="editorial-page blog-page">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><div class="shell header-grid"><a class="wordmark" href="/" aria-label="Vulcet home"><img src="/vulcet-wordmark.png?v=20260809-2" alt="Vulcet"></a><nav class="desktop-nav" aria-label="Primary navigation"><a href="/work/">Work</a><a href="/redesigns/">Experiments</a><a href="/services/">Services</a><a href="/studio/">Studio</a><a href="/blog/" aria-current="page">Blog</a><a href="/contact/">Contact</a></nav><a class="button button--primary header-cta" href="/contact/">Start a project <span aria-hidden="true">↗</span></a><button class="menu-trigger" type="button" aria-expanded="false" aria-controls="mobile-nav"><span class="sr-only">Open menu</span><span class="menu-icon" aria-hidden="true"><i></i><i></i></span></button></div><div id="mobile-nav" class="mobile-nav" aria-hidden="true" inert=""><nav aria-label="Mobile navigation"><a href="/work/">Work</a><a href="/redesigns/">Experiments</a><a href="/services/">Services</a><a href="/studio/">Studio</a><a href="/blog/" aria-current="page">Blog</a><a href="/contact/">Contact</a></nav><a class="button button--primary" href="/contact/">Start a project <span aria-hidden="true">↗</span></a></div></header>
  <main id="main">
'''

FOOTER = '''</main>
  <footer class="footer">
    <div class="footer-signal" aria-hidden="true"><span></span><b></b></div>
    <div class="shell footer-grid">
      <div class="footer-brand"><a class="wordmark" href="/" aria-label="Vulcet home"><img src="/vulcet-wordmark.png?v=20260809-2" alt="Vulcet"></a><p>Strategy, design and development for brands, products and websites.</p><ul class="footer-social"><li><a href="https://www.instagram.com/thevulcet/" target="_blank" rel="noreferrer noopener" aria-label="Vulcet on Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5.2"></rect><circle cx="12" cy="12" r="4.2"></circle><circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none"></circle></svg></a></li><li><a href="https://x.com/thevulcet" target="_blank" rel="noreferrer noopener" aria-label="Vulcet on X"><svg class="is-solid" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M17.53 3h3.2l-6.99 7.99L22 21h-6.44l-5.04-6.59L4.75 21H1.54l7.48-8.55L2 3h6.6l4.56 6.03L17.53 3Zm-1.12 16.06h1.77L7.68 4.84H5.78l10.63 14.22Z"></path></svg></a></li><li><a href="https://dribbble.com/thevulcet" target="_blank" rel="noreferrer noopener" aria-label="Vulcet on Dribbble"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"></circle><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"></path></svg></a></li><li><a href="https://www.linkedin.com/company/vulcet/" target="_blank" rel="noreferrer noopener" aria-label="Vulcet on LinkedIn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V8h4v1.4A6 6 0 0 1 16 8Z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg></a></li></ul></div>
      <nav class="footer-nav" aria-label="Footer navigation"><div><span>Navigate</span><a href="/">Home</a><a href="/work/">Work</a><a href="/redesigns/">Experiments</a><a href="/services/">Services</a><a href="/studio/">Studio</a><a href="/blog/" aria-current="page">Blog</a><a href="/contact/">Contact</a></div><div><span>Services</span><a href="/services/brand-strategy/">Brand Strategy</a><a href="/services/visual-identity/">Visual Identity</a><a href="/services/product-design/">Product Design</a><a href="/services/web-development/">Web Development</a></div><div><span>More</span><a href="/privacy/">Privacy</a><a href="/site-map/">Site map</a><button class="footer-cookie-link" type="button" data-cookie-settings="">Cookie settings</button></div></nav>
      <div class="footer-contact"><span>Contact</span><a href="mailto:studio@vulcet.com">studio@vulcet.com</a><p>Working internationally</p></div>
      <div class="footer-utility"><small>© <span id="year"></span> Vulcet</small><small>Global branding, product and web design</small><small>Working internationally</small></div>
    </div>
  </footer>
</body></html>
'''

AUTHOR = '''
      <aside class="article-author">
        <div class="article-author-meta"><strong>Vulcet</strong><span>Global studio</span></div>
        <p>Vulcet is a global branding, product and web design studio working internationally from Poland.</p>
        <a href="/studio/">About the studio</a>
      </aside>
'''


def dump_schema(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def article_page(
    *,
    slug: str,
    title: str,
    description: str,
    og_title: str,
    og_description: str,
    twitter_description: str,
    category: str,
    published: str,
    updated: str,
    published_label: str,
    updated_label: str,
    reading: str,
    cover: str,
    cover_alt: str,
    og_image: str,
    h1: str,
    dek: str,
    schema: dict,
    body: str,
    takeaways: list[str] | None,
    related: list[tuple[str, str, str]],
    show_toc: bool = True,
) -> str:
    article_meta = dedent(
        f"""
      <meta property="article:published_time" content="{published}">
      <meta property="article:modified_time" content="{updated}">
      <meta property="article:section" content="{category}">
    """
    ).strip()
    head = HEADER.format(
        description=description,
        canonical=f"https://vulcet.com/blog/{slug}/",
        og_title=og_title,
        og_description=og_description,
        og_type="article",
        og_image=og_image,
        article_meta=article_meta,
        twitter_description=twitter_description,
        title=title,
        schema=dump_schema(schema),
    )
    takeaways_html = ""
    if takeaways:
        items = "".join(f"<li>{t}</li>" for t in takeaways)
        takeaways_html = f'''
      <aside class="article-takeaways" aria-labelledby="takeaways-title">
        <h2 id="takeaways-title">Key takeaways</h2>
        <ul>{items}</ul>
      </aside>'''
    toc_html = (
        '<nav class="article-toc" data-article-toc hidden aria-label="Table of contents"><h2>In this article</h2></nav>'
        if show_toc
        else ""
    )
    related_html = "".join(
        f'<a href="{href}"><small>{kind}</small><strong>{label}</strong></a>' for href, kind, label in related
    )
    dates = f'<p class="article-dates"><span>Published {published_label}</span><span>Updated {updated_label}</span></p>'
    if published == updated:
        dates = f'<p class="article-dates"><span>Published {published_label}</span></p>'
    main = f'''
    <header class="article-hero">
      <div class="shell article-hero-grid">
        <div class="editorial-label"><span>Article</span><span>{category}</span></div>
        <p class="article-kicker"><span>{category}</span><span>{reading}</span></p>
        <h1>{h1}</h1>
        <p class="article-dek">{dek}</p>
        {dates}
        <p class="article-byline">Written by <a href="/studio/">Vulcet</a>.</p>
        <figure class="article-cover">
          <img src="{cover}" width="1600" height="1000" alt="{cover_alt}" fetchpriority="high" decoding="async">
        </figure>
      </div>
    </header>
    <div class="shell article-layout">
      {takeaways_html}
      {toc_html}
      <article class="article-body">
{body}
      </article>
      {AUTHOR}
      <section class="article-related" aria-labelledby="related-title">
        <h2 id="related-title">Continue with</h2>
        <div class="article-related-list">{related_html}</div>
      </section>
      <div class="article-studio">
        <p>Vulcet is a global branding, product and web design studio working internationally from Poland. Strategy, design and engineering stay in one process.</p>
        <p><a href="/contact/">Start a project</a> · <a href="/blog/">All articles</a></p>
      </div>
    </div>
'''
    return head + main + FOOTER


def blog_posting(
    *,
    headline: str,
    description: str,
    url: str,
    published: str,
    updated: str,
    image: str,
    section: str,
    word_count: int,
    minutes: int,
    faq: list[tuple[str, str]] | None = None,
) -> dict:
    graph = [
        {
            "@type": "BlogPosting",
            "headline": headline,
            "description": description,
            "url": url,
            "datePublished": published,
            "dateModified": updated,
            "author": {"@type": "Organization", "name": "Vulcet", "url": "https://vulcet.com/"},
            "publisher": {
                "@type": "Organization",
                "name": "Vulcet",
                "url": "https://vulcet.com/",
                "logo": {"@type": "ImageObject", "url": "https://vulcet.com/vulcet-mark.png"},
            },
            "image": image,
            "articleSection": section,
            "mainEntityOfPage": url,
            "wordCount": word_count,
            "timeRequired": f"PT{minutes}M",
            "inLanguage": "en",
        },
        {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://vulcet.com/"},
                {"@type": "ListItem", "position": 2, "name": "Blog", "item": "https://vulcet.com/blog/"},
                {"@type": "ListItem", "position": 3, "name": headline, "item": url},
            ],
        },
    ]
    if faq:
        graph.append(
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": a},
                    }
                    for q, a in faq
                ],
            }
        )
    return {"@context": "https://schema.org", "@graph": graph}


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print("wrote", path.relative_to(ROOT))


# ---------- Articles ----------

brand_faq = [
    (
        "What is the difference between branding and rebranding?",
        "Branding builds and maintains a coherent system of meaning, visuals and behaviour. Rebranding rebuilds that system when the current one no longer matches the business.",
    ),
    (
        "When is a brand refresh enough?",
        "A refresh is enough when positioning is still true and the main problems are consistency, craft or outdated expression — not a broken offer story.",
    ),
    (
        "Does a rebrand always need a new logo?",
        "No. A logo change without clearer positioning, message hierarchy and application rules rarely solves the real problem.",
    ),
    (
        "How does the website fit into a rebrand?",
        "The website is often the highest-traffic proof of the system. If the site still tells an old story, the rebrand will feel unfinished.",
    ),
]

brand_body = '''
        <p>Most founders do not wake up wanting a rebrand. They wake up tired of explaining the business twice — once in conversation, once through a website, deck or product that does not keep up.</p>
        <p>That gap is rarely a logo problem. It is a system problem: positioning, message hierarchy, visual rules and product surfaces drifting apart until the brand feels older than the company actually is.</p>

        <h2 id="branding-is-a-system">Branding is a system. Rebranding rebuilds it.</h2>
        <p>Branding is the connected set of decisions that make a company recognisable and usable: who it is for, what it stands for, how it speaks, how it looks and how those rules survive across a website, product and sales materials.</p>
        <p>Rebranding is not only a visual update. It is a rebuild of that system when the current one can no longer carry the business.</p>
        <div class="article-callout"><p>If the offer is still true and the friction is inconsistency, start with a refresh. If the market, audience or product has changed enough that the old story misleads, you need a rebrand.</p></div>

        <h2 id="the-rebrand-trap">The rebrand trap</h2>
        <p>Teams often buy a new mark hoping it will create clarity. Without clearer positioning and application rules, the new mark simply travels through the same broken system.</p>
        <p><a href="https://www.apple.com/" target="_blank" rel="noreferrer noopener">Apple</a> is useful here for the opposite reason. Product imagery and typography often carry hierarchy because recognition is already strong. That restraint works because the brand system is mature — not because minimalism is always correct.</p>
        <div class="article-example">
          <h3>Vulcet analysis</h3>
          <p>Copying Apple’s quiet interface without Apple’s recognition usually produces a site that feels empty rather than confident. Restraint is earned by clarity elsewhere.</p>
        </div>

        <h2 id="when-a-refresh-is-enough">When a refresh is enough</h2>
        <p>A refresh fits when:</p>
        <ul>
          <li>the positioning still matches how you sell</li>
          <li>customers already understand the category you occupy</li>
          <li>the main pain is uneven craft, outdated UI patterns or missing rules</li>
          <li>the website can improve without inventing a new offer story</li>
        </ul>
        <p>In those cases, <a href="/services/visual-identity/">visual identity</a> work and a tighter web implementation often unlock more value than a full rename-and-rebuild cycle.</p>

        <h2 id="when-you-need-a-rebrand">When you actually need a rebrand</h2>
        <p>You likely need a rebrand when the business has changed faster than the language around it:</p>
        <ul>
          <li>you entered a new market or price tier</li>
          <li>the product now serves a different buyer</li>
          <li>sales avoids the website because it undercuts the conversation</li>
          <li>two product lines share a name but need different promises</li>
        </ul>
        <p>That work starts with <a href="/services/brand-strategy/">brand strategy</a>, not with exploring typefaces.</p>

        <h2 id="decision-checklist">A fast decision checklist</h2>
        <ol>
          <li><strong>Is the offer still accurate?</strong> If not, strategy first.</li>
          <li><strong>Is sales avoiding the website?</strong> That is a system signal, not a taste signal. Related: <a href="/blog/when-a-business-website-needs-a-redesign/">when a website needs a redesign</a>.</li>
          <li><strong>Can one page explain what you do?</strong> If your team disagrees, the brand story is fragmented.</li>
          <li><strong>Would a cleaner logo fix the sales call?</strong> If the honest answer is no, do not start with a logo.</li>
        </ol>

        <h2 id="where-the-website-sits">Where the website sits in all of this</h2>
        <p>The website is usually the most public application of the brand system. If hierarchy, proof and next steps are unclear, no amount of decorative polish will make the brand feel current.</p>
        <p>For a focused company site that needs clearer enquiry paths, structure and craft matter more than expanding into a large content platform. For a company that publishes markets, case studies and ongoing pages, the brand system has to survive growth without collapsing into inconsistency. See <a href="/blog/business-website-vs-growth-website/">focused site vs content platform</a>.</p>
        <p>On client work such as <a href="/work/anadolu-qida/">Anadolu Qida</a>, the useful move was not “more branding.” It was making product clarity, production story and enquiry paths share one coherent system. On <a href="/work/founderclub/">FounderClub</a>, the brand had to hold a community platform — news, events, membership — without turning into a pile of disconnected screens.</p>

        <h2 id="how-vulcet-approaches-it">How Vulcet approaches it</h2>
        <p>We start with the business constraint. If the message is unclear, we do strategy work before visual exploration. If the message is clear and the expression is tired, we tighten identity and the surfaces that carry it.</p>
        <p>Design and development stay connected so the system does not die in a slide deck.</p>

        <h2 id="faq">FAQ</h2>
        <div class="article-faq">
          <div><h3>What is the difference between branding and rebranding?</h3><p>Branding builds and maintains a coherent system of meaning, visuals and behaviour. Rebranding rebuilds that system when the current one no longer matches the business.</p></div>
          <div><h3>When is a brand refresh enough?</h3><p>A refresh is enough when positioning is still true and the main problems are consistency, craft or outdated expression — not a broken offer story.</p></div>
          <div><h3>Does a rebrand always need a new logo?</h3><p>No. A logo change without clearer positioning, message hierarchy and application rules rarely solves the real problem.</p></div>
          <div><h3>How does the website fit into a rebrand?</h3><p>The website is often the highest-traffic proof of the system. If the site still tells an old story, the rebrand will feel unfinished.</p></div>
        </div>
'''

scope_faq = [
    (
        "What is a focused business website?",
        "A focused company site that makes the offer clear, looks credible, and leads to a contact or enquiry — without unnecessary platform complexity.",
    ),
    (
        "What is a content-led platform?",
        "A deeper site built to evolve: stronger architecture, multilingual or CMS structure, and room for case studies, news or ongoing pages.",
    ),
    (
        "Can I start focused and expand later?",
        "Yes. Many companies start with a clear, smaller site, then expand into a deeper platform when content, markets or sales motion actually require it.",
    ),
    (
        "Which should I choose if I am launching a new company?",
        "Usually a focused site. Launch needs clarity and speed more than a large content system.",
    ),
]

scope_body = '''
        <p>Companies often ask Vulcet for a “modern website” and mean two different things. One team needs a clear company presence that explains the offer and wins enquiries. Another needs a content system that can absorb markets, case studies and publishing without collapsing.</p>
        <p>Those are different scopes. Treating them as the same package is how budgets get spent on complexity the organisation cannot feed.</p>

        <h2 id="focused-site">What a focused business website is for</h2>
        <p>A focused company site should:</p>
        <ul>
          <li>state who the work is for</li>
          <li>make the offer easy to explain</li>
          <li>look credible on mobile and desktop</li>
          <li>lead to a clear enquiry path</li>
          <li>ship with technical SEO and analytics basics</li>
        </ul>
        <p>It is the right shape for professional services, consultants, launches and clean replacements of an unclear old site.</p>
        <div class="article-example">
          <h3>Example: Stripe’s clarity bias</h3>
          <p><a href="https://stripe.com/" target="_blank" rel="noreferrer noopener">Stripe</a> keeps commercial pages oriented around understanding and action. Even as the product surface grew, the public web experience stayed organised around jobs, not internal org charts.</p>
          <p><strong>Vulcet take:</strong> clarity is a structural decision. If your site needs a glossary to explain itself, you do not have a design problem yet — you have an information architecture problem.</p>
        </div>

        <h2 id="content-platform">What a content-led platform is for</h2>
        <p>A deeper, content-led site should:</p>
        <ul>
          <li>carry stronger positioning and deeper page architecture</li>
          <li>support multilingual or multi-market structure when needed</li>
          <li>make room for projects, news or case studies</li>
          <li>use a CMS the team can actually maintain</li>
          <li>hold performance, accessibility and technical SEO as the content grows</li>
        </ul>
        <p>It fits growing and international companies, technical services, and teams that publish regularly.</p>
        <div class="article-example">
          <h3>Example: Notion as a living system</h3>
          <p><a href="https://www.notion.com/" target="_blank" rel="noreferrer noopener">Notion</a>’s public site has to support product education, templates, use cases and ongoing content. The site behaves like a system because the product itself is a system.</p>
          <p><strong>Vulcet take:</strong> do not copy Notion’s breadth if nobody on your team will publish weekly. A large content model without owners becomes an expensive archive.</p>
        </div>

        <h2 id="decision-test">A simple decision test</h2>
        <ol>
          <li><strong>How many pages must exist on day one?</strong> A handful of clear pages points to a focused site. A large map of services, markets and proof points points to a platform.</li>
          <li><strong>Who updates content after launch?</strong> If nobody will, do not buy a heavy CMS. If a team will publish weekly, plan for growth.</li>
          <li><strong>Do you need more than one language now?</strong> “Someday” is not now. Real multilingual needs change architecture.</li>
          <li><strong>Is the offer still changing every month?</strong> Then start focused. Build the platform when the story stabilises.</li>
        </ol>

        <figure class="article-figure">
          <div class="article-figure-frame" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 320" width="960" height="320">
              <rect width="960" height="320" fill="#ebe7e0"/>
              <rect x="48" y="56" width="380" height="208" fill="#f7f5f1" stroke="#121418" stroke-opacity=".12"/>
              <text x="72" y="96" font-family="Inter,Arial,sans-serif" font-size="18" fill="#121418">Focused site</text>
              <text x="72" y="132" font-family="Inter,Arial,sans-serif" font-size="14" fill="#5c636e">Offer · Proof · Contact</text>
              <rect x="532" y="56" width="380" height="208" fill="#f7f5f1" stroke="#121418" stroke-opacity=".12"/>
              <text x="556" y="96" font-family="Inter,Arial,sans-serif" font-size="18" fill="#121418">Content platform</text>
              <text x="556" y="132" font-family="Inter,Arial,sans-serif" font-size="14" fill="#5c636e">Markets · CMS · Case studies</text>
            </svg>
          </div>
          <figcaption>Two scopes, two maintenance realities.<span class="source">Diagram by Vulcet</span></figcaption>
        </figure>

        <h2 id="common-mistakes">Common mistakes</h2>
        <ul>
          <li>Buying a large platform because it sounds more premium</li>
          <li>Shipping a tiny brochure site when sales already depends on case studies and markets</li>
          <li>Judging only by price instead of maintenance reality</li>
          <li>Copying a competitor’s sitemap without their sales motion</li>
        </ul>

        <h2 id="how-vulcet-scopes">How Vulcet scopes it</h2>
        <p>We start with the business, not the template. Structure before styling. Design with engineering. Publish only what is true.</p>
        <p>Depending on the constraint, the work may involve <a href="/services/brand-strategy/">brand strategy</a>, <a href="/services/visual-identity/">visual identity</a>, <a href="/services/product-design/">product design</a> or <a href="/services/web-development/">web development</a> — sometimes one discipline, sometimes several connected.</p>
        <p>If a focused site is enough, we keep it focused. If the company needs depth, we build a system that can take new pages without breaking the brand.</p>

        <h2 id="faq">FAQ</h2>
        <div class="article-faq">
          <div><h3>What is a focused business website?</h3><p>A focused company site that makes the offer clear, looks credible, and leads to a contact or enquiry — without unnecessary platform complexity.</p></div>
          <div><h3>What is a content-led platform?</h3><p>A deeper site built to evolve: stronger architecture, multilingual or CMS structure, and room for case studies, news or ongoing pages.</p></div>
          <div><h3>Can I start focused and expand later?</h3><p>Yes. Many companies start with a clear, smaller site, then expand into a deeper platform when content, markets or sales motion actually require it.</p></div>
          <div><h3>Which should I choose if I am launching a new company?</h3><p>Usually a focused site. Launch needs clarity and speed more than a large content system.</p></div>
        </div>
'''

redesign_faq = [
    (
        "How do I know if my website needs a redesign?",
        "If the offer is hard to explain, key pages are missing, the site no longer matches how you sell, or technical debt blocks progress, a redesign is usually justified.",
    ),
    (
        "Is a redesign the same as a visual refresh?",
        "No. A refresh updates expression. A redesign changes structure, hierarchy and often the underlying system so the site can support the business again.",
    ),
    (
        "Can I redesign without losing SEO?",
        "Yes, if redirects, content mapping and technical basics are planned before launch. Redesigns fail SEO when URLs disappear without a migration plan.",
    ),
    (
        "Should I rebuild on a new CMS automatically?",
        "Only if the current stack cannot support the content model you need. Changing tools without clarifying structure recreates the same mess in a new place.",
    ),
    (
        "What is the smallest useful next step?",
        "Audit whether the problem is message, structure, craft or maintenance. Then choose the smallest scope that removes the real constraint.",
    ),
]

redesign_body = '''
        <p>A redesign request usually arrives with a visual complaint: “It looks outdated.” Sometimes that is true. Often the deeper issue is that the site no longer matches how the company sells, explains itself or operates.</p>
        <p>If you treat every tired website as a cosmetic project, you will spend money on a new skin for the same structural problems.</p>

        <h2 id="refresh-vs-redesign">Redesign is not the same as a visual refresh</h2>
        <p>A refresh updates typography, colour, imagery and component craft while keeping the information architecture mostly intact.</p>
        <p>A redesign changes the hierarchy of pages, the story the site tells and often the publishing model underneath. It is closer to product work than to decoration.</p>
        <div class="article-callout"><p>Ask one question before hiring anyone: if we only made this prettier, would sales still avoid it? If yes, you need structure — not only style.</p></div>

        <h2 id="signs-you-need-a-redesign">Signs the website needs a redesign</h2>
        <h3 id="offer-hard-to-explain">1. The offer is hard to explain on the homepage</h3>
        <p>If visitors cannot answer “what do you do and for whom?” in a few seconds, the page is failing its first job.</p>
        <h3 id="buried-pages">2. Important pages are missing or buried</h3>
        <p>Pricing logic, proof, services and contact paths should not require a scavenger hunt.</p>
        <h3 id="sales-mismatch">3. The site no longer matches how you sell</h3>
        <p>When sales decks, demos and the website tell three different stories, trust leaks.</p>
        <h3 id="technical-debt">4. Technical debt is blocking progress</h3>
        <p>If adding a page takes weeks or mobile behaviour is unreliable, craft alone will not save the system.</p>
        <h3 id="competitor-clarity">5. Competitors look clearer, not flashier</h3>
        <p>Clarity beats novelty. If rivals communicate faster, the redesign brief should start with comprehension, not animation.</p>
        <div class="article-example">
          <h3>Example: Linear’s hierarchy</h3>
          <p><a href="https://linear.app/" target="_blank" rel="noreferrer noopener">Linear</a> uses strong product framing and restrained chrome so the interface and messaging stay easy to scan. The lesson is not “use dark mode.” The lesson is remove competing noise until the product story can breathe.</p>
        </div>

        <h2 id="when-you-do-not">Signs you do not need a full redesign yet</h2>
        <ul>
          <li>the structure is sound and only components feel dated</li>
          <li>copy is weak but page inventory is right</li>
          <li>performance issues can be fixed without rebuilding IA</li>
          <li>the team has not decided what the site must accomplish next</li>
        </ul>

        <h2 id="decide-before-hiring">What to decide before you hire anyone</h2>
        <ol>
          <li>Primary job of the site: enquiry, education, recruitment, product signup?</li>
          <li>Which pages are mandatory on day one?</li>
          <li>Who will maintain content after launch?</li>
          <li>Which URLs must keep ranking?</li>
        </ol>

        <h2 id="how-vulcet-scopes">How Vulcet scopes the work</h2>
        <p>We pick the smallest scope that removes the real constraint.</p>
        <h3 id="strategy-first">Unclear offer or positioning</h3>
        <p>Start with <a href="/services/brand-strategy/">brand strategy</a> before redesigning screens.</p>
        <h3 id="identity-and-web">Expression is tired, story is true</h3>
        <p>Tighten <a href="/services/visual-identity/">visual identity</a> and rebuild the site surfaces that carry it.</p>
        <h3 id="product-surfaces">The “website” is actually a product</h3>
        <p>Use <a href="/services/product-design/">product design</a> when journeys, states and interaction models are the bottleneck.</p>
        <h3 id="implementation-care">Implementation and ongoing quality</h3>
        <p><a href="/services/web-development/">Web development</a> covers responsive implementation, technical foundations and the care required after launch.</p>

        <h2 id="protect-search">A redesign process that protects search and trust</h2>
        <p>Map old URLs to new ones. Keep or improve unique content that already earns attention. Test redirects. Confirm analytics before calling the launch done.</p>
        <p>Google’s own guidance on site moves and redirects is a useful baseline: plan migrations deliberately rather than hoping search engines guess your intent. See <a href="https://developers.google.com/search/docs/crawling-indexing/301-redirects" target="_blank" rel="noreferrer noopener">Google’s documentation on redirects</a>.</p>

        <h2 id="budget-mistakes">Mistakes that waste the budget</h2>
        <ul>
          <li>Designing pages before agreeing the sitemap</li>
          <li>Choosing a CMS before defining content ownership</li>
          <li>Launching without redirects</li>
          <li>Measuring success only by aesthetic approval inside the team</li>
        </ul>

        <h2 id="faq">FAQ</h2>
        <div class="article-faq">
          <div><h3>How do I know if my website needs a redesign?</h3><p>If the offer is hard to explain, key pages are missing, the site no longer matches how you sell, or technical debt blocks progress, a redesign is usually justified.</p></div>
          <div><h3>Is a redesign the same as a visual refresh?</h3><p>No. A refresh updates expression. A redesign changes structure, hierarchy and often the underlying system so the site can support the business again.</p></div>
          <div><h3>Can I redesign without losing SEO?</h3><p>Yes, if redirects, content mapping and technical basics are planned before launch. Redesigns fail SEO when URLs disappear without a migration plan.</p></div>
          <div><h3>Should I rebuild on a new CMS automatically?</h3><p>Only if the current stack cannot support the content model you need. Changing tools without clarifying structure recreates the same mess in a new place.</p></div>
          <div><h3>What is the smallest useful next step?</h3><p>Audit whether the problem is message, structure, craft or maintenance. Then choose the smallest scope that removes the real constraint.</p></div>
        </div>
'''

product_faq = [
    (
        "What is product design?",
        "Product design defines how a digital product works for real users: journeys, interface systems, states and the decisions that make the product useful and coherent.",
    ),
    (
        "How is product design different from UI design?",
        "UI design focuses on visual and interactive presentation. Product design includes research, flows, prioritisation and system behaviour — UI is one output of that work.",
    ),
    (
        "When does a company need product design?",
        "When a website alone cannot hold the experience — dashboards, onboarding, membership, multi-step tools or any flow with persistent states.",
    ),
    (
        "Does product design always mean building an app?",
        "No. Many product design engagements improve a complex website experience, customer portal or content platform without shipping a native app.",
    ),
]

product_body = '''
        <p>Product design is often reduced to “making screens look modern.” That definition is too thin to be useful. Product design is the discipline of shaping how a digital product behaves for people trying to complete real jobs.</p>
        <p>If branding answers who you are, and web design answers how you present and convert, product design answers how the experience works once someone is inside the system.</p>

        <h2 id="definition">A practical definition</h2>
        <p>Product design covers the decisions between a user’s intent and a reliable outcome: information architecture, flows, interface patterns, empty and error states, responsiveness and the rules that keep the experience coherent as features grow.</p>
        <p>It is not the same as visual identity, and it is not only high-fidelity mockups. Visual craft matters, but only after the product logic is clear.</p>

        <h2 id="what-it-includes">What product design usually includes</h2>
        <ul>
          <li>problem framing and success criteria</li>
          <li>user journeys and prioritised flows</li>
          <li>wireframes and interactive prototypes</li>
          <li>UI systems and component behaviour</li>
          <li>collaboration with engineering on feasibility</li>
        </ul>

        <h2 id="examples">Real-world examples</h2>
        <div class="article-example">
          <h3>Figma</h3>
          <p><a href="https://www.figma.com/" target="_blank" rel="noreferrer noopener">Figma</a> succeeds as a product because collaboration is treated as a first-class behaviour, not a feature bolted onto a drawing tool. Multiplayer presence, permissions and file organisation are product decisions.</p>
          <p><strong>Vulcet take:</strong> if your product’s core verb is unclear — edit, share, approve, publish — no amount of illustration work will make the experience feel inevitable.</p>
        </div>
        <div class="article-example">
          <h3>Airbnb</h3>
          <p><a href="https://www.airbnb.com/" target="_blank" rel="noreferrer noopener">Airbnb</a>’s booking flows have to manage trust, inventory complexity and mobile constraints at once. The interface is memorable, but the product design problem is confidence under uncertainty.</p>
        </div>

        <figure class="article-figure">
          <div class="article-figure-frame" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 300" width="960" height="300">
              <rect width="960" height="300" fill="#ebe7e0"/>
              <rect x="60" y="70" width="180" height="160" fill="#f7f5f1" stroke="#121418" stroke-opacity=".14"/>
              <text x="78" y="110" font-family="Inter,Arial,sans-serif" font-size="16" fill="#121418">Intent</text>
              <rect x="290" y="70" width="180" height="160" fill="#f7f5f1" stroke="#121418" stroke-opacity=".14"/>
              <text x="308" y="110" font-family="Inter,Arial,sans-serif" font-size="16" fill="#121418">Flow</text>
              <rect x="520" y="70" width="180" height="160" fill="#f7f5f1" stroke="#121418" stroke-opacity=".14"/>
              <text x="538" y="110" font-family="Inter,Arial,sans-serif" font-size="16" fill="#121418">Interface</text>
              <rect x="750" y="70" width="150" height="160" fill="#121418"/>
              <text x="772" y="110" font-family="Inter,Arial,sans-serif" font-size="16" fill="#f7f5f1">Outcome</text>
            </svg>
          </div>
          <figcaption>Product design connects intent to outcome through flow and interface decisions.<span class="source">Diagram by Vulcet</span></figcaption>
        </figure>

        <h2 id="when-companies-need-it">When companies actually need it</h2>
        <p>You need product design when the experience has states: accounts, onboarding, dashboards, membership, approvals, search with filters, or multi-step tools. A marketing site can present those products. It cannot replace designing them.</p>
        <p>On <a href="/work/founderclub/">FounderClub</a>, the work sat between brand, product structure and development because a community platform is not a brochure. Events, news and membership had to behave as one system.</p>

        <h2 id="vulcet-approach">How Vulcet approaches product design</h2>
        <p>We begin with the job to be done and the constraints of the business. Then we design structure and interaction with engineering in the room, so the UI system is buildable.</p>
        <p>If you are scoping this kind of work, start with our <a href="/services/product-design/">product design service</a>.</p>

        <h2 id="faq">FAQ</h2>
        <div class="article-faq">
          <div><h3>What is product design?</h3><p>Product design defines how a digital product works for real users: journeys, interface systems, states and the decisions that make the product useful and coherent.</p></div>
          <div><h3>How is product design different from UI design?</h3><p>UI design focuses on visual and interactive presentation. Product design includes research, flows, prioritisation and system behaviour — UI is one output of that work.</p></div>
          <div><h3>When does a company need product design?</h3><p>When a website alone cannot hold the experience — dashboards, onboarding, membership, multi-step tools or any flow with persistent states.</p></div>
          <div><h3>Does product design always mean building an app?</h3><p>No. Many product design engagements improve a complex website experience, customer portal or content platform without shipping a native app.</p></div>
        </div>
'''

saas_faq = [
    (
        "Why do so many SaaS websites look the same?",
        "Shared component libraries, the same conversion templates, similar audience expectations and risk-averse brand decisions push teams toward a narrow visual range.",
    ),
    (
        "Is consistency across SaaS sites always bad?",
        "No. Familiar patterns help comprehension. The problem starts when familiarity replaces positioning and every product sounds interchangeable.",
    ),
    (
        "How can a SaaS company differentiate without becoming weird?",
        "Differentiate in hierarchy, language, proof and product demonstration first. Visual distinctiveness should follow a clearer story, not precede it.",
    ),
]

saas_body = '''
        <p>Scroll a few SaaS homepages and the pattern often repeats: soft gradient, product UI in perspective, three feature columns, logo wall, enterprise testimonial, pricing tease. That sameness is not an accident. It comes from shared tools, shared templates and a shared preference for looking safe.</p>

        <h2 id="why-it-happens">Why the pattern stuck</h2>
        <p>Design systems and component kits made competent UI easier to ship. Templates made conversion layouts easy to copy. Investors and buyers learned to trust a certain “serious product” look. Teams then optimised for not looking wrong.</p>
        <p>The result is a category aesthetic. It helps teams look credible quickly, but it also makes products harder to tell apart when every site uses the same hierarchy and proof pattern.</p>

        <h2 id="what-sameness-costs">What sameness actually costs</h2>
        <p>When every homepage follows the same structure, visitors scan for familiar blocks instead of reading your specific offer. Distinction then has to be rebuilt later in sales conversations, which is slower and more expensive than earning it on the site.</p>
        <div class="article-example">
          <h3>Contrast: Stripe vs generic fintech</h3>
          <p><a href="https://stripe.com/" target="_blank" rel="noreferrer noopener">Stripe</a> uses clarity, documentation depth and product language as competitive surface area. Many fintech clones copy the calm palette and miss the harder part: precise explanation of value.</p>
          <p><strong>Vulcet take:</strong> a calm visual system only works when the offer and hierarchy are already clear. Without that, the page just feels unfinished.</p>
        </div>

        <h2 id="where-differentiation-lives">Where differentiation should live</h2>
        <ul>
          <li>the first sentence of the homepage</li>
          <li>the order of proof versus features</li>
          <li>how the product is demonstrated, not decorated</li>
          <li>language that only your category experts would write</li>
        </ul>
        <p>Visual identity can then amplify a real position instead of inventing one.</p>

        <h2 id="minimal-is-not-a-strategy">“Minimal” is not a strategy</h2>
        <p>Minimal interfaces are often a way of postponing hard decisions. Removing chrome does not create meaning on its own. Meaning comes from hierarchy and contrast: choosing which idea deserves emphasis, and which supporting points can wait.</p>
        <p>Related reading: <a href="/blog/your-brand-isnt-outdated-your-system-is/">your brand isn’t outdated — your system is</a>.</p>

        <h2 id="vulcet-view">What Vulcet does differently</h2>
        <p>We treat the website as evidence of how the company thinks. That means fewer generic feature grids and more structure that matches the sales conversation.</p>
        <p>Experiments such as <a href="/redesigns/kinetic-clarity/">Kinetic Clarity</a> exist to pressure-test product storytelling outside client constraints. Client work such as <a href="/work/founderclub/">FounderClub</a> has to handle real community complexity, which makes template layouts harder to defend.</p>
        <p>If your site feels interchangeable, begin with <a href="/services/brand-strategy/">brand strategy</a> and a clearer web narrative, then implement through <a href="/services/web-development/">web development</a>.</p>

        <h2 id="faq">FAQ</h2>
        <div class="article-faq">
          <div><h3>Why do so many SaaS websites look the same?</h3><p>Shared component libraries, the same conversion templates, similar audience expectations and risk-averse brand decisions push teams toward a narrow visual range.</p></div>
          <div><h3>Is consistency across SaaS sites always bad?</h3><p>No. Familiar patterns help comprehension. The problem starts when familiarity replaces positioning and every product sounds interchangeable.</p></div>
          <div><h3>How can a SaaS company differentiate without becoming weird?</h3><p>Differentiate in hierarchy, language, proof and product demonstration first. Visual distinctiveness should follow a clearer story, not precede it.</p></div>
        </div>
'''

ai_faq = [
    (
        "Why do AI products look so similar?",
        "Many teams ship around the same chat metaphor, use similar model capabilities, and borrow the same dashboard and onboarding patterns under launch pressure.",
    ),
    (
        "Is the chat interface always wrong?",
        "No. Chat is appropriate when conversation is the primary interaction. It becomes lazy when the product’s real job is structured work that needs better controls.",
    ),
    (
        "How should AI product design start?",
        "Start from the job outcome and failure modes, then choose interaction patterns. Model novelty is not a substitute for workflow design.",
    ),
]

ai_body = '''
        <p>Open enough AI products and you will see a familiar composition: left rail, empty chat, suggested prompts, and a generate action. The models underneath may differ, but the product surfaces often do not.</p>
        <p>That convergence tends to happen when teams design for the demo more than for the ongoing work people need to complete.</p>

        <h2 id="the-chat-default">The chat default</h2>
        <p>Chat is a useful interaction model when conversation is genuinely the job. It becomes a problem when teams use it to postpone other product decisions. If everything is a prompt, objects, permissions, review states and recovery paths often stay undefined.</p>
        <p>Users then inherit that ambiguity and have to invent a workflow the product never designed.</p>

        <h2 id="examples">Where stronger products diverge</h2>
        <div class="article-example">
          <h3>Notion AI inside a structured workspace</h3>
          <p><a href="https://www.notion.com/product/ai" target="_blank" rel="noreferrer noopener">Notion’s AI features</a> sit inside documents, databases and existing mental models. The AI is a layer on structured work, not a disconnected chat island.</p>
          <p><strong>Vulcet take:</strong> AI feels more valuable when it operates on objects people already manage — pages, tasks, records — instead of asking them to restart in a blank thread.</p>
        </div>
        <div class="article-example">
          <h3>Figma’s product grammar</h3>
          <p>Even as AI features appear across design tools, <a href="https://www.figma.com/" target="_blank" rel="noreferrer noopener">Figma</a>’s strength remains a clear grammar of frames, components and collaboration. New capabilities have somewhere coherent to land.</p>
        </div>

        <h2 id="design-for-failure">Design for failure modes first</h2>
        <p>AI products often fail in visible ways: inaccurate answers, the wrong tone, incomplete actions, or brittle integrations. Product design should account for those cases with confidence signals, citations where relevant, undo paths and human review when the risk is high.</p>
        <p>A generate action without a recovery model leaves people stuck when the output is wrong. That is a product gap, not a temporary polish issue.</p>

        <h2 id="vulcet-lens">Vulcet’s lens</h2>
        <p>We ask what the user must accomplish, what can go wrong, and which parts of the job should stay explicit controls versus conversational shortcuts.</p>
        <p>That process sits inside our <a href="/services/product-design/">product design</a> practice. For adjacent thinking on category aesthetics, read <a href="/blog/why-most-saas-websites-look-the-same/">why most SaaS websites look the same</a>.</p>

        <h2 id="faq">FAQ</h2>
        <div class="article-faq">
          <div><h3>Why do AI products look so similar?</h3><p>Many teams ship around the same chat metaphor, use similar model capabilities, and borrow the same dashboard and onboarding patterns under launch pressure.</p></div>
          <div><h3>Is the chat interface always wrong?</h3><p>No. Chat is appropriate when conversation is the primary interaction. It becomes lazy when the product’s real job is structured work that needs better controls.</p></div>
          <div><h3>How should AI product design start?</h3><p>Start from the job outcome and failure modes, then choose interaction patterns. Model novelty is not a substitute for workflow design.</p></div>
        </div>
'''

experiments_faq = [
    (
        "What are Vulcet redesign experiments?",
        "Studio studies where Vulcet redesigns or reimagines product and marketing surfaces to test structure, motion and storytelling outside client delivery constraints.",
    ),
    (
        "Are experiments client work?",
        "No. They are studio studies. They are not affiliated with the brands referenced and are not for sale as official work for those companies.",
    ),
    (
        "Why publish experiments at all?",
        "They make Vulcet’s thinking visible, create a library of interaction patterns, and sharpen the judgement we bring into client projects.",
    ),
]

experiments_body = '''
        <p>Client projects are constrained by business reality — and they should be. Experiments exist for a different reason: to test ideas before they are asked to carry a live sales funnel or production content model.</p>
        <p>Vulcet publishes redesign experiments as a public sketchbook of structure, motion and product storytelling.</p>

        <h2 id="what-they-are">What these experiments are</h2>
        <p>They are studio studies. Some reimagine a product page. Some explore interaction models. None of them claim to be official work for the brands referenced.</p>
        <p>Browse the current set on <a href="/redesigns/">Vulcet Experiments</a>, including <a href="/redesigns/kinetic-clarity/">Kinetic Clarity</a>, <a href="/redesigns/hold/">HOLD</a> and <a href="/redesigns/case-studio/">Case Studio</a>.</p>

        <h2 id="what-we-learn">What we learn that transfers</h2>
        <ul>
          <li>how much hierarchy a hero can hold before it collapses</li>
          <li>when motion clarifies a product versus when it becomes noise</li>
          <li>how case-study narrative can stay specific without becoming a brochure</li>
          <li>where interaction patterns fail on mobile first</li>
        </ul>
        <div class="article-example">
          <h3>HOLD</h3>
          <p><a href="/redesigns/hold/">HOLD</a> explores a tighter product narrative and interaction surface. The useful lesson is pacing: how much of the story should be visible immediately, and what should unfold through use.</p>
        </div>
        <div class="article-example">
          <h3>Kinetic Clarity</h3>
          <p><a href="/redesigns/kinetic-clarity/">Kinetic Clarity</a> pressures product-page storytelling. Motion is only justified when it helps someone understand the object, not when it proves the designer has a timeline tool.</p>
        </div>

        <h2 id="how-this-helps-clients">How this helps client work</h2>
        <p>Experiments create judgement. When a founder asks for “something bold,” we can separate bold structure from decorative risk. That judgement shows up in client projects such as <a href="/work/founderclub/">FounderClub</a> and <a href="/work/anadolu-qida/">Anadolu Qida</a> — where clarity beats novelty.</p>

        <h2 id="how-to-read-them">How to read an experiment</h2>
        <ol>
          <li>Ignore brand affiliation claims — there are none.</li>
          <li>Look for the structural idea being tested.</li>
          <li>Ask whether the same idea would survive a real CMS, real content and real mobile traffic.</li>
        </ol>
        <p>If you want that thinking applied to your product or site, start at <a href="/services/product-design/">product design</a> or <a href="/contact/">contact</a>.</p>

        <h2 id="faq">FAQ</h2>
        <div class="article-faq">
          <div><h3>What are Vulcet redesign experiments?</h3><p>Studio studies where Vulcet redesigns or reimagines product and marketing surfaces to test structure, motion and storytelling outside client delivery constraints.</p></div>
          <div><h3>Are experiments client work?</h3><p>No. They are studio studies. They are not affiliated with the brands referenced and are not for sale as official work for those companies.</p></div>
          <div><h3>Why publish experiments at all?</h3><p>They make Vulcet’s thinking visible, create a library of interaction patterns, and sharpen the judgement we bring into client projects.</p></div>
        </div>
'''


def build_articles() -> None:
    write(
        BLOG / "human-check-captcha-alternative/index.html",
        article_page(
            slug="human-check-captcha-alternative",
            title="Human Check: Rethinking CAPTCHA Verification | Vulcet",
            description="Human Check explores whether a simple drag can contribute to human verification without CAPTCHA puzzles — and what pointer movement can actually reveal.",
            og_title="Human Check: Rethinking CAPTCHA Verification | Vulcet",
            og_description="Can verification become part of an interaction instead of an interruption? What we learned building Human Check.",
            twitter_description="An experiment in movement-based human verification — honest limits included.",
            category="Experiments",
            published="2026-08-28",
            updated="2026-08-28",
            published_label="Aug 28, 2026",
            updated_label="Aug 28, 2026",
            reading="18 min read",
            cover="/blog/assets/cover-human-check.svg?v=20260828-1",
            cover_alt="Editorial cover — a pointer trajectory traveling toward a target ring.",
            og_image="https://vulcet.com/blog/assets/og-human-check.png",
            h1="Rethinking CAPTCHA: Can verification become part of the interaction?",
            dek="Human Check is a studio experiment: one drag, a trajectory worth reading, and an honest look at what movement can — and cannot — tell us about bots.",
            schema=blog_posting(
                headline="Rethinking CAPTCHA: Can Verification Become Part of the Interaction?",
                description="Human Check explores whether a simple drag can contribute to human verification without CAPTCHA puzzles. What pointer movement reveals — and what it cannot prove.",
                url="https://vulcet.com/blog/human-check-captcha-alternative/",
                published="2026-08-28",
                updated="2026-08-28",
                image="https://vulcet.com/blog/assets/og-human-check.png",
                section="Experiments",
                word_count=2900,
                minutes=18,
                faq=human_check_faq,
            ),
            body=human_check_body,
            takeaways=[
                "Verification often interrupts the interaction it protects — modern systems already move toward lower friction.",
                "A drag is a time series; Human Check analyzes geometry, kinematics and corrections — not just start and end points.",
                "human_like means movement looked structured under heuristics — not proof of identity or humanity.",
                "Uncertainty and insufficient_signal are deliberate outputs when evidence is weak.",
                "Trajectory analysis runs in the browser in normal use; this is an experiment, not production security.",
            ],
            related=[
                ("/experiments/human-check/", "Experiment", "Human Check"),
                ("/blog/what-redesign-experiments-teach/", "Article", "What redesign experiments teach"),
            ],
        ),
    )

    write(
        BLOG / "your-brand-isnt-outdated-your-system-is/index.html",
        article_page(
            slug="your-brand-isnt-outdated-your-system-is",
            title="Your Brand Isn’t Outdated. Your System Is. | Vulcet",
            description="Branding vs rebranding: when a refresh is enough, when you need to rebuild, and how website systems reveal brand problems.",
            og_title="Your Brand Isn’t Outdated. Your System Is. | Vulcet",
            og_description="When a brand refresh is enough — and when you need a full system rebuild.",
            twitter_description="Branding vs rebranding, with Vulcet’s decision framework.",
            category="Branding",
            published="2026-08-17",
            updated="2026-08-24",
            published_label="Aug 17, 2026",
            updated_label="Aug 24, 2026",
            reading="10 min read",
            cover="/blog/assets/cover-branding-system.webp?v=20260817-1",
            cover_alt="Open notebook with a brand mark sketch and system notes.",
            og_image="https://vulcet.com/blog/assets/og-branding-system.jpg",
            h1="Your brand isn’t outdated. Your system is.",
            dek="Branding vs rebranding — when a refresh is enough, and when the business needs a rebuild.",
            schema=blog_posting(
                headline="Your Brand Isn’t Outdated. Your System Is.",
                description="Branding vs rebranding: when a refresh is enough, when you need to rebuild, and how website systems reveal brand problems.",
                url="https://vulcet.com/blog/your-brand-isnt-outdated-your-system-is/",
                published="2026-08-17",
                updated="2026-08-24",
                image="https://vulcet.com/blog/assets/cover-branding-system.webp",
                section="Branding",
                word_count=1450,
                minutes=10,
                faq=brand_faq,
            ),
            body=brand_body,
            takeaways=[
                "Most “outdated brand” problems are system problems: message, rules and surfaces drifting apart.",
                "A refresh fixes consistency and craft. A rebrand rebuilds positioning and structure.",
                "Do not start with a logo if the sales conversation and website already disagree.",
                "The website is usually the highest-traffic proof of whether the brand system works.",
            ],
            related=[
                ("/blog/when-a-business-website-needs-a-redesign/", "Article", "When a website needs a redesign"),
                ("/services/brand-strategy/", "Service", "Brand Strategy"),
                ("/work/anadolu-qida/", "Work", "Anadolu Qida case study"),
            ],
        ),
    )

    write(
        BLOG / "business-website-vs-growth-website/index.html",
        article_page(
            slug="business-website-vs-growth-website",
            title="Focused Website vs Content Platform | Vulcet",
            description="How to choose between a focused business website and a deeper content-led platform — without buying complexity you cannot maintain.",
            og_title="Focused Website vs Content Platform | Vulcet",
            og_description="Choose the right website scope: focused presence or a content platform that can evolve.",
            twitter_description="Focused site or content platform — how Vulcet scopes the decision.",
            category="Strategy",
            published="2026-08-16",
            updated="2026-08-24",
            published_label="Aug 16, 2026",
            updated_label="Aug 24, 2026",
            reading="9 min read",
            cover="/blog/assets/cover-business-vs-growth.webp?v=20260816-1",
            cover_alt="Two notebooks on a desk — cover for focused website versus content platform.",
            og_image="https://vulcet.com/blog/assets/og-business-vs-growth.jpg",
            h1="Focused website vs content platform: which do you need?",
            dek="A clear company presence or a system that can evolve. How to choose scope without overbuilding.",
            schema=blog_posting(
                headline="Focused Website vs Content Platform: Which Do You Need?",
                description="How to choose between a focused business website and a deeper content-led platform — without buying complexity you cannot maintain.",
                url="https://vulcet.com/blog/business-website-vs-growth-website/",
                published="2026-08-16",
                updated="2026-08-24",
                image="https://vulcet.com/blog/assets/cover-business-vs-growth.webp",
                section="Strategy",
                word_count=1300,
                minutes=9,
                faq=scope_faq,
            ),
            body=scope_body,
            takeaways=[
                "“Modern website” usually hides two scopes: a focused presence or a content platform.",
                "Choose based on page inventory, publishing ownership and language needs — not prestige.",
                "A large CMS without owners becomes an expensive archive.",
                "Vulcet scopes from the business constraint, then applies the right disciplines.",
            ],
            related=[
                ("/blog/when-a-business-website-needs-a-redesign/", "Article", "When a website needs a redesign"),
                ("/services/web-development/", "Service", "Web Development"),
                ("/services/brand-strategy/", "Service", "Brand Strategy"),
            ],
        ),
    )

    write(
        BLOG / "when-a-business-website-needs-a-redesign/index.html",
        article_page(
            slug="when-a-business-website-needs-a-redesign",
            title="When a Website Needs a Redesign | Vulcet",
            description="Clear signs your company site needs a redesign — and when a refresh is enough. How Vulcet decides scope without defaulting to a full rebuild.",
            og_title="When a Website Needs a Redesign | Vulcet",
            og_description="Signs a company website needs a redesign, and when a refresh is enough.",
            twitter_description="Redesign vs refresh — a practical decision guide from Vulcet.",
            category="Web Design",
            published="2026-08-14",
            updated="2026-08-24",
            published_label="Aug 14, 2026",
            updated_label="Aug 24, 2026",
            reading="11 min read",
            cover="/blog/assets/cover-website-redesign.webp?v=20260814-1",
            cover_alt="Quiet studio desk by a window — cover for the website redesign article.",
            og_image="https://vulcet.com/blog/assets/og-website-redesign.jpg",
            h1="When a business website needs a redesign (and when it does not)",
            dek="Clear signs a company site needs a rebuild — and when a refresh or rewrite is enough.",
            schema=blog_posting(
                headline="When a Business Website Needs a Redesign (And When It Does Not)",
                description="Clear signs your company site needs a redesign — and when a refresh is enough. How Vulcet decides scope without defaulting to a full rebuild.",
                url="https://vulcet.com/blog/when-a-business-website-needs-a-redesign/",
                published="2026-08-14",
                updated="2026-08-24",
                image="https://vulcet.com/blog/assets/cover-website-redesign.webp",
                section="Web Design",
                word_count=1600,
                minutes=11,
                faq=redesign_faq,
            ),
            body=redesign_body,
            takeaways=[
                "A visual complaint often hides a structural problem.",
                "Refresh when craft is tired. Redesign when hierarchy and sales motion no longer match.",
                "Decide the site’s job, page inventory and content ownership before hiring.",
                "Protect SEO with redirects and content mapping — not hope.",
            ],
            related=[
                ("/blog/business-website-vs-growth-website/", "Article", "Focused site vs content platform"),
                ("/services/web-development/", "Service", "Web Development"),
                ("/work/founderclub/", "Work", "FounderClub case study"),
            ],
        ),
    )

    write(
        BLOG / "what-is-product-design/index.html",
        article_page(
            slug="what-is-product-design",
            title="What Is Product Design? | Vulcet",
            description="A clear guide to product design: what it includes, how it differs from UI design, and when a company actually needs it.",
            og_title="What Is Product Design? | Vulcet",
            og_description="Product design beyond pretty screens — journeys, systems and outcomes.",
            twitter_description="What product design is, with examples and Vulcet’s approach.",
            category="Product Design",
            published="2026-08-24",
            updated="2026-08-24",
            published_label="Aug 24, 2026",
            updated_label="Aug 24, 2026",
            reading="9 min read",
            cover="/blog/assets/cover-product-design.svg",
            cover_alt="Abstract editorial cover for Vulcet’s product design guide.",
            og_image="https://vulcet.com/blog/assets/og-product-design.png",
            h1="What is product design?",
            dek="A practical definition for founders: how digital products become useful, coherent and buildable.",
            schema=blog_posting(
                headline="What Is Product Design?",
                description="A clear guide to product design: what it includes, how it differs from UI design, and when a company actually needs it.",
                url="https://vulcet.com/blog/what-is-product-design/",
                published="2026-08-24",
                updated="2026-08-24",
                image="https://vulcet.com/blog/assets/og-product-design.png",
                section="Product Design",
                word_count=1250,
                minutes=9,
                faq=product_faq,
            ),
            body=product_body,
            takeaways=[
                "Product design shapes behaviour and outcomes, not only visual polish.",
                "UI is an output of product design, not a synonym for it.",
                "You need it when the experience has states, flows and ongoing use.",
                "Strong products make the core verb unmistakable.",
            ],
            related=[
                ("/services/product-design/", "Service", "Product Design"),
                ("/blog/why-ai-products-look-the-same/", "Article", "Why AI products look the same"),
                ("/work/founderclub/", "Work", "FounderClub case study"),
            ],
        ),
    )

    write(
        BLOG / "why-most-saas-websites-look-the-same/index.html",
        article_page(
            slug="why-most-saas-websites-look-the-same",
            title="Why Most SaaS Websites Look the Same | Vulcet",
            description="Why SaaS marketing sites converge on the same look — and how to differentiate through hierarchy, language and product demonstration.",
            og_title="Why Most SaaS Websites Look the Same | Vulcet",
            og_description="Category aesthetics, template fear, and where SaaS differentiation actually lives.",
            twitter_description="An editorial take on SaaS website sameness from Vulcet.",
            category="Web Design",
            published="2026-08-24",
            updated="2026-08-24",
            published_label="Aug 24, 2026",
            updated_label="Aug 24, 2026",
            reading="8 min read",
            cover="/blog/assets/cover-saas-sameness.svg",
            cover_alt="Abstract editorial cover about SaaS website sameness.",
            og_image="https://vulcet.com/blog/assets/og-saas-sameness.png",
            h1="Why most SaaS websites look the same",
            dek="Shared templates, familiar conversion patterns, and a narrow idea of what “credible” looks like — plus where differentiation should start instead.",
            schema=blog_posting(
                headline="Why Most SaaS Websites Look the Same",
                description="Why SaaS marketing sites converge on the same look — and how to differentiate through hierarchy, language and product demonstration.",
                url="https://vulcet.com/blog/why-most-saas-websites-look-the-same/",
                published="2026-08-24",
                updated="2026-08-24",
                image="https://vulcet.com/blog/assets/og-saas-sameness.png",
                section="Web Design",
                word_count=1100,
                minutes=8,
                faq=saas_faq,
            ),
            body=saas_body,
            takeaways=[
                "Sameness comes from shared kits, templates and risk aversion.",
                "Familiar patterns help comprehension until they erase positioning.",
                "Differentiate in story, proof and demonstration before visual novelty.",
                "Quiet visuals still need a clear offer and hierarchy.",
            ],
            related=[
                ("/blog/your-brand-isnt-outdated-your-system-is/", "Article", "Your brand isn’t outdated"),
                ("/services/brand-strategy/", "Service", "Brand Strategy"),
                ("/redesigns/kinetic-clarity/", "Experiment", "Kinetic Clarity"),
            ],
        ),
    )

    write(
        BLOG / "why-ai-products-look-the-same/index.html",
        article_page(
            slug="why-ai-products-look-the-same",
            title="Why Every AI Product Is Starting to Look the Same | Vulcet",
            description="Why AI products converge on the same chat UI — and how to design around jobs, failure modes and structured workflows instead.",
            og_title="Why Every AI Product Is Starting to Look the Same | Vulcet",
            og_description="Chat defaults, demo-driven design, and a better starting point for AI product UX.",
            twitter_description="An editorial take on AI product sameness from Vulcet.",
            category="Product Design",
            published="2026-08-24",
            updated="2026-08-24",
            published_label="Aug 24, 2026",
            updated_label="Aug 24, 2026",
            reading="8 min read",
            cover="/blog/assets/cover-ai-sameness.svg",
            cover_alt="Abstract editorial cover about AI product interface sameness.",
            og_image="https://vulcet.com/blog/assets/og-ai-sameness.png",
            h1="Why every AI product is starting to look the same",
            dek="When teams default to chat as the whole product surface, interfaces start to look interchangeable.",
            schema=blog_posting(
                headline="Why Every AI Product Is Starting to Look the Same",
                description="Why AI products converge on the same chat UI — and how to design around jobs, failure modes and structured workflows instead.",
                url="https://vulcet.com/blog/why-ai-products-look-the-same/",
                published="2026-08-24",
                updated="2026-08-24",
                image="https://vulcet.com/blog/assets/og-ai-sameness.png",
                section="Product Design",
                word_count=1050,
                minutes=8,
                faq=ai_faq,
            ),
            body=ai_body,
            takeaways=[
                "Chat works when conversation is the job — not as a substitute for product structure.",
                "AI is usually more useful on structured objects than in blank threads.",
                "Plan for failure modes — undo, review, confidence — before polishing the generate action.",
                "Start from the job outcome, then choose interaction patterns.",
            ],
            related=[
                ("/blog/what-is-product-design/", "Article", "What is product design?"),
                ("/services/product-design/", "Service", "Product Design"),
                ("/blog/why-most-saas-websites-look-the-same/", "Article", "SaaS website sameness"),
            ],
        ),
    )

    write(
        BLOG / "what-redesign-experiments-teach/index.html",
        article_page(
            slug="what-redesign-experiments-teach",
            title="What Redesign Experiments Teach | Vulcet",
            description="Why Vulcet publishes redesign experiments — and what HOLD, Kinetic Clarity and Case Studio teach about structure, motion and storytelling.",
            og_title="What Redesign Experiments Teach | Vulcet",
            og_description="Studio experiments as a public sketchbook for product and web storytelling.",
            twitter_description="What Vulcet learns from redesign experiments — and how it transfers to clients.",
            category="Experiments",
            published="2026-08-24",
            updated="2026-08-24",
            published_label="Aug 24, 2026",
            updated_label="Aug 24, 2026",
            reading="7 min read",
            cover="/blog/assets/cover-experiments.svg",
            cover_alt="Abstract editorial cover for Vulcet redesign experiments.",
            og_image="https://vulcet.com/blog/assets/og-redesign-experiments.png",
            h1="What redesign experiments teach",
            dek="A public sketchbook for structure, motion and product storytelling — and how those lessons return to client work.",
            schema=blog_posting(
                headline="What Redesign Experiments Teach",
                description="Why Vulcet publishes redesign experiments — and what HOLD, Kinetic Clarity and Case Studio teach about structure, motion and storytelling.",
                url="https://vulcet.com/blog/what-redesign-experiments-teach/",
                published="2026-08-24",
                updated="2026-08-24",
                image="https://vulcet.com/blog/assets/og-redesign-experiments.png",
                section="Experiments",
                word_count=950,
                minutes=7,
                faq=experiments_faq,
            ),
            body=experiments_body,
            takeaways=[
                "Experiments test ideas before they have to carry a live funnel.",
                "They are studio studies, not client work or brand affiliations.",
                "The transferable value is judgement: structure over decoration.",
                "Read experiments for the idea under test, then ask if it survives real content.",
            ],
            related=[
                ("/redesigns/", "Experiments", "All redesign experiments"),
                ("/redesigns/hold/", "Experiment", "HOLD"),
                ("/services/product-design/", "Service", "Product Design"),
            ],
        ),
    )


def build_index() -> None:
    posts = [
        {
            "href": "/blog/human-check-captcha-alternative/",
            "category": "Experiments",
            "date": "Aug 28, 2026",
            "read": "18 min",
            "title": "Rethinking CAPTCHA: Can verification become part of the interaction?",
            "dek": "Human Check — one drag, trajectory analysis, and what movement can tell us about verification.",
            "img": "/blog/assets/cover-human-check.svg?v=20260828-1",
            "alt": "Editorial cover — pointer trajectory toward a target ring.",
            "featured": True,
        },
        {
            "href": "/blog/your-brand-isnt-outdated-your-system-is/",
            "category": "Branding",
            "date": "Updated Aug 24, 2026",
            "read": "10 min",
            "title": "Your brand isn’t outdated. Your system is.",
            "dek": "Branding vs rebranding — when a refresh is enough, and when you need to rebuild.",
            "img": "/blog/assets/cover-branding-system.webp?v=20260817-1",
            "alt": "Open notebook with a brand mark sketch and system notes.",
        },
        {
            "href": "/blog/what-is-product-design/",
            "category": "Product Design",
            "date": "Aug 24, 2026",
            "read": "9 min",
            "title": "What is product design?",
            "dek": "A practical definition for founders: journeys, systems and outcomes — not only screens.",
            "img": "/blog/assets/cover-product-design.svg",
            "alt": "Abstract cover for the product design guide.",
        },
        {
            "href": "/blog/why-most-saas-websites-look-the-same/",
            "category": "Web Design",
            "date": "Aug 24, 2026",
            "read": "8 min",
            "title": "Why most SaaS websites look the same",
            "dek": "Category aesthetics, template fear, and where differentiation should start.",
            "img": "/blog/assets/cover-saas-sameness.svg",
            "alt": "Abstract cover about SaaS website sameness.",
        },
        {
            "href": "/blog/why-ai-products-look-the-same/",
            "category": "Product Design",
            "date": "Aug 24, 2026",
            "read": "8 min",
            "title": "Why every AI product is starting to look the same",
            "dek": "When chat becomes a shortcut past product decisions.",
            "img": "/blog/assets/cover-ai-sameness.svg",
            "alt": "Abstract cover about AI product sameness.",
        },
        {
            "href": "/blog/what-redesign-experiments-teach/",
            "category": "Experiments",
            "date": "Aug 24, 2026",
            "read": "7 min",
            "title": "What redesign experiments teach",
            "dek": "HOLD, Kinetic Clarity and Case Studio as a public sketchbook for judgement.",
            "img": "/blog/assets/cover-experiments.svg",
            "alt": "Abstract cover for redesign experiments.",
        },
        {
            "href": "/blog/business-website-vs-growth-website/",
            "category": "Strategy",
            "date": "Updated Aug 24, 2026",
            "read": "9 min",
            "title": "Focused website vs content platform",
            "dek": "How to choose scope without buying complexity you cannot maintain.",
            "img": "/blog/assets/cover-business-vs-growth.webp?v=20260816-1",
            "alt": "Two notebooks on a desk.",
        },
        {
            "href": "/blog/when-a-business-website-needs-a-redesign/",
            "category": "Web Design",
            "date": "Updated Aug 24, 2026",
            "read": "11 min",
            "title": "When a business website needs a redesign",
            "dek": "Clear signs a company site needs a rebuild — and when a refresh is enough.",
            "img": "/blog/assets/cover-website-redesign.webp?v=20260814-1",
            "alt": "Quiet studio desk by a window.",
        },
    ]

    featured = next(p for p in posts if p.get("featured"))
    others = [p for p in posts if not p.get("featured")]

    schema = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": "Vulcet Journal",
        "url": "https://vulcet.com/blog/",
        "description": "Editorial writing from Vulcet on branding, product design, websites and digital experiences.",
        "publisher": {"@type": "Organization", "name": "Vulcet", "url": "https://vulcet.com/"},
        "blogPost": [
            {
                "@type": "BlogPosting",
                "headline": p["title"],
                "url": f"https://vulcet.com{p['href']}",
                "author": {"@type": "Organization", "name": "Vulcet"},
            }
            for p in posts
        ],
    }

    cards = []
    for p in others:
        cards.append(
            f'''
        <a class="blog-cover-card" href="{p['href']}" data-blog-category="{p['category']}">
          <div class="blog-cover-media">
            <img src="{p['img']}" width="1600" height="1000" alt="{p['alt']}" loading="lazy" decoding="async">
          </div>
          <div class="blog-cover-copy">
            <p class="blog-cover-meta"><span>{p['category']}</span><span>{p['date']}</span><span>{p['read']} read</span></p>
            <h2>{p['title']}</h2>
            <p>{p['dek']}</p>
            <span class="blog-cover-cta">Read article <span aria-hidden="true">↗</span></span>
          </div>
        </a>'''
        )

    head = HEADER.format(
        description="Editorial writing from Vulcet on branding, product design, websites, strategy and redesign experiments.",
        canonical="https://vulcet.com/blog/",
        og_title="Vulcet Journal — Branding, Product & Web Design",
        og_description="A design publication from Vulcet on branding, product design, websites and digital experiences.",
        og_type="website",
        og_image="https://vulcet.com/blog/assets/og-website-redesign.jpg",
        article_meta="",
        twitter_description="Editorial writing from Vulcet on branding, product and web design.",
        title="Vulcet Journal — Branding, Product & Web Design",
        schema=dump_schema(schema),
    )

    main = f'''
    <header class="blog-masthead">
      <div class="shell blog-masthead-grid">
        <div class="blog-masthead-copy">
          <div class="editorial-label"><span>01</span><span>Journal</span></div>
          <h1>Writing on branding, product and the systems underneath.</h1>
          <p>A design publication from Vulcet — practical guides, editorial arguments and lessons from client work and studio experiments.</p>
        </div>
        <p class="blog-masthead-aside">Categories: Branding, Web Design, Product Design, Strategy, Experiments.</p>
      </div>
      <div class="shell">
        <nav class="blog-categories" data-blog-filter aria-label="Filter by category">
          <button type="button" data-filter="all" class="is-active" aria-pressed="true">All</button>
          <button type="button" data-filter="Branding" aria-pressed="false">Branding</button>
          <button type="button" data-filter="Web Design" aria-pressed="false">Web Design</button>
          <button type="button" data-filter="Product Design" aria-pressed="false">Product Design</button>
          <button type="button" data-filter="Strategy" aria-pressed="false">Strategy</button>
          <button type="button" data-filter="Experiments" aria-pressed="false">Experiments</button>
        </nav>
      </div>
    </header>

    <a class="shell blog-featured" href="{featured['href']}" data-blog-category="{featured['category']}">
      <div class="blog-featured-media">
        <img src="{featured['img']}" width="1600" height="1000" alt="{featured['alt']}" fetchpriority="high" decoding="async">
      </div>
      <div class="blog-featured-copy">
        <p class="blog-cover-meta"><span>Featured</span><span>{featured['category']}</span><span>{featured['date']}</span><span>{featured['read']} read</span></p>
        <h2>{featured['title']}</h2>
        <p>{featured['dek']}</p>
        <span class="blog-cover-cta">Read article <span aria-hidden="true">↗</span></span>
      </div>
    </a>

    <section class="blog-feed" aria-label="Articles">
      <div class="shell blog-feed-grid">
        {''.join(cards)}
        <p class="blog-empty" data-blog-empty hidden>No articles in this category yet.</p>
      </div>
    </section>
'''
    write(BLOG / "index.html", head + main + FOOTER)


if __name__ == "__main__":
    build_articles()
    build_index()
    print("done")
