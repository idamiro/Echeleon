/* Interactive product stage — real Nike catalog by audience */

(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const CATALOG = {
    women: [
      {
        id: "w-af1",
        name: "Nike Air Force 1",
        short: "The icon. Three classic colorways.",
        line: "Women · Lifestyle",
        ghost: "FORCE",
        price: "$115.00",
        image: "assets/nike/catalog/w-af1-white.jpg",
        detail: "assets/nike/catalog/w-af1-white.jpg",
        angles: [
          "assets/nike/catalog/w-af1-white.jpg",
          "assets/nike/catalog/w-af1-black.jpg",
          "assets/nike/catalog/w-af1-pink.jpg",
          "assets/nike/catalog/w-af1-white.jpg",
        ],
        theme: { a: "#f5f5f5", b: "#9e9e9e", page: "#e6d7cb", ink: "#16181c" },
        colors: [
          { id: "white", label: "White", hex: "#f5f5f5", image: "assets/nike/catalog/w-af1-white.jpg", theme: { a: "#ffffff", b: "#bdbdbd", page: "#e6d7cb", ink: "#16181c" } },
          { id: "black", label: "Black", hex: "#212121", image: "assets/nike/catalog/w-af1-black.jpg", theme: { a: "#616161", b: "#111111", page: "#9e9e9e" } },
          { id: "pink", label: "Pink", hex: "#f8bbd0", image: "assets/nike/catalog/w-af1-pink.jpg", theme: { a: "#f8bbd0", b: "#ec407a", page: "#f0c4d0", ink: "#16181c" } },
        ],
      },
      {
        id: "w-pegasus",
        name: "Nike Pegasus",
        short: "Everyday miles. Three race-ready colors.",
        line: "Women · Running",
        ghost: "PEGASUS",
        price: "$140.00",
        image: "assets/nike/catalog/w-pegasus-red.jpg",
        detail: "assets/nike/catalog/w-pegasus-red.jpg",
        angles: [
          "assets/nike/catalog/w-pegasus-red.jpg",
          "assets/nike/catalog/w-pegasus-teal.jpg",
          "assets/nike/catalog/w-pegasus-black.jpg",
          "assets/nike/catalog/w-pegasus-red.jpg",
        ],
        theme: { a: "#ef5350", b: "#b71c1c", page: "#f0a39c", ink: "#ffffff" },
        colors: [
          { id: "crimson", label: "Crimson", hex: "#e53935", image: "assets/nike/catalog/w-pegasus-red.jpg", theme: { a: "#ef5350", b: "#b71c1c", page: "#f0a39c" } },
          { id: "teal", label: "Teal", hex: "#26a69a", image: "assets/nike/catalog/w-pegasus-teal.jpg", theme: { a: "#4db6ac", b: "#00695c", page: "#9fd4cc" } },
          { id: "volt", label: "Black/Volt", hex: "#c6ff00", image: "assets/nike/catalog/w-pegasus-black.jpg", theme: { a: "#c6ff00", b: "#212121", page: "#b8c97a", ink: "#16181c" } },
        ],
      },
      {
        id: "w-dunk",
        name: "Nike Dunk Low",
        short: "Court heritage. Three clean colorways.",
        line: "Women · Lifestyle",
        ghost: "DUNK",
        price: "$120.00",
        image: "assets/nike/catalog/w-dunk-panda.jpg",
        detail: "assets/nike/catalog/w-dunk-panda.jpg",
        angles: [
          "assets/nike/catalog/w-dunk-panda.jpg",
          "assets/nike/catalog/w-dunk-blue.jpg",
          "assets/nike/catalog/w-dunk-pink.jpg",
          "assets/nike/catalog/w-dunk-panda.jpg",
        ],
        theme: { a: "#f5f5f5", b: "#212121", page: "#d7d0c8", ink: "#16181c" },
        colors: [
          { id: "panda", label: "Panda", hex: "#212121", image: "assets/nike/catalog/w-dunk-panda.jpg", theme: { a: "#f5f5f5", b: "#212121", page: "#d7d0c8", ink: "#16181c" } },
          { id: "unc", label: "University Blue", hex: "#64b5f6", image: "assets/nike/catalog/w-dunk-blue.jpg", theme: { a: "#90caf9", b: "#1565c0", page: "#a8cce8" } },
          { id: "pink", label: "Pink", hex: "#f48fb1", image: "assets/nike/catalog/w-dunk-pink.jpg", theme: { a: "#f8bbd0", b: "#ec407a", page: "#f0c4d0", ink: "#16181c" } },
        ],
      },
    ],
    men: [
      {
        id: "m-jordan",
        name: "Air Jordan 1 Retro High",
        short: "Legacy high-top. Three iconic colorways.",
        line: "Men · Jordan",
        ghost: "JORDAN",
        price: "$180.00",
        image: "assets/nike/catalog/m-jordan-chicago.jpg",
        detail: "assets/nike/catalog/m-jordan-chicago.jpg",
        angles: [
          "assets/nike/catalog/m-jordan-chicago.jpg",
          "assets/nike/catalog/m-jordan-royal.jpg",
          "assets/nike/catalog/m-jordan-bred.jpg",
          "assets/nike/catalog/m-jordan-chicago.jpg",
        ],
        theme: { a: "#e53935", b: "#111111", page: "#c98984", ink: "#ffffff" },
        colors: [
          { id: "chicago", label: "Chicago", hex: "#c62828", image: "assets/nike/catalog/m-jordan-chicago.jpg", theme: { a: "#e53935", b: "#111111", page: "#c98984" } },
          { id: "royal", label: "Royal", hex: "#1e88e5", image: "assets/nike/catalog/m-jordan-royal.jpg", theme: { a: "#42a5f5", b: "#0d47a1", page: "#8eb6d9" } },
          { id: "bred", label: "Bred", hex: "#b71c1c", image: "assets/nike/catalog/m-jordan-bred.jpg", theme: { a: "#ef5350", b: "#000000", page: "#b88784" } },
        ],
      },
      {
        id: "m-am97",
        name: "Nike Air Max 97",
        short: "Full-length Air. Three metallic moods.",
        line: "Men · Lifestyle",
        ghost: "AIR MAX",
        price: "$175.00",
        image: "assets/nike/catalog/m-am97-silver.jpg",
        detail: "assets/nike/catalog/m-am97-silver.jpg",
        angles: [
          "assets/nike/catalog/m-am97-silver.jpg",
          "assets/nike/catalog/m-am97-black.jpg",
          "assets/nike/catalog/m-am97-gold.jpg",
          "assets/nike/catalog/m-am97-silver.jpg",
        ],
        theme: { a: "#cfd8dc", b: "#546e7a", page: "#b7c2c8", ink: "#16181c" },
        colors: [
          { id: "silver", label: "Silver", hex: "#90a4ae", image: "assets/nike/catalog/m-am97-silver.jpg", theme: { a: "#cfd8dc", b: "#546e7a", page: "#b7c2c8", ink: "#16181c" } },
          { id: "black", label: "Black", hex: "#212121", image: "assets/nike/catalog/m-am97-black.jpg", theme: { a: "#616161", b: "#000000", page: "#8e8e8e" } },
          { id: "gold", label: "Gold", hex: "#ffd54f", image: "assets/nike/catalog/m-am97-gold.jpg", theme: { a: "#ffe082", b: "#f9a825", page: "#e8d39a", ink: "#16181c" } },
        ],
      },
      {
        id: "m-blazer",
        name: "Nike Blazer Mid '77",
        short: "Vintage court. Three swoosh colors.",
        line: "Men · Lifestyle",
        ghost: "BLAZER",
        price: "$105.00",
        image: "assets/nike/catalog/m-blazer-red.jpg",
        detail: "assets/nike/catalog/m-blazer-red.jpg",
        angles: [
          "assets/nike/catalog/m-blazer-red.jpg",
          "assets/nike/catalog/m-blazer-black.jpg",
          "assets/nike/catalog/m-blazer-navy.jpg",
          "assets/nike/catalog/m-blazer-red.jpg",
        ],
        theme: { a: "#ef9a9a", b: "#c62828", page: "#e8b5b0", ink: "#16181c" },
        colors: [
          { id: "red", label: "University Red", hex: "#e53935", image: "assets/nike/catalog/m-blazer-red.jpg", theme: { a: "#ef9a9a", b: "#c62828", page: "#e8b5b0", ink: "#16181c" } },
          { id: "black", label: "Black", hex: "#212121", image: "assets/nike/catalog/m-blazer-black.jpg", theme: { a: "#eeeeee", b: "#212121", page: "#cfcfcf", ink: "#16181c" } },
          { id: "navy", label: "Navy", hex: "#1565c0", image: "assets/nike/catalog/m-blazer-navy.jpg", theme: { a: "#90caf9", b: "#0d47a1", page: "#a8c4e0", ink: "#16181c" } },
        ],
      },
    ],
    kids: [
      {
        id: "k-force",
        name: "Nike Force Kids",
        short: "Mini Force. Three everyday colors.",
        line: "Kids · Lifestyle",
        ghost: "FORCE",
        price: "$75.00",
        image: "assets/nike/catalog/k-force-white.jpg",
        detail: "assets/nike/catalog/k-force-white.jpg",
        angles: [
          "assets/nike/catalog/k-force-white.jpg",
          "assets/nike/catalog/k-force-black.jpg",
          "assets/nike/catalog/k-force-pink.jpg",
          "assets/nike/catalog/k-force-white.jpg",
        ],
        theme: { a: "#ffffff", b: "#bdbdbd", page: "#e6d7cb", ink: "#16181c" },
        colors: [
          { id: "white", label: "White", hex: "#f5f5f5", image: "assets/nike/catalog/k-force-white.jpg", theme: { a: "#ffffff", b: "#bdbdbd", page: "#e6d7cb", ink: "#16181c" } },
          { id: "black", label: "Black", hex: "#212121", image: "assets/nike/catalog/k-force-black.jpg", theme: { a: "#616161", b: "#111111", page: "#9e9e9e" } },
          { id: "pink", label: "Pink", hex: "#f48fb1", image: "assets/nike/catalog/k-force-pink.jpg", theme: { a: "#f8bbd0", b: "#ec407a", page: "#f0c4d0", ink: "#16181c" } },
        ],
      },
      {
        id: "k-run",
        name: "Nike Kids Runner",
        short: "Play-all-day cushion. Three bright colors.",
        line: "Kids · Running",
        ghost: "RUN",
        price: "$70.00",
        image: "assets/nike/catalog/k-run-blue.jpg",
        detail: "assets/nike/catalog/k-run-blue.jpg",
        angles: [
          "assets/nike/catalog/k-run-blue.jpg",
          "assets/nike/catalog/k-run-green.jpg",
          "assets/nike/catalog/k-run-orange.jpg",
          "assets/nike/catalog/k-run-blue.jpg",
        ],
        theme: { a: "#4fc3f7", b: "#0277bd", page: "#9ecae8", ink: "#ffffff" },
        colors: [
          { id: "blue", label: "Blue", hex: "#039be5", image: "assets/nike/catalog/k-run-blue.jpg", theme: { a: "#4fc3f7", b: "#01579b", page: "#9ecae8" } },
          { id: "green", label: "Green", hex: "#7cb342", image: "assets/nike/catalog/k-run-green.jpg", theme: { a: "#aed581", b: "#558b2f", page: "#c5d9a0", ink: "#16181c" } },
          { id: "orange", label: "Orange", hex: "#fb8c00", image: "assets/nike/catalog/k-run-orange.jpg", theme: { a: "#ffb74d", b: "#ef6c00", page: "#f0c79a", ink: "#16181c" } },
        ],
      },
      {
        id: "k-court",
        name: "Nike Court Kids",
        short: "Court classic. Three swoosh colors.",
        line: "Kids · Court",
        ghost: "COURT",
        price: "$65.00",
        image: "assets/nike/catalog/k-court-navy.jpg",
        detail: "assets/nike/catalog/k-court-navy.jpg",
        angles: [
          "assets/nike/catalog/k-court-navy.jpg",
          "assets/nike/catalog/k-court-red.jpg",
          "assets/nike/catalog/k-court-black.jpg",
          "assets/nike/catalog/k-court-navy.jpg",
        ],
        theme: { a: "#90caf9", b: "#1565c0", page: "#b0c9e0", ink: "#16181c" },
        colors: [
          { id: "navy", label: "Navy", hex: "#1565c0", image: "assets/nike/catalog/k-court-navy.jpg", theme: { a: "#90caf9", b: "#0d47a1", page: "#b0c9e0", ink: "#16181c" } },
          { id: "red", label: "Red", hex: "#e53935", image: "assets/nike/catalog/k-court-red.jpg", theme: { a: "#ef9a9a", b: "#c62828", page: "#e8b5b0", ink: "#16181c" } },
          { id: "black", label: "Black", hex: "#212121", image: "assets/nike/catalog/k-court-black.jpg", theme: { a: "#eeeeee", b: "#212121", page: "#cfcfcf", ink: "#16181c" } },
        ],
      },
    ],
  };

  const DETAIL_SIZES = {
    women: ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5"],
    men: ["7", "7.5", "8", "8.5", "9", "9.5", "10", "11"],
    kids: ["1", "1.5", "2", "2.5", "3", "3.5", "4", "5"],
  };

  const FULL_SIZES = {
    women: ["UK 3","UK 3.5","UK 4","UK 4.5","UK 5","UK 5.5","UK 6","UK 6.5","UK 7","UK 7.5","UK 8","UK 8.5"],
    men: ["UK 6","UK 6.5","UK 7","UK 7.5","UK 8","UK 8.5","UK 9","UK 9.5","UK 10","UK 10.5","UK 11","UK 12"],
    kids: ["UK 10C","UK 11C","UK 12C","UK 13C","UK 1","UK 1.5","UK 2","UK 2.5","UK 3","UK 3.5","UK 4","UK 5"],
  };

  const state = {
    view: "carousel",
    audience: "women",
    productIndex: 0,
    colorIndex: 0,
    size: "7",
    fullSize: "UK 6",
  };

  const els = {
    stage: document.getElementById("stage"),
    tiltRoot: document.getElementById("tiltRoot"),
    card: document.getElementById("stageCard"),
    carousel: document.getElementById("carousel"),
    dots: document.getElementById("carouselDots"),
    views: {
      carousel: document.getElementById("viewCarousel"),
      detail: document.getElementById("viewDetail"),
      sizes: document.getElementById("viewSizes"),
    },
    ghost: document.getElementById("ghostName"),
    title: document.getElementById("detailTitle"),
    line: document.getElementById("detailLine"),
    shoe: document.getElementById("detailShoe"),
    price: document.getElementById("pricePill"),
    sizeRow: document.getElementById("sizeRow"),
    swatches: document.getElementById("swatches"),
    angleGrid: document.getElementById("angleGrid"),
    sizeGrid: document.getElementById("sizeGrid"),
  };

  function list() {
    return CATALOG[state.audience] || CATALOG.women;
  }

  function product() {
    return list()[state.productIndex] || list()[0];
  }

  function activeColor() {
    const p = product();
    return p.colors[state.colorIndex] || p.colors[0];
  }

  function applyTheme(theme) {
    const t = theme || product().theme;
    const root = document.documentElement;
    root.style.setProperty("--theme-a", t.a);
    root.style.setProperty("--theme-b", t.b);
    root.style.setProperty("--theme-page", t.page || t.a);
    root.style.setProperty("--theme-ink", t.ink || "#ffffff");
    document.body.dataset.themeInk = t.ink === "#16181c" ? "dark" : "light";
  }

  function setView(name) {
    state.view = name;
    els.stage.dataset.view = name;
    Object.entries(els.views).forEach(([key, el]) => {
      const on = key === name;
      el.classList.toggle("is-active", on);
      el.hidden = !on;
    });
  }

  function renderCarousel() {
    const items = list();
    els.carousel.innerHTML = items
      .map(
        (p, i) => `
      <button type="button" class="product-card${i === Math.min(1, items.length - 1) ? " is-hot" : ""}" data-open="${i}" aria-label="Open ${p.name}">
        <span class="product-media" style="--glow:${p.theme.a}">
          <img src="${p.image}" alt="${p.name}" width="480" height="320">
        </span>
        <h2>${p.name}</h2>
        <p>${p.short}</p>
        <span class="know-more">Know more</span>
      </button>`
      )
      .join("");

    els.dots.innerHTML = items
      .map(
        (_, i) =>
          `<button type="button" aria-label="Product ${i + 1}" data-dot="${i}" class="${i === state.productIndex ? "is-active" : ""}"></button>`
      )
      .join("");

    // Audience average theme for carousel
    const avg = items[Math.min(1, items.length - 1)]?.theme || items[0].theme;
    applyTheme(avg);
  }

  function renderDetail() {
    const p = product();
    const color = activeColor();
    const theme = color.theme || p.theme;
    applyTheme(theme);

    els.ghost.textContent = p.ghost;
    els.title.textContent = p.name;
    els.line.textContent = p.line;
    els.price.textContent = p.price;
    els.shoe.src = color.image || p.detail;
    els.shoe.alt = p.name;

    const sizes = DETAIL_SIZES[state.audience];
    if (!sizes.includes(state.size)) state.size = sizes[Math.floor(sizes.length / 2)];

    els.sizeRow.innerHTML = sizes
      .map(
        (s) =>
          `<button type="button" class="size-chip${s === state.size ? " is-active" : ""}" role="option" aria-selected="${s === state.size}" data-size="${s}">${s}</button>`
      )
      .join("");

    els.swatches.innerHTML = p.colors
      .map(
        (c, i) =>
          `<button type="button" class="swatch${i === state.colorIndex ? " is-active" : ""}" role="option" aria-label="Colorway ${c.id}" aria-selected="${i === state.colorIndex}" data-color="${i}" style="background:${c.hex}"></button>`
      )
      .join("");
  }

  function renderSizes() {
    const p = product();
    const color = activeColor();
    applyTheme(color.theme || p.theme);
    els.angleGrid.innerHTML = p.angles.map((src) => `<img src="${src}" alt="">`).join("");

    const sizes = FULL_SIZES[state.audience];
    if (!sizes.includes(state.fullSize)) state.fullSize = sizes[Math.floor(sizes.length / 2)];

    els.sizeGrid.innerHTML = sizes
      .map((s) => {
        const label = s.replace(/^UK\s*/, "");
        return `<button type="button" class="size-cell${s === state.fullSize ? " is-active" : ""}" data-full="${s}">${label}</button>`;
      })
      .join("");
  }

  function openProduct(index) {
    state.productIndex = index;
    state.colorIndex = 0;
    renderDetail();
    setView("detail");
    if (!reduced) {
      els.shoe.style.opacity = "0";
      els.shoe.style.transform = "rotate(-18deg) scale(0.92)";
      requestAnimationFrame(() => {
        els.shoe.style.opacity = "1";
        els.shoe.style.transform = "";
      });
    }
  }

  function setAudience(aud) {
    if (!CATALOG[aud]) return;
    state.audience = aud;
    state.productIndex = 0;
    state.colorIndex = 0;
    document.querySelectorAll(".seg-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.seg === aud);
    });
    renderCarousel();
    setView("carousel");
  }

  /* events */
  els.carousel.addEventListener("click", (e) => {
    const card = e.target.closest("[data-open]");
    if (!card) return;
    openProduct(Number(card.dataset.open));
  });

  els.dots.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-dot]");
    if (!btn) return;
    state.productIndex = Number(btn.dataset.dot);
    [...els.dots.children].forEach((d, i) => d.classList.toggle("is-active", i === state.productIndex));
    [...els.carousel.children].forEach((c, i) => c.classList.toggle("is-hot", i === state.productIndex));
    applyTheme(list()[state.productIndex].theme);
  });

  document.getElementById("homeBtn").addEventListener("click", () => {
    renderCarousel();
    setView("carousel");
  });

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => setAudience(btn.dataset.seg));
  });

  els.views.detail.addEventListener("click", (e) => {
    const size = e.target.closest("[data-size]");
    if (size) {
      state.size = size.dataset.size;
      renderDetail();
      return;
    }
    const color = e.target.closest("[data-color]");
    if (color) {
      state.colorIndex = Number(color.dataset.color);
      renderDetail();
      const swatch = activeColor();
      document.documentElement.style.setProperty("--swatch-glow", swatch.hex);
      if (!reduced) {
        els.card.classList.add("is-theme-flash");
        els.shoe.style.transform = "rotate(-6deg) scale(1.04)";
        setTimeout(() => {
          els.shoe.style.transform = "";
          els.card.classList.remove("is-theme-flash");
        }, 320);
      }
    }
  });

  document.getElementById("openSizes").addEventListener("click", () => {
    renderSizes();
    setView("sizes");
  });
  document.getElementById("preorderBtn").addEventListener("click", () => {
    renderSizes();
    setView("sizes");
  });
  document.getElementById("backDetail").addEventListener("click", () => {
    renderDetail();
    setView("detail");
  });

  els.views.sizes.addEventListener("click", (e) => {
    const cell = e.target.closest("[data-full]");
    if (!cell) return;
    state.fullSize = cell.dataset.full;
    renderSizes();
  });

  document.getElementById("buyBtn").addEventListener("click", () => {
    const btn = document.getElementById("buyBtn");
    btn.textContent = "Added · Concept only";
    setTimeout(() => {
      btn.textContent = "Add to bag";
    }, 1600);
  });

  /* Parallax tilt */
  if (canHover && !reduced) {
    const root = els.tiltRoot;
    const ghost = els.ghost;
    const shoe = els.shoe;
    let raf = 0;
    let tx = 0;
    let ty = 0;

    els.card.addEventListener("pointermove", (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tx = x;
      ty = y;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          root.style.transform = `rotateY(${tx * 8}deg) rotateX(${-ty * 6}deg)`;
          if (state.view === "detail") {
            ghost.style.transform = `translate(calc(-50% + ${tx * -28}px), calc(-50% + ${ty * -18}px))`;
            shoe.style.translate = `${tx * 18}px ${ty * 12}px`;
          }
          raf = 0;
        });
      }
    });

    els.card.addEventListener("pointerleave", () => {
      root.style.transform = "";
      ghost.style.transform = "translate(-50%, -50%)";
      shoe.style.translate = "";
    });
  }

  /* boot */
  setAudience("women");
})();
