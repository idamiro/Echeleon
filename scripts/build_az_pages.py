#!/usr/bin/env python3
"""Generate all Azerbaijani commercial pages under /workspace/az/."""
from __future__ import annotations

import sys
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[1]
AZ = ROOT / "az"
sys.path.insert(0, str(ROOT / "scripts"))

from az_shared import (  # noqa: E402
    AZ_PREFIX,
    CTA_START,
    SITE,
    render_footer,
    render_head,
    render_header,
    render_page,
)

STYLE_HERO = "20260824-hero"
STYLE_EDITORIAL = "20260817-nocol"
STYLE_VISIBLE = "20260823-visible"

GENERATED: list[Path] = []


def faq_item(question: str, answer: str) -> str:
    return (
        f'      <div class="faq-item"><h3><button type="button" aria-expanded="false">'
        f"<span>{question}</span>"
        f'<span class="faq-icon" aria-hidden="true"><i></i><i></i></span></button></h3>'
        f'<div class="faq-answer" hidden=""><p>{answer}</p></div></div>'
    )


def emit(rel: str, html: str) -> None:
    out = AZ / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    GENERATED.append(out)


def service_breadcrumb(name_en: str, name_az: str, slug: str) -> dict:
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Service",
                "name": name_en,
                "description": name_az,
                "provider": {"@type": "Organization", "name": "Vulcet", "url": f"{SITE}/"},
                "areaServed": "Worldwide",
                "url": f"{SITE}/az/services/{slug}/",
                "inLanguage": "az",
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Ana səhifə", "item": f"{SITE}/az/"},
                    {"@type": "ListItem", "position": 2, "name": "Xidmətlər", "item": f"{SITE}/az/services/"},
                    {"@type": "ListItem", "position": 3, "name": name_az, "item": f"{SITE}/az/services/{slug}/"},
                ],
            },
        ],
    }


def editorial_shell(
    *,
    az_path: str,
    body_class: str,
    nav_current: str | None,
    head_kwargs: dict,
    main: str,
    footer_kwargs: dict | None = None,
    cta_href: str | None = None,
    style_css: str = STYLE_EDITORIAL,
    extra_stylesheets: tuple[str, ...] = ("/editorial.css?v=20260813-4",),
) -> str:
    footer_kwargs = dict(footer_kwargs or {})
    footer_kwargs.setdefault("nav_current", nav_current)
    head = render_head(
        az_path=az_path,
        style_css=style_css,
        extra_stylesheets=extra_stylesheets,
        **head_kwargs,
    )
    return render_page(
        az_path=az_path,
        head=head,
        body_class=body_class,
        header=render_header(az_path=az_path, nav_current=nav_current, cta_href=cta_href),
        main=main,
        footer=render_footer(az_path=az_path, **footer_kwargs),
    )


def page_home() -> None:
    az_path = ""
    faqs = [
        (
            "Layihə adətən nə qədər vaxt aparır?",
            "Məqsədli veb-sayt adətən iki-dörd həftə çəkir. Daha geniş platformalar, çoxdilli saytlar və məhsul işi isə həcmdən və funksionallıqdan asılı olaraq adətən dörd-səkkiz həftə və ya daha çox vaxt tələb edir.",
        ),
        (
            "Başlamaq üçün bizdən nə lazımdır?",
            "Aydın qərar verən şəxs, mövcud brend və veb-sayt materiallarına çıxış, şirkət haqqında açıq məlumat və vaxtında rəy.",
        ),
        (
            "Mövcud veb-saytımızı yenidən dizayn edə bilərsiniz?",
            "Bəli. Əvvəlcə mövcud məzmun və analitika nəzərdən keçirilir, sonra saxlanmağa dəyər hissələr veb-saytı geridə saxlayanlardan ayrılır.",
        ),
        (
            "Çoxdilli veb-saytlar hazırlayırsınız?",
            "Naviqasiya, iyerarxiya və məzmunun bütün dillərdə ardıcıl qalması üçün dil strukturu əvvəldən planlaşdırılır.",
        ),
        (
            "Sayt istifadəyə verildikdən sonra nə baş verir?",
            "Hər layihəyə istifadəyə verildikdən sonra qısamüddətli dəstək daxildir. Veb-sayta müntəzəm texniki xidmət və ya təkmilləşdirmə lazım olduqda davamlı dəstək də mümkündür.",
        ),
        (
            "Hansı texnologiyalardan istifadə edirsiniz?",
            "Platforma layihəyə, komandanıza və veb-sayt istifadəyə verildikdən sonrakı ehtiyaclara əsasən seçilir. Vulcet standartlara uyğun adaptiv veb-saytlar hazırlayır; texniki tələblər dəqiqləşəndən sonra uyğun CMS, inteqrasiyalar və hostinq həllini tövsiyə edir.",
        ),
    ]
    faq_html = "\n".join(faq_item(q, a) for q, a in faqs)
    schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": ["Organization", "ProfessionalService"],
                "@id": f"{SITE}/az/",
                "name": "Vulcet",
                "url": f"{SITE}/az/",
                "logo": {"@type": "ImageObject", "url": f"{SITE}/vulcet-mark.png"},
                "image": f"{SITE}/og-vulcet.png",
                "email": "studio@vulcet.com",
                "description": "Vulcet — brendinq, məhsul və veb-dizayn sahəsində fəaliyyət göstərən qlobal dizayn studiyasıdır.",
                "areaServed": "Worldwide",
                "contactPoint": {
                    "@type": "ContactPoint",
                    "email": "studio@vulcet.com",
                    "contactType": "sales",
                    "availableLanguage": ["English", "Azərbaycan"],
                },
            },
            {
                "@type": "WebSite",
                "@id": f"{SITE}/az/#website",
                "url": f"{SITE}/az/",
                "name": "Vulcet",
                "publisher": {"@id": f"{SITE}/az/"},
                "inLanguage": "az",
            },
            {
                "@type": "FAQPage",
                "inLanguage": "az",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": a},
                    }
                    for q, a in faqs
                ],
            },
        ],
    }
    main = dedent(
        f"""
  <main id="main" data-motion-edition="the-working-edition">
    <section class="hero" id="top">
      <div class="shell hero-grid">
        <div class="hero-proof" aria-hidden="true"></div>
        <h1 data-header-trigger="">Vulcet — brendinq, məhsul və veb-dizayn sahəsində fəaliyyət göstərən qlobal dizayn studiyasıdır.</h1>
        <div class="hero-lens" aria-hidden="true"><i></i><i></i><span></span></div>
      </div>
    </section>
    <section class="work-section" id="work"><div class="shell work-grid work-grid--cases">
      <div class="work-cases-intro">
        <div class="editorial-label"><span>01</span><span>Seçilmiş işlər</span></div>
        <p class="work-cases-lede">Real müştəri layihələri — hər biri öz konteksti və görülən işin aydın təsviri ilə.</p>
      </div>
      <article class="home-case">
        <div class="home-case__copy">
          <div class="editorial-label"><span>01</span><span>Müştəri layihəsi — FounderClub</span></div>
          <h2>FounderClub</h2>
          <p>Təsisçiləri, tədbirləri, xəbərləri və üzvlük imkanlarını vahid rəqəmsal platformada birləşdirən biznes icması.</p>
          <dl class="project-meta home-case__meta"><div><dt>Rol</dt><dd>Məhsul strukturu, UI/UX, proqramlaşdırma</dd></div><div><dt>Müddət</dt><dd>Təxminən altı həftə</dd></div><div><dt>Platforma</dt><dd>İcma platforması</dd></div><div><dt>Sistemlər</dt><dd>Xəbərlər, tədbirlər, üzvlük, icma</dd></div></dl>
          <a class="text-link project-link" href="{AZ_PREFIX}/work/founderclub/">FounderClub layihəsinə bax <span aria-hidden="true">↗</span></a>
        </div>
        <a class="home-case__media" href="https://founderclub.az" target="_blank" rel="noreferrer" aria-label="FounderClub saytına keçin">
          <img src="/founderclub-hero.webp" srcset="/founderclub-hero-small.webp 800w, /founderclub-hero.webp 1600w" sizes="(max-width: 899px) 92vw, 44vw" width="1600" height="1022" alt="FounderClub veb-saytının Bakı gecə görüntüsü." loading="lazy" decoding="async">
          <span class="home-case__badge">Canlı sayt / founderclub.az</span>
        </a>
      </article>
      <article class="home-case">
        <div class="home-case__copy">
          <div class="editorial-label"><span>02</span><span>Müştəri layihəsi — Anadolu Qida</span></div>
          <h2>Anadolu Qida</h2>
          <p>Bakıda fəaliyyət göstərən un istehsalçısı üçün hazırlanmış korporativ veb-sayt — məhsulların aydın təqdimatı, istehsal prosesi və korporativ sifarişlər üçün rahat əlaqə imkanı.</p>
          <dl class="project-meta home-case__meta"><div><dt>Rol</dt><dd>Strategiya, UI/UX, proqramlaşdırma</dd></div><div><dt>Müddət</dt><dd>Təxminən dörd həftə</dd></div><div><dt>Platforma</dt><dd>Korporativ veb-sayt</dd></div><div><dt>Sistemlər</dt><dd>Məhsullar, sorğular, brend keçidi</dd></div></dl>
          <a class="text-link project-link" href="{AZ_PREFIX}/work/anadolu-qida/">Anadolu Qida layihəsinə bax <span aria-hidden="true">↗</span></a>
        </div>
        <a class="home-case__media" href="https://anadoluqida.com" target="_blank" rel="noreferrer" aria-label="Anadolu Qida saytına keçin">
          <img src="/anadolu-hero.webp" srcset="/anadolu-hero-small.jpg 900w, /anadolu-hero.webp 1600w" sizes="(max-width: 899px) 92vw, 44vw" width="1672" height="941" alt="Anadolu Qida saytından buğda tarlası hero görüntüsü." loading="lazy" decoding="async">
          <span class="home-case__badge">Canlı sayt / anadoluqida.com</span>
        </a>
      </article>
      <p class="work-cases-lede"><a class="text-link" href="/redesigns/">Studiya eksperimentlərinə bax — məhsul araşdırmaları və interaktiv alətlər <span aria-hidden="true">↗</span></a></p>
    </div></section>
    <section class="growth-section" id="services"><div class="growth-boundary" aria-hidden="true"></div><div class="shell growth-grid">
      <div class="editorial-label editorial-label--dark"><span>02</span><span>Ehtiyac</span></div><h2>Güclü təklif onu aydın təqdim edən veb-sayta ehtiyac duyur.</h2><p class="problem-copy">Vulcet xidmət şirkətləri və yeni rəqəmsal məhsullar hazırlayan komandalarla işləyir. Məqsəd sadəcə daha yaxşı görünən sayt yaratmaq deyil — biznesi, təklifi və istifadəçinin növbəti addımını aydınlaşdıran sistem qurmaqdır.</p>
      <div class="diagnostics"><div class="diagnostic-row"><span>01</span><strong>Köhnəlmiş təqdimat</strong><p>Biznes olduğu səviyyədən geridə görünür.</p></div><div class="diagnostic-row"><span>02</span><strong>Aydın olmayan xidmətlər</strong><p>Ziyarətçilər nə seçməli olduğunu anlamaqda çətinlik çəkir.</p></div><div class="diagnostic-row"><span>03</span><strong>Zəif mobil təcrübə</strong><p>Ən çox istifadə olunan cihazda etibar azalır.</p></div><div class="diagnostic-row"><span>04</span><strong>Uyğunsuz dil strukturu</strong><p>Beynəlxalq müştərilər ardıcıl olmayan hekayə alır.</p></div><div class="diagnostic-row"><span>05</span><strong>Çətin yenilənən veb-sayt</strong><p>Veb-sayt biznesin inkişafını əks etdirmir.</p></div></div>
      <div class="growth-transition"><p>Həll daha çox dekorasiya deyil.<br><em>Həll daha aydın sistemdir.</em></p></div>
      <div class="growth-intro"><span>Xidmətlər</span><h3>Strategiyadan işə salınmaya qədər</h3><p>Brend strategiyası, vizual kimlik, məhsul dizaynı və veb proqramlaşdırma — layihənin davamlılıq tələb etdiyi hallarda vahid proses daxilində birləşdirilir.</p><p><a class="text-link" href="{AZ_PREFIX}/services/">Bütün xidmətlərə bax <span aria-hidden="true">↗</span></a></p></div>
      <div class="scope-grid"><div><h4><a class="text-link" href="{AZ_PREFIX}/services/brand-strategy/">Brend strategiyası</a></h4><ul><li>Mövqeləndirmə və auditoriya aydınlığı</li><li>Mesaj iyerarxiyası</li><li>Qərar çərçivəsi</li></ul></div><div><h4><a class="text-link" href="{AZ_PREFIX}/services/visual-identity/">Vizual kimlik</a></h4><ul><li>Loqo və nişan sistemləri</li><li>Tipografiya və rəng</li><li>Brend qaydaları</li></ul></div><div><h4><a class="text-link" href="{AZ_PREFIX}/services/product-design/">Məhsul dizaynı</a></h4><ul><li>UX strukturu və axınlar</li><li>İnterfeys sistemləri</li><li>Prototip yoxlaması</li></ul></div><div><h4><a class="text-link" href="{AZ_PREFIX}/services/web-development/">Veb proqramlaşdırma</a></h4><ul><li>Adaptiv icra</li><li>Texniki SEO və analitika</li><li>İşə salma və davamlı qayğı</li></ul></div></div>
    </div></section>
    <section class="process-section" id="process"><div class="shell process-grid"><div class="editorial-label"><span>03</span><span>İş prosesi</span></div><div class="working-model"><h2>İlk sualdan layihənin işə salınmasına qədər vahid və birbaşa proses.</h2><p>Strategiya, dizayn və proqramlaşdırma birlikdə qalır; layihə boyu qərarlar aydın, yoxlama mərhələləri görünən olur.</p><ul><li>Birbaşa əlaqə</li><li>Əvvəl strategiya, sonra ekranlar</li><li>Dizayn və proqramlaşdırma birlikdə</li><li>İşə salındıqdan sonra da faydalı</li></ul></div><ol class="process-list">
      <li class="process-stage process-stage--current"><span class="stage-number">01</span><div><h3>Müəyyənləşdiririk</h3><p>Biznesin nəyi çatdırmalı olduğunu, hazırda nələrin mövcud olduğunu və yeni veb-saytın hansı nəticəni verməli olduğunu müəyyən edirik.</p><small><strong>Yoxlama nöqtəsi —</strong> Razılaşdırılmış məqsədlər, həcm və uğur meyarları.</small></div></li>
      <li class="process-stage"><span class="stage-number">02</span><div><h3>Struktur qururuq</h3><p>Vizual qərarlardan əvvəl məzmun iyerarxiyası, səhifə arxitekturası və əsas istifadəçi yolları formalaşdırılır.</p><small><strong>Yoxlama nöqtəsi —</strong> Təsdiqlənmiş sayt xəritəsi, məzmun iyerarxiyası və əsas axınlar.</small></div></li>
      <li class="process-stage"><span class="stage-number">03</span><div><h3>Dizayn edir və hazırlayırıq</h3><p>İnterfeys və icra birlikdə irəliləyir; adaptivlik, texniki mümkünlük və keyfiyyət bütün proses boyu uzlaşdırılır.</p><small><strong>Yoxlama nöqtəsi —</strong> Yoxlanmış adaptiv interfeys və işlək icra.</small></div></li>
      <li class="process-stage"><span class="stage-number">04</span><div><h3>İşə salır və təkmilləşdiririk</h3><p>Hazır veb-sayt sınaqdan keçirilir, yayımlanır və ölçmək, idarə etmək üçün lazımi əsaslarla təhvil verilir.</p><small><strong>Yoxlama nöqtəsi —</strong> Sınaqdan keçmiş buraxılış, analitika bazası və dəstək təhvili.</small></div></li>
    </ol></div></section>
    <section class="faq-section" id="faq"><div class="shell faq-grid"><div class="editorial-label"><span>04</span><span>Praktik suallar</span></div><h2>Başlamazdan əvvəl.</h2><div class="faq-list">
{faq_html}
    </div></div></section>
    <section class="final-cta" id="contact"><div class="closing-field" aria-hidden="true"><i></i><i></i><span></span><b></b></div><div class="shell final-grid"><div class="editorial-label"><span>05</span><span>Əlaqə</span></div><h2>Veb-saytınız biznesinizin səviyyəsini əks etdirsin.</h2><div class="final-support"><p>Nə üzərində işlədiyinizi və veb-saytın bundan sonra sizin üçün nə etməli olduğunu bizə danışın.</p><div><a class="button button--primary" href="{AZ_PREFIX}/contact/">{CTA_START} <span aria-hidden="true">↗</span></a><a class="text-link" href="mailto:studio@vulcet.com">studio@vulcet.com</a></div></div></div></section>
  </main>"""
    )
    head = render_head(
        az_path=az_path,
        title="Vulcet — brendinq, məhsul və veb-dizayn studiyası",
        description="Vulcet — brendinq, məhsul və veb-dizayn sahəsində fəaliyyət göstərən qlobal dizayn studiyasıdır. Brendlər, məhsullar və veb-saytlar üçün strategiya, dizayn və proqramlaşdırma.",
        og_title="Vulcet — brendinq, məhsul və veb-dizayn studiyası",
        og_description="Vulcet — brendinq, məhsul və veb-dizayn sahəsində fəaliyyət göstərən qlobal dizayn studiyasıdır. Brendlər, məhsullar və veb-saytlar üçün strategiya, dizayn və proqramlaşdırma.",
        og_image_alt="Vulcet — brendinq, məhsul və veb-dizayn studiyası",
        schema=schema,
        style_css=STYLE_HERO,
    )
    emit(
        "index.html",
        render_page(
            az_path=az_path,
            head=head,
            header=render_header(az_path=az_path, wordmark_href="#top"),
            main=main,
            footer=render_footer(az_path=az_path, home_href="#top", home_current=True),
        ),
    )


# Remaining page builders appended below.


def page_services_index() -> None:
    az_path = "services"
    main = dedent(
        f"""
  <main id="main">
    <section class="v-services-hero" id="top">
      <div class="v-hero-system" aria-hidden="true"><span></span><i></i><b></b><em></em></div>
      <div class="shell v-services-hero-grid">
        <div class="editorial-label"><span>01</span><span>Xidmətlər</span></div>
        <h1 data-header-trigger="">Aydın strategiyadan işlək brend sisteminə <em>qədər.</em></h1>
        <div class="v-hero-copy"><p>Vulcet brend strategiyası, vizual kimlik, məhsul dizaynı və veb proqramlaşdırmanı vahid prosesdə birləşdirir. Layihə bir xidmətlə başlaya və ehtiyacdan asılı olaraq digər istiqamətləri də əhatə edə bilər.</p></div>
        <ul class="v-hero-facts" aria-label="Vulcet imkanları"><li>Strategiya</li><li>Kimlik</li><li>Məhsul</li><li>Proqramlaşdırma</li></ul>
      </div>
    </section>
    <section class="v-service-overview" id="service-overview" aria-labelledby="overview-title">
      <div class="shell">
        <div class="v-section-intro">
          <div class="editorial-label editorial-label--dark"><span>02</span><span>Xidmət istiqamətləri</span></div>
          <h2 id="overview-title">Biznesin ehtiyacına uyğun dörd əsas istiqamət.</h2>
          <p>Hər əməkdaşlıq hazır xidmət paketindən deyil, biznesin real ehtiyacından başlayır. Həcm və müddət ilkin layihə baxışından sonra təsdiqlənir.</p>
        </div>
        <div class="v-service-cards">
          <article class="v-service-card v-service-card--essential">
            <div class="v-card-top"><span>01</span><small>İcra əvvəl istiqamət</small></div>
            <h3>Brend<br>strategiyası</h3>
            <p class="v-card-summary">Məqsədli hərəkətə ehtiyacı olan brend üçün aydın mövqe, mesaj və qərar çərçivəsi.</p>
            <div class="v-card-price"><span>Tipik müddət</span><strong>4 həftədən</strong></div>
            <div class="v-card-scope"><span>Əsas həcm</span><ul><li>Kəşfiyyat iş sessiyası</li><li>Bazar və auditoriya tədqiqatı</li><li>Brend mövqeləndirməsi</li><li>Səs tonu</li></ul></div>
            <a class="button button--secondary" href="{AZ_PREFIX}/services/brand-strategy/">Xidmətə bax <span aria-hidden="true">↗</span></a>
          </article>
          <article class="v-service-card v-service-card--growth">
            <div class="v-card-signal" aria-hidden="true"><i></i><b></b></div>
            <div class="v-card-top"><span>02</span><small>Tanınan vizual sistem</small></div>
            <h3>Vizual<br>kimlik</h3>
            <p class="v-card-summary">Strategiyanı fərqli və praktik vizual dilə çevirən ardıcıl kimlik.</p>
            <div class="v-card-price"><span>Tipik müddət</span><strong>4 həftədən</strong></div>
            <div class="v-card-scope"><span>Əsas həcm</span><ul><li>Kreativ istiqamət</li><li>Açar vizual</li><li>Kimlik qaydaları</li><li>Animasiya dizayn sistemi</li></ul></div>
            <a class="button button--light" href="{AZ_PREFIX}/services/visual-identity/">Xidmətə bax <span aria-hidden="true">↗</span></a>
          </article>
          <article class="v-service-card v-service-card--product">
            <div class="v-card-top"><span>03</span><small>Faydalı rəqəmsal təcrübələr</small></div>
            <h3>Məhsul<br>dizaynı</h3>
            <p class="v-card-summary">Real istifadəçi yolları, aydın interfeyslər və məqsədli qarşılıqlı əlaqə ətrafında formalaşdırılmış veb-saytlar və rəqəmsal məhsullar.</p>
            <div class="v-card-price"><span>Tipik müddət</span><strong>4 həftədən</strong></div>
            <div class="v-card-scope"><span>Əsas həcm</span><ul><li>Prototipləşdirmə və UX</li><li>İstifadəçi yolları</li><li>İnterfeys dizayn sistemi</li><li>Animasiya və mikrointeraksiyalar</li></ul></div>
            <a class="button button--secondary" href="{AZ_PREFIX}/services/product-design/">Xidmətə bax <span aria-hidden="true">↗</span></a>
          </article>
          <article class="v-service-card v-service-card--care">
            <div class="v-card-top"><span>04</span><small>Dizayn kodda</small></div>
            <h3>Veb<br>proqramlaşdırma</h3>
            <p class="v-card-summary">Dizaynı qoruyan, biznesi dəstəkləyən və buraxılışdan sonra idarə oluna bilən adaptiv icra.</p>
            <div class="v-card-price"><span>Tipik müddət</span><strong>4 həftədən</strong></div>
            <div class="v-card-scope"><span>Əsas həcm</span><ul><li>Frontend proqramlaşdırma</li><li>Animasiya və interaksiya</li><li>Texniki SEO və inteqrasiyalar</li><li>Buraxılış və texniki qayğı</li></ul></div>
            <a class="button button--secondary" href="{AZ_PREFIX}/services/web-development/">Xidmətə bax <span aria-hidden="true">↗</span></a>
          </article>
        </div>
      </div>
    </section>
    <section class="v-faq">
      <div class="shell v-faq-grid">
        <div class="editorial-label"><span>03</span><span>Təklifdən əvvəl</span></div>
        <h2>Ehtiyacdan başlayın,<br>etiketdən yox.</h2>
        <div class="faq-list">
          {faq_item("Yalnız ideyam var. Başlamaq üçün kifayətdirmi?", "Bəli. İlk addım ideyanı aydın brifə çevirməkdir: kim üçündür, nəyi çatdırmalıdır və biznesə nə lazımdır.")}
          {faq_item("Strategiya, kimlik, məhsul dizaynı və proqramlaşdırma birləşdirilə bilərmi?", "Bəli. Xidmət istiqamətləri ayrıca da işləyir, amma ən güclü davamlılıq istiqamət, vizual sistem, interfeys və son quruluşun bir-birinə bağlanmasından gəlir.")}
          {faq_item("Hansı xidmətlə başlamalıyıq?", "Həll olunmamış qərardan başlayın. Mövqe qeyri-aydındırsa — strategiyadan; istiqamət aydındırsa, ifadə yox — kimlik və ya məhsul dizaynından. Proqramlaşdırma təcrübə və texniki həcm hazır olanda başlayır.")}
          {faq_item("Son həcm necə müəyyən edilir?", "Vulcet məqsədləri, mövcud materialları, təhvil veriləcək materialları, funksionallığı və vaxtı nəzərdən keçirir, sonra tövsiyə olunan başlanğıc nöqtəsi ilə yazılı həcm verir.")}
        </div>
      </div>
    </section>
    <section class="v-service-overview" aria-labelledby="work-proof-title">
      <div class="shell">
        <div class="v-section-intro">
          <div class="editorial-label editorial-label--dark"><span>03</span><span>Praktikada</span></div>
          <h2 id="work-proof-title">Bu prosesdən istifadə edən real layihələr.</h2>
          <p>Vulcet struktur, interfeys və proqramlaşdırmanı canlı müştəri işində necə tətbiq etdiyinə baxın.</p>
          <p><a class="text-link" href="{AZ_PREFIX}/work/founderclub/">FounderClub layihəsi <span aria-hidden="true">↗</span></a><br>
          <a class="text-link" href="{AZ_PREFIX}/work/anadolu-qida/">Anadolu Qida layihəsi <span aria-hidden="true">↗</span></a><br>
          <a class="text-link" href="{AZ_PREFIX}/work/">Bütün müştəri layihələri <span aria-hidden="true">↗</span></a></p>
        </div>
      </div>
    </section>
  </main>"""
    )
    schema = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "Brand and digital services",
        "description": "Brend strategiyası, vizual kimlik, məhsul dizaynı və veb proqramlaşdırma.",
        "provider": {"@type": "Organization", "name": "Vulcet", "url": f"{SITE}/"},
        "areaServed": "Worldwide",
        "url": f"{SITE}/az/services/",
        "inLanguage": "az",
    }
    emit(
        "services/index.html",
        editorial_shell(
            az_path=az_path,
            body_class="v-services-page",
            nav_current="services",
            head_kwargs={
                "title": "Brend, məhsul və veb-dizayn xidmətləri | Vulcet",
                "description": "Brend strategiyası, vizual kimlik, məhsul dizaynı və veb proqramlaşdırma — istiqamətdən buraxılışa bir proses.",
                "og_title": "Brend, məhsul və veb-dizayn xidmətləri | Vulcet",
                "og_description": "Aydın brend və faydalı rəqəmsal mövcudluq üçün dörd əsas istiqamət.",
                "schema": schema,
            },
            main=main,
            footer_kwargs={"nav_current": "services"},
            style_css=STYLE_VISIBLE,
            extra_stylesheets=("/services.css?v=20260813-4",),
        ),
    )


def page_service_detail(
    slug: str,
    *,
    label_num: str,
    label: str,
    h1: str,
    hero_copy: str,
    meta_description: str,
    og_title: str,
    title: str,
    name_en: str,
    name_az: str,
    dark_section: str,
    steps: str,
) -> None:
    az_path = f"services/{slug}"
    main = dedent(
        f"""
  <main id="main"><section class="page-hero service-page-hero"><div class="page-hero-signal" aria-hidden="true"></div><div class="shell page-hero-grid"><div class="editorial-label"><span>{label_num}</span><span>{label}</span></div><h1>{h1}</h1><p class="page-hero-copy">{hero_copy}</p></div></section>
    {dark_section}
    <section class="page-section"><div class="shell service-scope-list">{steps}</div></section>
</main>"""
    )
    emit(
        f"services/{slug}/index.html",
        editorial_shell(
            az_path=az_path,
            body_class="editorial-page",
            nav_current="services",
            cta_href=f"{AZ_PREFIX}/contact/?service={slug}",
            head_kwargs={
                "title": title,
                "description": meta_description,
                "og_title": og_title,
                "og_description": hero_copy,
                "schema": service_breadcrumb(name_en, name_az, slug),
            },
            main=main,
            footer_kwargs={"nav_current": "services", "service_current": slug},
        ),
    )


def page_all_services() -> None:
    page_services_index()
    page_service_detail(
        "brand-strategy",
        label_num="01",
        label="Brend strategiyası",
        h1="Brend danışmağa başlamazdan əvvəl aydın <em>istiqamət.</em>",
        hero_copy="Brendin harada yer almalı olduğunu, kiminə çatmalı olduğunu və dizayn və ya proqramlaşdırma başlamazdan əvvəl necə danışmalı olduğunu müəyyən etməli bizneslər üçün.",
        meta_description="Vulcet brend strategiyası: kəşfiyyat, tədqiqat, mövqeləndirmə və səs tonu — dizayn başlamazdan əvvəl aydın strategiya.",
        og_title="Aydın mövqeləndirmə üçün brend strategiyası | Vulcet",
        title="Aydın mövqeləndirmə üçün brend strategiyası | Vulcet",
        name_en="Brand Strategy",
        name_az="Brend strategiyası",
        dark_section='<section class="page-section page-section--dark"><div class="shell service-page-grid"><div class="service-commercial"><span>Tipik müddət</span><strong>4 həftədən</strong><p>Son həcm biznes, mövcud materiallar, bazar konteksti və verilməli qərarlara görə müəyyən edilir.</p></div><div class="service-scope-columns"><div><h2>Uyğundur</h2><ul><li>Buraxılışa hazırlanan yeni brendlər</li><li>Yeni mərhələyə və ya bazara çıxan bizneslər</li><li>Qeyri-aydın və ya ardıcıl olmayan mesajı olan komandalar</li><li>Vizualdan əvvəl istiqamət lazım olan rebrendlər</li></ul></div><div><h2>Tipik həcm</h2><ul><li>Kəşfiyyat iş sessiyası</li><li>Auditoriya və bazar tədqiqatı</li><li>Rəqabət konteksti</li><li>Brend mövqeləndirməsi</li><li>Dəyər təklifi və əsas mesajlar</li><li>Səs tonu</li></ul></div></div></div></section>',
        steps='<div class="principle-row"><span>01</span><h3>Kəşf</h3><p>Biznes məqsədləri, auditoriya, təklif və cari çətinliklər vahid brifdə birləşdirilir.</p></div><div class="principle-row"><span>02</span><h3>Tədqiqat</h3><p>Bazar, alternativlər və auditoriya konteksti öyrənilir ki, qərarlar zövqə yox, sübuta əsaslanır.</p></div><div class="principle-row"><span>03</span><h3>Mövqeləndirmə</h3><p>Brendin tutmalı olduğu yer, aydın etməli olduğu dəyər və davamlı sahib olmalı olduğu ideyalar müəyyən edilir.</p></div><div class="principle-row"><span>04</span><h3>Kommunikasiya dili</h3><p>Sayt və kənar ünsiyyət üçün dil prinsipləri, mesaj iyerarxiyası və ton təyin edilir.</p></div>',
    )
    page_service_detail(
        "visual-identity",
        label_num="02",
        label="Vizual kimlik",
        h1="İnsanların tanıya biləcəyi və komandanın istifadə edə biləcəyi vizual <em>sistem.</em>",
        hero_copy="Loqodan artıq ehtiyacı olan brendlər üçün: veb-saytlar, təqdimatlar, sosial məzmun və hər vacib toxunma nöqtəsində ardıcıl dil.",
        meta_description="Vulcet vizual kimlik: kreativ istiqamət, açar vizuallar, qaydalar və animasiya prinsipləri — vahid brend sistemi.",
        og_title="Brendlər üçün vizual kimlik sistemləri | Vulcet",
        title="Brendlər üçün vizual kimlik sistemləri | Vulcet",
        name_en="Visual Identity",
        name_az="Vizual kimlik",
        dark_section='<section class="page-section page-section--dark"><div class="shell service-page-grid"><div class="service-commercial"><span>Tipik müddət</span><strong>4 həftədən</strong><p>Son həcm mövcud strategiyadan, tələb olunan tətbiqlərdən və komandanın təhvildən sonra ehtiyac duyduğu səviyyədən asılıdır.</p></div><div class="service-scope-columns"><div><h2>Uyğundur</h2><ul><li>Vizual istiqamətə hazır yeni brendlər</li><li>Ardıcıl olmayan kimliyi olan bizneslər</li><li>Strategiya dəyişikliyindən sonra rebrendlər</li><li>Təkrarlanan vizual sistemi lazım olan komandalar</li></ul></div><div><h2>Tipik həcm</h2><ul><li>Kreativ istiqamət</li><li>Loqo təkmilləşdirməsi və ya kimlik nişanı</li><li>Rəng və tipografiya sistemi</li><li>Açar vizual və şəkil istiqaməti</li><li>Kimlik qaydaları</li><li>Animasiya prinsipləri</li></ul></div></div></div></section>',
        steps='<div class="principle-row"><span>01</span><h3>Vizual istiqamət</h3><p>Brend strategiyası aydın vizual əraziyə, istinadlara və prinsiplərə çevrilir.</p></div><div class="principle-row"><span>02</span><h3>Açar vizual</h3><p>Nişan, tip, rəng, şəkil və kompozisiya arasında əsas əlaqə qurulur.</p></div><div class="principle-row"><span>03</span><h3>Sistemləşdirmə</h3><p>Qaydalar və tətbiqlər sənədləşdirilir ki, kimlik komanda və kanallar arasında ardıcıl qalsın.</p></div><div class="principle-row"><span>04</span><h3>Animasiya prinsipləri</h3><p>Mesajdan yayındırmadan kimliyi genişləndirən məqsədli animasiya və keçid prinsipləri formalaşdırılır.</p></div>',
    )
    page_service_detail(
        "product-design",
        label_num="03",
        label="Məhsul dizaynı",
        h1="Növbəti addımı aydın edən rəqəmsal <em>təcrübələr.</em>",
        hero_copy="Aydın istifadəçi yolu, ardıcıl interfeys və tapşırığı bəzək deyil, dəstəkləyən qarşılıqlı əlaqə lazım olan veb-saytlar, platformalar və rəqəmsal alətlər üçün.",
        meta_description="Vulcet məhsul dizaynı: istifadəçi yolları, prototiplər və interfeys sistemləri — faydalı rəqəmsal təcrübələr.",
        og_title="Rəqəmsal məhsul və UI/UX dizaynı | Vulcet",
        title="Rəqəmsal məhsul və UI/UX dizaynı | Vulcet",
        name_en="Product Design",
        name_az="Məhsul dizaynı",
        dark_section='<section class="page-section page-section--dark"><div class="shell service-page-grid"><div class="service-commercial"><span>Tipik müddət</span><strong>4 həftədən</strong><p>Son həcm istifadəçi yollarının, ekranların, vəziyyətlərin və tələb olunan prototip detallığının sayından asılıdır.</p></div><div class="service-scope-columns"><div><h2>Uyğundur</h2><ul><li>Mürəkkəb istifadəçi yolları olan veb-saytlar</li><li>Yeni rəqəmsal xidmətlər və MVP-lər</li><li>Müştəri və ya tərəfdaş portalları</li><li>İstifadə oluna bilmə problemləri olan mövcud məhsullar</li></ul></div><div><h2>Tipik həcm</h2><ul><li>Məhsul kəşfiyyatı</li><li>Informasiya arxitekturası</li><li>İstifadəçi yolları və tapşırıq axınları</li><li>İnteraktiv prototipləşdirmə</li><li>UI və dizayn sistemi</li><li>Animasiya və mikrointeraksiyalar</li></ul></div></div></div></section>',
        steps='<div class="principle-row"><span>01</span><h3>Prototipləşdirmə</h3><p>Son interfeys və ya quruluşa bağlanmadan əvvəl tələblər sınaqdan keçirilə bilən struktura çevrilir.</p></div><div class="principle-row"><span>02</span><h3>İstifadəçi yolu</h3><p>İstifadəçilərin başa düşməli, qərar verməli və tamamlamalı olduğu ətrafında məlumat və hərəkətlər təşkil edilir.</p></div><div class="principle-row"><span>03</span><h3>İnterfeys sistemi</h3><p>Tipografiya, komponentlər, vəziyyətlər və adaptiv davranış üçün təkrar istifadə olunan interfeys qaydaları yaradılır.</p></div><div class="principle-row"><span>04</span><h3>Məqsədli animasiya</h3><p>Dəyişikliyi izah etmək, diqqəti yönəltmək və rəy vermək üçün keçidlər və mikrointeraksiyalar tətbiq edilir.</p></div>',
    )
    page_service_detail(
        "web-development",
        label_num="04",
        label="Veb proqramlaşdırma",
        h1="Qəbul edilmiş dizayn — işləyən veb-sayta <em>çevrilir.</em>",
        hero_copy="İnterfeys keyfiyyətini performans, texniki SEO, inteqrasiyalar və buraxılışdan sonra saytı idarə etmək üçün praktik yolla birləşdirən adaptiv icra.",
        meta_description="Vulcet veb proqramlaşdırma: qəbul edilmiş dizaynı sürətli, idarə oluna bilən veb-sayta çevirən adaptiv icra.",
        og_title="Veb proqramlaşdırma və icra | Vulcet",
        title="Veb proqramlaşdırma və icra | Vulcet",
        name_en="Web Development",
        name_az="Veb proqramlaşdırma",
        dark_section='<section class="page-section page-section--dark"><div class="shell service-page-grid"><div class="service-commercial"><span>Tipik müddət</span><strong>4 həftədən</strong><p>Son həcm səhifə sayı, interaksiya, məzmun idarəetməsi, inteqrasiyalar və layihənin texniki tələblərindən asılıdır.</p></div><div class="service-scope-columns"><div><h2>Uyğundur</h2><ul><li>Təsdiqlənmiş veb-sayt və məhsul dizaynları</li><li>Fərdi adaptiv marketinq saytları</li><li>Məzmun yönümlü və ya çoxdilli platformalar</li><li>İnteqrasiya və ya CMS lazım olan komandalar</li></ul></div><div><h2>Tipik həcm</h2><ul><li>Adaptiv frontend proqramlaşdırma</li><li>Animasiya və interaksiya</li><li>CMS tətbiqi</li><li>Texniki SEO və performans</li><li>Üçüncü tərəf inteqrasiyaları</li><li>Sınaq, buraxılış və texniki qayğı</li></ul></div></div></div></section>',
        steps='<div class="principle-row"><span>01</span><h3>Dəqiq icra</h3><p>Qəbul edilmiş interfeys cihazlar arasında iyerarxiya, boşluq və davranışı qoruyan adaptiv komponentlərə çevrilir.</p></div><div class="principle-row"><span>02</span><h3>İnteraksiya və animasiya</h3><p>Əlçatanlıq və ya performansdan güzəşt vermədən təcrübəni dəstəkləyən interaksiya və animasiya qurulur.</p></div><div class="principle-row"><span>03</span><h3>Sistem inteqrasiyası</h3><p>Razılaşdırılmış biznes axını ətrafında CMS, formalar, analitika və xarici alətlər inteqrasiya edilir.</p></div><div class="principle-row"><span>04</span><h3>Optimallaşdırma və buraxılış</h3><p>Buraxılışdan əvvəl funksionallıq, adaptivlik, əlçatanlıq, performans və texniki SEO yoxlanılır.</p></div><div class="principle-row"><span>05</span><h3>Davamlı dəstək</h3><p>Aydın təhvil və müntəzəm texniki qayğı tələb olunduqda davamlı dəstək yolu təqdim edilir.</p></div>',
    )


def page_studio() -> None:
    az_path = "studio"
    main = dedent(
        """
  <main id="main">
    <section class="page-hero"><div class="page-hero-signal" aria-hidden="true"></div><div class="shell page-hero-grid"><div class="editorial-label"><span>01</span><span>Studiya</span></div><h1>Davamlılıq tələb edən iş üçün qlobal brendinq, məhsul və veb-dizayn <em>studiyası.</em></h1><p class="page-hero-copy">Vulcet Polşadan beynəlxalq işləyən qlobal brendinq, məhsul və veb-dizayn studiyasıdır. Strategiya, dizayn və mühəndislik şöbələr arasında ötürülmək əvəzinə bir-birinə bağlı qalır.</p></div></section>
    <section class="page-section"><div class="shell page-intro-grid"><div class="editorial-label"><span>02</span><span>İş modeli</span></div><h2>Birbaşa əməkdaşlıq, daha az vasitəçi və aydın məsuliyyət.</h2><p>Müştərilər vahid proseslə işləyir. Layihə həqiqətən ehtiyac olduqda ixtisaslaşmış əməkdaşlar cəlb olunur; istiqamət və məsuliyyət isə aydın qalır.</p></div></section>
    <section class="page-section"><div class="shell studio-grid-new">
      <div class="principle-row"><span>01</span><h3>Biznesdən başla</h3><p>Düzgün sayt insanların nə başa düşməli olduğu və təşkilatın nə nail olmalı olduğu ilə müəyyən edilir.</p></div>
      <div class="principle-row"><span>02</span><h3>Vizual üslubdan əvvəl struktur</h3><p>Vizual ifadə işə rəhbərlik etməzdən əvvəl məzmun iyerarxiyası və istifadəçi yolları razılaşdırılır.</p></div>
      <div class="principle-row"><span>03</span><h3>Mühəndisliklə dizayn et</h3><p>Adaptiv davranış, əlçatanlıq və performans interfeysi əvvəldən formalaşdırır.</p></div>
      <div class="principle-row"><span>04</span><h3>Yalnız doğru olanı yayımla</h3><p>Uydurma metrikalar, şişirdilmiş komanda dili və ya uydurma layihələr yox. Etibar işin özündən gəlməlidir.</p></div>
    </div></section>
</main>"""
    )
    schema = {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "name": "Qlobal brendinq, məhsul və veb-dizayn studiyası",
        "url": f"{SITE}/az/studio/",
        "description": "Vulcet Polşadan beynəlxalq işləyən qlobal brendinq, məhsul və veb-dizayn studiyasıdır.",
        "inLanguage": "az",
        "mainEntity": {
            "@type": "ProfessionalService",
            "name": "Vulcet",
            "url": f"{SITE}/az/",
            "email": "studio@vulcet.com",
            "address": {"@type": "PostalAddress", "addressCountry": "PL"},
            "areaServed": "Worldwide",
        },
    }
    emit(
        "studio/index.html",
        editorial_shell(
            az_path=az_path,
            body_class="editorial-page",
            nav_current="studio",
            head_kwargs={
                "title": "Qlobal brendinq, məhsul və veb-dizayn studiyası | Vulcet",
                "description": "Vulcet Polşadan beynəlxalq işləyən qlobal brendinq, məhsul və veb-dizayn studiyasıdır.",
                "og_title": "Qlobal brendinq, məhsul və veb-dizayn studiyası | Vulcet",
                "og_description": "Brendlər, məhsullar və veb-saytlar üçün strategiya, dizayn və mühəndisliyi birləşdirən studiya.",
                "schema": schema,
            },
            main=main,
            footer_kwargs={"nav_current": "studio", "utility_line2": "Qlobal brendinq, məhsul və veb-dizayn"},
        ),
    )


def page_work_index() -> None:
    az_path = "work"
    main = dedent(
        f"""
  <main id="main">
    <section class="page-hero"><div class="page-hero-signal" aria-hidden="true"></div><div class="shell page-hero-grid"><div class="editorial-label"><span>01</span><span>Seçilmiş işlər</span></div><h1>Seçilmiş brendinq, məhsul və veb layihələri — hər biri öz <em>kontekstində.</em></h1></div></section>
    <section class="portfolio-index" aria-label="Müştəri layihələri">
      <div class="shell portfolio-index-list">
        <article class="portfolio-row">
          <div class="portfolio-row__copy">
            <p class="portfolio-row__meta"><span>01</span><span>Müştəri layihəsi</span></p>
            <h2><a href="{AZ_PREFIX}/work/founderclub/">FounderClub</a></h2>
            <p>İcmanı, tədbirləri, xəbərləri və üzvlüyü vahid ardıcıl sistemə gətirən rəqəmsal platforma.</p>
            <a class="text-link portfolio-row__link" href="{AZ_PREFIX}/work/founderclub/">Layihəyə bax <span aria-hidden="true">↗</span></a>
          </div>
          <a class="portfolio-row__media" href="{AZ_PREFIX}/work/founderclub/" aria-label="FounderClub layihəsi">
            <img src="/founderclub-hero.webp" srcset="/founderclub-hero-small.webp 800w, /founderclub-hero.webp 1600w" sizes="(max-width: 899px) 100vw, 50vw" width="1600" height="1022" alt="FounderClub icma platforması veb-saytı." loading="eager" decoding="async">
          </a>
        </article>
        <article class="portfolio-row portfolio-row--flip">
          <div class="portfolio-row__copy">
            <p class="portfolio-row__meta"><span>02</span><span>Müştəri layihəsi</span></p>
            <h2><a href="{AZ_PREFIX}/work/anadolu-qida/">Anadolu Qida</a></h2>
            <p>Un istehsalçısı üçün brend yönümlü veb-sayt — məhsullar, istehsal hekayəsi və korporativ sorğu vahid yolda.</p>
            <a class="text-link portfolio-row__link" href="{AZ_PREFIX}/work/anadolu-qida/">Layihəyə bax <span aria-hidden="true">↗</span></a>
          </div>
          <a class="portfolio-row__media" href="{AZ_PREFIX}/work/anadolu-qida/" aria-label="Anadolu Qida layihəsi">
            <img src="/anadolu-hero.webp" width="1672" height="941" alt="Anadolu Qida korporativ veb-saytı." loading="lazy" decoding="async">
          </a>
        </article>
      </div>
    </section>
</main>"""
    )
    schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Seçilmiş brendinq, məhsul və veb işləri",
        "url": f"{SITE}/az/work/",
        "description": "Vulcet tərəfindən FounderClub icma platforması və Anadolu Qida korporativ veb-saytı.",
        "inLanguage": "az",
        "hasPart": [
            {"@type": "CreativeWork", "name": "FounderClub website", "url": f"{SITE}/az/work/founderclub/"},
            {"@type": "CreativeWork", "name": "Anadolu Qida website", "url": f"{SITE}/az/work/anadolu-qida/"},
        ],
    }
    emit(
        "work/index.html",
        editorial_shell(
            az_path=az_path,
            body_class="editorial-page",
            nav_current="work",
            head_kwargs={
                "title": "Seçilmiş brendinq, məhsul və veb işləri | Vulcet",
                "description": "Vulcet tərəfindən seçilmiş brendinq, məhsul və veb işləri: FounderClub və Anadolu Qida.",
                "og_title": "Seçilmiş brendinq, məhsul və veb işləri | Vulcet",
                "og_description": "Canlı müştəri işləri: icma platformaları və brend yönümlü veb-saytlar.",
                "schema": schema,
            },
            main=main,
            footer_kwargs={"nav_current": "work", "utility_line2": "Qlobal brendinq, məhsul və veb-dizayn"},
            style_css=STYLE_VISIBLE,
            extra_stylesheets=("/editorial.css?v=20260823-visible",),
        ),
    )


def page_work_case(slug: str, html_main: str, head_kwargs: dict, og_image: str | None = None) -> None:
    az_path = f"work/{slug}"
    kwargs = dict(head_kwargs)
    if og_image:
        kwargs["og_image"] = og_image
    emit(
        f"work/{slug}/index.html",
        editorial_shell(
            az_path=az_path,
            body_class="editorial-page case-page",
            nav_current="work",
            head_kwargs=kwargs,
            main=html_main,
            footer_kwargs={"nav_current": "work", "utility_line2": "Müştəri layihəsi"},
            style_css=STYLE_VISIBLE,
            extra_stylesheets=(
                "/editorial.css?v=20260823-visible",
                "/work/case-study.css?v=20260823-cs2",
            ),
        ),
    )


def page_work_cases() -> None:
    page_work_case(
        "founderclub",
        dedent(
            f"""
  <main id="main">
    <section class="page-hero"><div class="page-hero-signal" aria-hidden="true"></div><div class="shell page-hero-grid"><div class="editorial-label"><span>01</span><span>Müştəri layihəsi</span></div><h1>FounderClub — biznes icması üçün vahid rəqəmsal <em>platforma.</em></h1><p class="page-hero-copy">Üzvlük, tədbirlər, xəbərlər və icma fəaliyyətini birləşdirən platforma üçün məhsul strukturu, UI/UX və proqramlaşdırma.</p></div></section>
    <div class="case-summary page-section page-section--dark"><div class="shell case-grid"><p>Əsas məqsəd tədbirləri, xəbərləri və üzvlük sistemini aydın strukturda birləşdirmək, eyni zamanda FounderClub-un Bakıya xas yerli kimliyini qorumaq idi.</p><dl class="case-facts"><div><dt>Müştəri</dt><dd>FounderClub</dd></div><div><dt>Rol</dt><dd>Məhsul strukturu, UI/UX, proqramlaşdırma</dd></div><div><dt>Müddət</dt><dd>Təxminən altı həftə</dd></div><div><dt>Vəziyyət</dt><dd>founderclub.az-da canlı</dd></div></dl></div></div>
    <figure class="case-feature"><div class="shell"><img src="/founderclub-hero.webp" srcset="/founderclub-hero-small.webp 800w, /founderclub-hero.webp 1600w" sizes="(max-width: 1200px) 92vw, 1120px" width="1600" height="1022" alt="FounderClub saytında Bakı silueti." fetchpriority="high" decoding="async"><figcaption>Ana səhifə — yerli kimlik və üzvlük mesajı vahid açılış kadrajında birləşir.</figcaption></div></figure>
    <div class="case-body shell">
      <section class="case-chapter" aria-labelledby="fc-context"><div class="case-chapter__grid"><p class="case-chapter__label" id="fc-context">01 / Kontekst</p><h2 class="case-chapter__title">Fərqli fəaliyyətlər vahid platforma kimi <em>hiss olunmalı idi.</em></h2><p class="case-chapter__text">FounderClub biznes icmasını, tədbirləri, redaksiya xəbərlərini və üzvlüyü birləşdirir. Sayt bu hissələri asan başa düşülən etməli, premium və yerli kimliyi qorumalı idi.</p></div></section>
      <section class="case-chapter" aria-labelledby="fc-response"><div class="case-chapter__grid"><p class="case-chapter__label" id="fc-response">02 / Həll</p><h2 class="case-chapter__title">Ayrı səhifələr yox — strukturlaşdırılmış redaksiya sistemi.</h2><p class="case-chapter__text">İnterfeys elanlar, tədbir materialları və icma məzmunu üçün ardıcıl iyerarxiya istifadə edir. Güclü şəkillər kimliyi daşıyır; saxlanmış tipografiya və proqnozlaşdırıla bilən naviqasiya məlumatı daşıyır. İş <a href="{AZ_PREFIX}/services/product-design/">məhsul dizaynı</a> və <a href="{AZ_PREFIX}/services/web-development/">veb proqramlaşdırmanı</a> vahid prosesdə birləşdirdi.</p></div></section>
      <div class="case-gallery"><p class="case-gallery__intro">Tədbirlər və redaksiya məzmunu eyni vizual dili paylaşır — fotoqrafiya aparır, mətn dəstəkləyir.</p><div class="case-gallery__grid case-gallery--landscape"><figure><img src="/founderclub-event-office.webp" width="1000" height="600" alt="FounderClub ofis ziyarəti tədbiri." loading="lazy" decoding="async"><figcaption>Ofis ziyarəti</figcaption></figure><figure><img src="/founderclub-event-networking.webp" width="768" height="432" alt="FounderClub şəbəkələşmə tədbiri." loading="lazy" decoding="async"><figcaption>İcma şəbəkələşməsi</figcaption></figure><figure><img src="/founderclub-news-atameken.webp" width="1280" height="960" alt="FounderClub beynəlxalq xəbər təqdimatı." loading="lazy" decoding="async"><figcaption>Redaksiya xəbəri</figcaption></figure><figure><img src="/founderclub-news-seabreeze.webp" width="1280" height="852" alt="FounderClub Sea Breeze layihə təqdimatı." loading="lazy" decoding="async"><figcaption>Layihə işıqlandırması</figcaption></figure></div></div>
      <section class="case-chapter" aria-labelledby="fc-outcome"><div class="case-chapter__grid"><p class="case-chapter__label" id="fc-outcome">03 / Nəticə</p><h2 class="case-chapter__title">Canlı və istifadəyə hazır ardıcıl platforma.</h2><p class="case-chapter__text">Üzvlük, tədbirlər və redaksiya məzmunu indi vahid naviqasiya olunan sistem paylaşır. Sayt FounderClub-a ardıcıl ictimai üz verir — <a href="https://founderclub.az" target="_blank" rel="noreferrer">founderclub.az</a>-da canlıdır. Founder Club rəsmi saytında <a href="https://founderclub.az/en/digital-partnership-with-vulcet" target="_blank" rel="noreferrer noopener">rəqəmsal tərəfdaşlığı elan edib</a>.</p></div></section>
    </div>
    <section class="page-cta"><div class="shell"><h2>Canlı sayta baxın.</h2><div><p>İcma, tədbirlər və xəbərlərin vahid platforma kimi necə oxunduğuna baxın.</p><a class="button button--light" href="https://founderclub.az" target="_blank" rel="noreferrer">founderclub.az <span aria-hidden="true">↗</span></a><a class="text-link" href="{AZ_PREFIX}/work/">Bütün müştəri layihələri <span aria-hidden="true">↗</span></a></div></div></section>
  </main>"""
        ),
        {
            "title": "FounderClub veb-sayt layihəsi | Vulcet",
            "description": "FounderClub layihəsi: icma, tədbirlər, xəbərlər və üzvlük üçün ardıcıl rəqəmsal platforma.",
            "og_title": "FounderClub veb-sayt layihəsi | Vulcet",
            "og_description": "Biznes icması platforması üçün məhsul strukturu, UI/UX və proqramlaşdırma.",
            "og_type": "article",
            "schema": {
                "@context": "https://schema.org",
                "@graph": [
                    {
                        "@type": "CreativeWork",
                        "name": "FounderClub website",
                        "url": f"{SITE}/az/work/founderclub/",
                        "about": "FounderClub biznes icması üçün veb-sayt və rəqəmsal platforma",
                        "inLanguage": "az",
                        "creator": {"@type": "Organization", "name": "Vulcet", "url": f"{SITE}/"},
                    },
                    {
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            {"@type": "ListItem", "position": 1, "name": "Ana səhifə", "item": f"{SITE}/az/"},
                            {"@type": "ListItem", "position": 2, "name": "İşlər", "item": f"{SITE}/az/work/"},
                            {"@type": "ListItem", "position": 3, "name": "FounderClub", "item": f"{SITE}/az/work/founderclub/"},
                        ],
                    },
                ],
            },
        },
        og_image=f"{SITE}/founderclub-hero.webp",
    )
    page_work_case(
        "anadolu-qida",
        dedent(
            f"""
  <main id="main">
    <section class="page-hero"><div class="page-hero-signal" aria-hidden="true"></div><div class="shell page-hero-grid"><div class="editorial-label"><span>02</span><span>Müştəri layihəsi</span></div><h1>Anadolu Qida — un istehsalçısı üçün aydın rəqəmsal <em>təqdimat.</em></h1><p class="page-hero-copy">Bakıda un şirkəti üçün brend yönümlü veb-sayt dizaynı və proqramlaşdırma: məhsul aydınlığı, istehsal hekayəsi və praktik korporativ sorğu yolu.</p></div></section>
    <div class="case-summary page-section page-section--dark"><div class="shell case-grid"><p>İş istehsal biznesini etibarlı rəqəmsal mövcudluğa çevirdi — alıcılar və tərəfdaşlar təklifi başa düşə, əməliyyata etibar edə və korporativ sifariş üçün asanlıqla əlaqə saxlaya bilsin.</p><dl class="case-facts"><div><dt>Müştəri</dt><dd>Anadolu Qida</dd></div><div><dt>Rol</dt><dd>Strategiya, UI/UX, proqramlaşdırma</dd></div><div><dt>Müddət</dt><dd>Təxminən dörd həftə</dd></div><div><dt>Vəziyyət</dt><dd>anadoluqida.com-da canlı</dd></div></dl></div></div>
    <figure class="case-feature"><div class="shell"><img src="/anadolu-hero.webp" srcset="/anadolu-hero-small.jpg 900w, /anadolu-hero.webp 1600w" sizes="(max-width: 1200px) 92vw, 1120px" width="1672" height="941" alt="Anadolu Qida saytından buğda tarlası hero görüntüsü." fetchpriority="high" decoding="async"><figcaption>Ana səhifə — məhsul mesajını birbaşa açan məhsul görüntüsü; dekorativ deyil, məzmunu dəstəkləyir.</figcaption></div></figure>
    <div class="case-body shell">
      <section class="case-chapter" aria-labelledby="aq-context"><div class="case-chapter__grid"><p class="case-chapter__label" id="aq-context">01 / Kontekst</p><h2 class="case-chapter__title">İstehsal biznesi zavod qədər möhkəm sayta ehtiyac <em>duyurdu.</em></h2><p class="case-chapter__text">Anadolu Qida çörəkxanalar, xəmir mətbəxləri və korporativ təchizat üçün un istehsal edir. Rəqəmsal mövcudluq qablaşmanı aydın təqdim etməli, istehsalı izah etməli və ciddi alıcıları sorğuya yönləndirməli — eyni sistemdən Mirvari Logistics-ə də çıxış olmalı idi.</p></div></section>
      <section class="case-chapter" aria-labelledby="aq-response"><div class="case-chapter__grid"><p class="case-chapter__label" id="aq-response">02 / Həll</p><h2 class="case-chapter__title">Məhsullar, dəyərlər və sifarişlər üçün vahid redaksiya sistemi.</h2><p class="case-chapter__text">İnterfeys məhsul həqiqəti ilə başlayır: paket ölçüləri, istifadə halları və istehsal nəzarəti. Güclü fotoqrafiya kimliyi daşıyır; saxlanmış tipografiya kommersiya yolunu daşıyır. Dəyərlər, kataloq və sorğu vahid iyerarxiyada — <a href="{AZ_PREFIX}/services/brand-strategy/">brend strategiyası</a>, <a href="{AZ_PREFIX}/services/visual-identity/">vizual kimlik</a> və <a href="{AZ_PREFIX}/services/web-development/">veb proqramlaşdırma</a> vasitəsilə formalaşdırılıb.</p></div></section>
      <div class="case-gallery"><p class="case-gallery__intro">Məhsul fotoqrafiyası portret formatlıdır — səhifə quruluşu paket nisbətlərinə uyğun qurulub.</p><div class="case-gallery__grid case-gallery--portrait"><figure><img src="/anadolu-flour-25.jpg" width="819" height="1024" alt="Anadolu Qida 25 kq un çuvalı." loading="lazy" decoding="async"><figcaption>25 kq çuval</figcaption></figure><figure><img src="/anadolu-flour-10.jpg" width="819" height="1024" alt="Anadolu Qida 10 kq un qablaşması." loading="lazy" decoding="async"><figcaption>10 kq paket</figcaption></figure><figure><img src="/anadolu-catalog.jpg" width="682" height="1024" alt="Anadolu Qida məhsul kataloqu." loading="lazy" decoding="async"><figcaption>Kataloq hekayəsi</figcaption></figure></div><div class="case-gallery__grid case-gallery--wide"><figure><img src="/anadolu-warehouse.jpg" width="1200" height="800" alt="Anadolu Qida anbarı və logistika." loading="lazy" decoding="async"><figcaption>Əməliyyat və logistika konteksti</figcaption></figure></div></div>
      <section class="case-chapter" aria-labelledby="aq-outcome"><div class="case-chapter__grid"><p class="case-chapter__label" id="aq-outcome">03 / Nəticə</p><h2 class="case-chapter__title">Baxış və sorğu üçün hazır canlı biznes saytı.</h2><p class="case-chapter__text">Un məhsulları, istehsal hekayəsi, sertifikat yolu və sifariş əlaqəsi — Mirvari Logistics isə nəzərdə tutulmuş brend keçidi ilə. Sübut canlı saytdadır: <a href="https://anadoluqida.com" target="_blank" rel="noreferrer">anadoluqida.com</a>.</p></div></section>
    </div>
    <section class="page-cta"><div class="shell"><h2>Canlı sayta baxın.</h2><div><p>Məhsulları, istehsal hekayəsini və korporativ sorğu yolunu kontekstdə görün.</p><a class="button button--light" href="https://anadoluqida.com" target="_blank" rel="noreferrer">anadoluqida.com <span aria-hidden="true">↗</span></a><a class="text-link" href="{AZ_PREFIX}/work/">Bütün müştəri layihələri <span aria-hidden="true">↗</span></a></div></div></section>
  </main>"""
        ),
        {
            "title": "Anadolu Qida veb-sayt layihəsi | Vulcet",
            "description": "Anadolu Qida layihəsi: un istehsalçısı üçün brend yönümlü biznes veb-saytı.",
            "og_title": "Anadolu Qida veb-sayt layihəsi | Vulcet",
            "og_description": "Un istehsalçısı üçün daha aydın rəqəmsal mövcudluq: məhsullar, istehsal hekayəsi və korporativ sifariş.",
            "og_type": "article",
            "schema": {
                "@context": "https://schema.org",
                "@graph": [
                    {
                        "@type": "CreativeWork",
                        "name": "Anadolu Qida website",
                        "url": f"{SITE}/az/work/anadolu-qida/",
                        "about": "Anadolu Qida un istehsal şirkəti üçün biznes saytı",
                        "inLanguage": "az",
                        "creator": {"@type": "Organization", "name": "Vulcet", "url": f"{SITE}/"},
                    },
                    {
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            {"@type": "ListItem", "position": 1, "name": "Ana səhifə", "item": f"{SITE}/az/"},
                            {"@type": "ListItem", "position": 2, "name": "İşlər", "item": f"{SITE}/az/work/"},
                            {"@type": "ListItem", "position": 3, "name": "Anadolu Qida", "item": f"{SITE}/az/work/anadolu-qida/"},
                        ],
                    },
                ],
            },
        },
        og_image=f"{SITE}/anadolu-og.jpg",
    )


def page_contact() -> None:
    az_path = "contact"
    main = dedent(
        f"""
  <main id="main">
    <section class="contact-hero">
      <div class="contact-signal" aria-hidden="true">
        <div class="contact-signal-ring contact-signal-ring--outer"></div>
        <div class="contact-signal-ring contact-signal-ring--inner"></div>
        <i></i><i></i><i></i><span></span>
      </div>
      <div class="shell contact-hero-grid">
        <div class="editorial-label editorial-label--dark"><span>01</span><span>Əlaqə</span></div>
        <h1>Layihəniz haqqında <em>danışaq.</em></h1>
        <div class="contact-hero-copy">
          <p>Biznesinizin qarşısındakı çətinliyi, veb-saytın və ya məhsulun nə etməli olduğunu və layihənin hazırkı mərhələsini bizimlə bölüşün.</p>
          <a href="mailto:studio@vulcet.com">studio@vulcet.com <span aria-hidden="true">↗</span></a>
        </div>
        <div class="contact-hero-meta">
          <div><span>Yaxşı başlanğıc</span><p>Aydın biznes məqsədi, təqdim etməli olduğunuz təklif və təxmini büdcə.</p></div>
          <div><span>İş modeli</span><p>Strategiya, dizayn və mühəndislik üzrə birbaşa əməkdaşlıq.</p></div>
        </div>
      </div>
    </section>
    <section class="contact-brief" id="project-brief" aria-labelledby="brief-title">
      <div class="shell contact-brief-grid">
        <div class="contact-brief-heading">
          <div class="editorial-label"><span>02</span><span>Layihə brifi</span></div>
          <h2 id="brief-title">Faydalı ilk söhbət kontekstlə başlayır.</h2>
          <p>Bu qısa brif əsas layihə məlumatını birbaşa Vulcet-ə göndərir ki, ilk söhbət faydalı kontekstlə başlasın.</p>
        </div>
        <div class="contact-form-wrap">
          <div class="contact-progress" role="group" aria-label="Form irəliləyişi">
            <div class="is-active" data-progress="1"><span>1</span><strong>Layihə uyğunluğu</strong></div>
            <div data-progress="2"><span>2</span><strong>Layihə detalları</strong></div>
          </div>
          <form class="contact-form" id="contact-form" action="https://api.web3forms.com/submit" method="POST" novalidate="">
            <input type="hidden" name="access_key" value="471f1056-9d23-4678-b1fd-87a01108f652">
            <input type="hidden" name="subject" value="New project enquiry - Vulcet">
            <input type="hidden" name="from_name" value="Vulcet website">
            <input class="contact-botcheck" type="checkbox" name="botcheck" tabindex="-1">
            <fieldset data-step="1">
              <legend class="sr-only">Layihə uyğunluğu</legend>
              <div class="contact-field">
                <label for="contact-name">Ad <span aria-hidden="true">*</span></label>
                <input id="contact-name" name="name" type="text" autocomplete="name" required="">
              </div>
              <div class="contact-field">
                <label for="contact-email">İş e-poçtu <span aria-hidden="true">*</span></label>
                <input id="contact-email" name="email" type="email" autocomplete="email" required="">
              </div>
              <div class="contact-field contact-field--wide">
                <label for="contact-company">Şirkət / təşkilat</label>
                <input id="contact-company" name="company" type="text" autocomplete="organization">
              </div>
              <div class="contact-field">
                <label for="contact-need">Nəyə ehtiyacınız var? <span aria-hidden="true">*</span></label>
                <select id="contact-need" name="need" required="">
                  <option value="">Birini seçin</option>
                  <option value="Brand Strategy">Brend strategiyası</option>
                  <option value="Visual Identity">Vizual kimlik</option>
                  <option value="Product Design">Məhsul dizaynı</option>
                  <option value="Web Development">Veb proqramlaşdırma</option>
                  <option value="Not sure yet">Hələ əmin deyiləm</option>
                </select>
              </div>
              <div class="contact-field">
                <label for="contact-budget">Təxmini büdcə <span aria-hidden="true">*</span></label>
                <select id="contact-budget" name="budget" required="">
                  <option value="">Aralıq seçin</option>
                  <option value="Under $5,000">$5,000-dan az</option>
                  <option value="$5,000-$9,000">$5,000–$9,000</option>
                  <option value="$9,000-$15,000">$9,000–$15,000</option>
                  <option value="$15,000+">$15,000+</option>
                  <option value="Not defined yet">Hələ müəyyən edilməyib</option>
                </select>
              </div>
              <div class="contact-field contact-field--wide contact-starting-point">
                <span class="contact-field-label" id="starting-point-label">Layihənin başlanğıc nöqtəsi <span aria-hidden="true">*</span></span>
                <div class="contact-choice-grid" role="radiogroup" aria-labelledby="starting-point-label">
                  <label class="contact-choice">
                    <input type="radio" name="project_type" value="New website or digital product" required="">
                    <span><strong>Yeni bir şey qurun</strong><small>Yeni veb-sayt, məhsul və ya rəqəmsal mövcudluq.</small></span>
                  </label>
                  <label class="contact-choice">
                    <input type="radio" name="project_type" value="Redesign an existing website" required="">
                    <span><strong>Mövcud saytı redizayn edin</strong><small>Artıq canlı olan saytı təkmilləşdirin və ya əvəz edin.</small></span>
                  </label>
                </div>
              </div>
              <div class="contact-field contact-field--wide contact-existing-url" hidden="">
                <label for="contact-website">Mövcud veb-sayt URL-i <span aria-hidden="true">*</span></label>
                <input id="contact-website" name="website" type="url" inputmode="url" autocomplete="url" placeholder="https://">
              </div>
              <div class="contact-form-actions contact-field--wide">
                <button class="button button--primary" type="button" data-next="">Davam et <span aria-hidden="true">→</span></button>
              </div>
            </fieldset>
            <fieldset data-step="2" hidden="">
              <legend class="sr-only">Layihə detalları</legend>
              <div class="contact-field">
                <label for="contact-start">Üstünlük verilən başlama tarixi</label>
                <select id="contact-start" name="start">
                  <option value="As soon as possible">Mümkün qədər tez</option>
                  <option value="Within 1-2 months">1–2 ay ərzində</option>
                  <option value="Within 3-4 months">3–4 ay ərzində</option>
                  <option value="Later / flexible">Daha sonra / çevik</option>
                </select>
              </div>
              <div class="contact-field contact-field--wide">
                <label for="contact-details">Layihə haqqında danışın <span aria-hidden="true">*</span></label>
                <textarea id="contact-details" name="details" rows="7" required="" placeholder="Nə qurursunuz, kim üçündür və yeni platforma nə nail olmalıdır?"></textarea>
              </div>
              <div class="contact-field contact-field--wide">
                <label for="contact-source">Vulcet haqqında haradan eşitmisiniz?</label>
                <input id="contact-source" name="source" type="text">
              </div>
              <div class="contact-consent contact-field--wide">
                <input id="contact-consent" name="consent" type="checkbox" required="">
                <label for="contact-consent">Bu layihəni müzakirə etmək məqsədilə məlumatımı Vulcet-ə göndərməyə razıyam, <a href="{AZ_PREFIX}/privacy/" target="_blank">məxfilik bildirişində</a> təsvir olunduğu kimi. <span aria-hidden="true">*</span></label>
              </div>
              <div class="contact-form-actions contact-field--wide">
                <button class="contact-back" type="button" data-back="">← Geri</button>
                <button class="button button--primary" type="submit">Layihə brifini göndər <span aria-hidden="true">↗</span></button>
              </div>
            </fieldset>
            <p class="contact-form-status" role="status" aria-live="polite"></p>
          </form>
          <div class="contact-success" id="contact-success" role="status" aria-live="polite" tabindex="-1" hidden="">
            <span>Brif qəbul edildi</span>
            <h3>Layihə brifiniz qəbul edildi.</h3>
            <p>Konteksti Vulcet ilə bölüşdüyünüz üçün təşəkkür edirik.</p>
            <a class="text-link" href="{AZ_PREFIX}/">Ana səhifəyə qayıt <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </div>
    </section>
    <section class="contact-direct">
      <div class="shell contact-direct-grid">
        <div class="editorial-label editorial-label--dark"><span>03</span><span>Birbaşa əlaqə</span></div>
        <h2>Sadə saxlamaq istəyirsiniz?</h2>
        <a href="mailto:studio@vulcet.com">studio@vulcet.com <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  </main>"""
    )
    schema = {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "name": "Vulcet ilə layihəyə başlayın",
        "url": f"{SITE}/az/contact/",
        "description": "Veb-sayt, rəqəmsal məhsul və ya brend layihəniz haqqında Vulcet ilə danışın. Məqsədi, layihənin həcmini və vaxt çərçivəsini bizimlə bölüşün.",
        "inLanguage": "az",
        "mainEntity": {"@type": "Organization", "name": "Vulcet", "email": "studio@vulcet.com", "url": f"{SITE}/az/"},
    }
    head = render_head(
        az_path=az_path,
        title="Vulcet ilə layihəyə başlayın | Əlaqə",
        description="Veb-sayt, rəqəmsal məhsul və ya brend layihəniz haqqında Vulcet ilə danışın. Məqsədi, layihənin həcmini və vaxt çərçivəsini bizimlə bölüşün.",
        og_title="Vulcet ilə layihəyə başlayın",
        og_description="Veb-sayt, rəqəmsal məhsul və ya brend layihəniz haqqında danışaq.",
        schema=schema,
        style_css=STYLE_EDITORIAL,
        extra_stylesheets=("/contact.css?v=20260813-4",),
        extra_scripts=("/contact.js?v=20260724-17",),
    )
    emit(
        "contact/index.html",
        render_page(
            az_path=az_path,
            head=head,
            body_class="contact-page",
            header=render_header(
                az_path=az_path,
                nav_current="contact",
                cta_href="#project-brief",
                cta_arrow="↘",
            ),
            main=main,
            footer=render_footer(
                az_path=az_path,
                nav_current="contact",
                utility_line2="Qlobal brendinq, məhsul və veb-dizayn",
            ),
        ),
    )


def page_privacy() -> None:
    az_path = "privacy"
    main = dedent(
        f"""
  <main id="main">
    <section class="page-hero"><div class="shell page-hero-grid"><div class="editorial-label"><span>01</span><span>Məxfilik</span></div><h1>Məxfilik — <em>aydın</em> izah olunur.</h1><p class="page-hero-copy">Bu bildiriş Vulcet-in veb-sayt vasitəsilə hansı məlumatı aldığını, niyə istifadə etdiyini və hansı seçimlərinizin olduğunu izah edir. Son yenilənmə: 24 iyul 2026.</p></div></section>
    <div class="page-section"><div class="shell privacy-grid"><aside><a href="#controller">Məsuliyyət</a><a href="#enquiries">Layihə sorğuları</a><a href="#analytics">Analitika</a><a href="#rights">Hüquqlarınız</a><button class="footer-cookie-link" type="button" data-cookie-settings="">Kuki ayarları</button></aside><div class="privacy-content">
      <section id="controller"><h2>Kim məsuliyyət daşıyır</h2><p>Burada təsvir olunan emal üçün məsuliyyət daşıyan qlobal brendinq, məhsul və veb-dizayn studiyası Vulcet-dir. Məxfilik sualları və sorğular <a href="mailto:studio@vulcet.com">studio@vulcet.com</a> ünvanına göndərilə bilər.</p></section>
      <section id="enquiries"><h2>Layihə sorğuları</h2><p>Əlaqə formasını göndərdikdə Vulcet sizin verdiyiniz məlumatları alır: ad, iş e-poçtu, təşkilat, layihə növü, büdcə, vaxt, veb-sayt ünvanı və layihə təsviri.</p><p>Bu məlumat sorğunuzu qiymətləndirmək və cavab vermək, mümkün müqaviləyə doğru addımlar atmaq və zəruri biznes qeydlərini saxlamaq üçün istifadə olunur. Layihə brifinə həssas şəxsi məlumat daxil etməyin.</p><p>Forma Web3Forms vasitəsilə emal olunur. Göndərilən məlumatların emalı həmin xidmətin öz şərtləri və məxfilik təcrübələri ilə də tənzimlənir.</p></section>
      <section id="analytics"><h2>Analitika və razılıq</h2><p>Google Analytics yalnız analitikaya icazə verdikdən sonra saytın ümumi istifadəsini anlamaq üçün istifadə olunur. O vaxta qədər analitika saxlanması Google Consent Mode vasitəsilə rədd edilir. Seçiminiz brauzerinizdə yerli olaraq saxlanılır ki, sayt onu xatırlaya bilsin.</p><p>Bu seçimi istənilən vaxt bu səhifədəki və ya alt hissədəki Kuki ayarları düyməsi ilə dəyişə bilərsiniz. Sayt həmçinin Google Fonts-dan şriftlər yükləyir; bu Google serverlərinə sorğu göndərə bilər.</p></section>
      <section><h2>Saxlama və alıcılar</h2><p>Sorğu məlumatları yalnız layihəni müzakirə etmək, hüquqi və ya uçot öhdəliklərini yerinə yetirmək və ya mübahisəni həll etmək üçün məntiqi olaraq lazım olduğu qədər saxlanılır. Məlumat forma, hostinq və analitikanın işləməsi üçün tələb olunan xidmət təminatçıları tərəfindən emal oluna bilər. Avropa İqtisadi Sahəsindən kənara köçürmələr bu provayderlər beynəlxalq fəaliyyət göstərdikdə baş verə bilər və müvafiq provayderin təklif etdiyi qoruma vasitələri ilə idarə olunur.</p></section>
      <section id="rights"><h2>Hüquqlarınız</h2><p>Şəraitdən və tətbiq olunan GDPR qaydalarından asılı olaraq şəxsi məlumatlarınıza çıxış, düzəliş, silinmə, məhdudlaşdırma və ya daşınma tələb edə, müəyyən emala etiraz edə və ya razılığı geri çəkə bilərsiniz. Həmçinin müvafiq məlumat mühafizəsi orqanına şikayət edə bilərsiniz.</p><p>Sorğu üçün <a href="mailto:studio@vulcet.com">studio@vulcet.com</a> ünvanına yazın. Yerinə yetirmədən əvvəl məntiqi şəxsiyyət yoxlaması tələb oluna bilər.</p></section>
      <section><h2>Dəyişikliklər</h2><p>Veb-sayt, xidmətlər və ya hüquqi tələblər dəyişdikdə bu bildiriş yenilənə bilər. Yuxarıdakı tarix son redaksiyanı göstərir.</p></section>
    </div></div></div>
  </main>"""
    )
    emit(
        "privacy/index.html",
        editorial_shell(
            az_path=az_path,
            body_class="editorial-page",
            nav_current=None,
            head_kwargs={
                "title": "Məxfilik bildirişi və məlumat təcrübələri | Vulcet",
                "description": "Vulcet layihə sorğularını, analitika razılığını və şəxsi məlumatları necə idarə edir.",
                "og_title": "Məxfilik bildirişi və məlumat təcrübələri | Vulcet",
                "og_description": "Vulcet layihə sorğularını, analitika razılığını və şəxsi məlumatları necə idarə edir.",
            },
            main=main,
            footer_kwargs={"more_current": "privacy", "utility_line2": "Məxfilik bildirişi", "utility_line3": "İyul 2026-da yenilənib"},
        ),
    )


def page_site_map() -> None:
    az_path = "site-map"
    main = dedent(
        """
  <main id="main">
    <section class="page-hero"><div class="page-hero-signal" aria-hidden="true"></div><div class="shell page-hero-grid"><div class="editorial-label"><span>01</span><span>Sayt xəritəsi</span></div><h1><em>vulcet.com</em> üzərində bütün ictimai səhifələr.</h1><p class="page-hero-copy">İndekslənə bilən hər səhifənin sadə siyahısı. İnsanlar və axtarış sistemləri üçün faydalıdır.</p></div></section>
    <section class="page-section"><div class="shell privacy-content" style="max-width:720px">
      <h2>Studiya</h2>
      <ul>
        <li><a href="/az/">Ana səhifə</a></li>
        <li><a href="/az/studio/">Studiya</a></li>
        <li><a href="/az/contact/">Əlaqə</a></li>
        <li><a href="/az/privacy/">Məxfilik</a></li>
      </ul>
      <h2>Bloq (ingilis dilində)</h2>
      <ul>
        <li><a href="/blog/">Jurnal</a></li>
        <li><a href="/blog/human-check-captcha-alternative/">Rethinking CAPTCHA: Can verification become part of the interaction?</a></li>
        <li><a href="/blog/your-brand-isnt-outdated-your-system-is/">Your brand isn’t outdated. Your system is.</a></li>
        <li><a href="/blog/what-is-product-design/">What is product design?</a></li>
        <li><a href="/blog/why-most-saas-websites-look-the-same/">Why most SaaS websites look the same</a></li>
        <li><a href="/blog/why-ai-products-look-the-same/">Why every AI product is starting to look the same</a></li>
        <li><a href="/blog/what-redesign-experiments-teach/">What redesign experiments teach</a></li>
        <li><a href="/blog/business-website-vs-growth-website/">Focused website vs content platform</a></li>
        <li><a href="/blog/when-a-business-website-needs-a-redesign/">When a business website needs a redesign</a></li>
      </ul>
      <h2>İşlər</h2>
      <ul>
        <li><a href="/az/work/">Seçilmiş işlər</a></li>
        <li><a href="/az/work/founderclub/">FounderClub layihəsi</a></li>
        <li><a href="/az/work/anadolu-qida/">Anadolu Qida layihəsi</a></li>
      </ul>
      <h2>Eksperimentlər (ingilis dilində)</h2>
      <ul>
        <li><a href="/redesigns/">Studiya eksperimentləri</a></li>
        <li><a href="/redesigns/kinetic-clarity/">Kinetic Clarity — unofficial Nike product page study</a></li>
        <li><a href="/redesigns/nike/">Kinetic Clarity — interactive Nike product stage</a></li>
        <li><a href="/redesigns/playstation/">Kinetic Surface — unofficial PlayStation homepage study</a></li>
        <li><a href="/redesigns/case-studio/">Case Studio — 3D phone case designer</a></li>
        <li><a href="/redesigns/hold/">HOLD — purchase decision tool</a></li>
        <li><a href="/experiments/human-check/">Human Check — CAPTCHA UX experiment</a></li>
      </ul>
      <h2>Xidmətlər</h2>
      <ul>
        <li><a href="/az/services/">Xidmətlərə ümumi baxış</a></li>
        <li><a href="/az/services/brand-strategy/">Brend strategiyası</a></li>
        <li><a href="/az/services/visual-identity/">Vizual kimlik</a></li>
        <li><a href="/az/services/product-design/">Məhsul dizaynı</a></li>
        <li><a href="/az/services/web-development/">Veb proqramlaşdırma</a></li>
      </ul>
      <p style="margin-top:40px"><a class="text-link" href="/sitemap.xml">XML sayt xəritəsi <span aria-hidden="true">↗</span></a></p>
    </div></section>
  </main>"""
    )
    emit(
        "site-map/index.html",
        editorial_shell(
            az_path=az_path,
            body_class="editorial-page",
            nav_current=None,
            head_kwargs={
                "title": "İctimai səhifələrin sayt xəritəsi | Vulcet",
                "description": "vulcet.com üzərində bütün ictimai səhifələr — işlər, eksperimentlər, xidmətlər, studiya, bloq və əlaqə.",
                "og_title": "İctimai səhifələrin sayt xəritəsi | Vulcet",
                "og_description": "vulcet.com üzərində bütün ictimai səhifələr.",
            },
            main=main,
            footer_kwargs={"more_current": "site-map", "utility_line2": "Qlobal brendinq, məhsul və veb-dizayn"},
        ),
    )


def page_404() -> None:
    az_path = "404"
    head = render_head(
        az_path=az_path,
        title="Səhifə tapılmadı — Vulcet",
        description="Səhifə tapılmadı.",
        og_title="Səhifə tapılmadı — Vulcet",
        og_description="Səhifə tapılmadı.",
        robots="noindex",
        theme_color="#0b0c10",
        include_gtag=False,
        style_css=STYLE_EDITORIAL,
    )
    body = f"""{head}
<body><div class="not-found"><header><a href="{AZ_PREFIX}/" aria-label="Vulcet — ana səhifə"><img src="/vulcet-wordmark.png?v=20260809-2" alt="Vulcet"></a><nav class="lang-switch" aria-label="Dil"><a class="lang-switch__link" href="{SITE}/404.html" lang="en" hreflang="en">EN</a><span class="lang-switch__sep" aria-hidden="true">/</span><a class="lang-switch__link is-active" href="{SITE}/az/404.html" lang="az" hreflang="az" aria-current="page">AZ</a></nav></header><main><small>Xəta 404</small><h1>Bu səhifə başqa yerə <em>keçib.</em></h1><p>Ünvan köhnəlmiş ola bilər və ya səhifə artıq mövcud olmaya bilər.</p><a href="{AZ_PREFIX}/">Ana səhifəyə qayıt ↗</a></main><footer><span>Vulcet</span><span>Strategiya, dizayn və proqramlaşdırma</span></footer></div>
<style>
  *{{box-sizing:border-box}}body{{margin:0;background:#0b0c10;color:#f4f2ed;font-family:Inter,Arial,sans-serif}}.not-found{{min-height:100svh;padding:28px clamp(22px,5vw,80px);display:grid;grid-template-rows:auto 1fr auto}}.not-found img{{width:108px;filter:invert(1)}}.not-found main{{align-self:center;max-width:980px}}.not-found small{{color:#9b9ca3;font-size:11px;text-transform:uppercase;letter-spacing:.1em}}.not-found h1{{margin:24px 0;font-size:clamp(58px,10vw,140px);line-height:.85;letter-spacing:-.075em}}.not-found h1 em{{font-family:"Instrument Serif",serif;font-weight:400}}.not-found p{{max-width:520px;color:#b7b8bf;font-size:18px;line-height:1.5}}.not-found a{{display:inline-flex;margin-top:28px;padding:16px 22px;border-radius:999px;background:#f4f2ed;color:#0b0c10;text-decoration:none;font-weight:600}}.not-found footer{{display:flex;justify-content:space-between;color:#777981;font-size:12px}}@media(max-width:600px){{.not-found{{padding:22px}}.not-found h1{{font-size:62px}}.not-found footer{{gap:12px;flex-direction:column}}}}
</style>
<link rel="stylesheet" href="/lang-switcher.css">
</body></html>"""
    emit("404.html", body)


def main() -> None:
    page_home()
    page_all_services()
    page_studio()
    page_work_index()
    page_work_cases()
    page_contact()
    page_privacy()
    page_site_map()
    page_404()
    print(f"Generated {len(GENERATED)} AZ pages:")
    for path in GENERATED:
        print(f"  {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
