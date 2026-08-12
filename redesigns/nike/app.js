/* Interactive product stage — real Nike catalog by audience */

(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const CATALOG = {
    women: [
      {
        id: "free-rn",
        name: "Nike Free RN Flyknit",
        short: "Natural motion running with a Flyknit upper.",
        line: "Women · Running",
        ghost: "FREE",
        price: "$130.00",
        image: "assets/nike/airmax-red.jpg",
        detail: "assets/nike/airmax-red.jpg",
        angles: [
          "assets/nike/airmax-red.jpg",
          "assets/nike/react-orange.jpg",
          "assets/nike/airmax-blue.jpg",
          "assets/nike/pegasus-teal.jpg",
        ],
        theme: { a: "#ff6b6b", b: "#c62828", page: "#f5a8a0", ink: "#ffffff" },
        colors: [
          { id: "crimson", hex: "#e53935", image: "assets/nike/airmax-red.jpg", theme: { a: "#ff6b6b", b: "#b71c1c", page: "#f5a8a0" } },
          { id: "orange", hex: "#fb8c00", image: "assets/nike/react-orange.jpg", theme: { a: "#ffb74d", b: "#ef6c00", page: "#f5c79a" } },
          { id: "blue", hex: "#1e88e5", image: "assets/nike/airmax-blue.jpg", theme: { a: "#64b5f6", b: "#1565c0", page: "#a8c8e8" } },
        ],
      },
      {
        id: "pegasus",
        name: "Nike Pegasus",
        short: "Everyday miles. Responsive cushioning.",
        line: "Women · Running",
        ghost: "PEGASUS",
        price: "$140.00",
        image: "assets/nike/pegasus-teal.jpg",
        detail: "assets/nike/pegasus-teal.jpg",
        angles: [
          "assets/nike/pegasus-teal.jpg",
          "assets/nike/vomero-green.jpg",
          "assets/nike/airmax-blue.jpg",
          "assets/nike/airmax-red.jpg",
        ],
        theme: { a: "#2a2d32", b: "#0f1114", page: "#9aa3ad", ink: "#ffffff" },
        colors: [
          { id: "graphite", hex: "#212121", image: "assets/nike/pegasus-teal.jpg", theme: { a: "#3a3f46", b: "#101215", page: "#9aa3ad" } },
          { id: "volt", hex: "#c8f135", image: "assets/nike/vomero-green.jpg", theme: { a: "#c8f135", b: "#6a9a12", page: "#c5d98a" } },
          { id: "ocean", hex: "#0288d1", image: "assets/nike/airmax-blue.jpg", theme: { a: "#4fc3f7", b: "#0277bd", page: "#9bc6e0" } },
        ],
      },
      {
        id: "af1-women",
        name: "Nike Air Force 1",
        short: "The icon. Clean silhouette, everyday stance.",
        line: "Women · Lifestyle",
        ghost: "FORCE",
        price: "$115.00",
        image: "assets/nike/af1-white.jpg",
        detail: "assets/nike/af1-white.jpg",
        angles: [
          "assets/nike/af1-white.jpg",
          "assets/nike/airforce-pair.jpg",
          "assets/nike/dunk-low.jpg",
          "assets/nike/jordan-white.jpg",
        ],
        theme: { a: "#f5f5f5", b: "#d0d0d0", page: "#e8d5c8", ink: "#16181c" },
        colors: [
          { id: "white", hex: "#f2f2f2", image: "assets/nike/af1-white.jpg", theme: { a: "#ffffff", b: "#d7d7d7", page: "#e8d5c8", ink: "#16181c" } },
          { id: "multi", hex: "#ec407a", image: "assets/nike/airforce-pair.jpg", theme: { a: "#f48fb1", b: "#ad1457", page: "#f0b8c8", ink: "#ffffff" } },
          { id: "neutral", hex: "#8d6e63", image: "assets/nike/dunk-low.jpg", theme: { a: "#bcaaa4", b: "#5d4037", page: "#d7c4b5", ink: "#ffffff" } },
        ],
      },
    ],
    men: [
      {
        id: "jordan1",
        name: "Air Jordan 1",
        short: "Heritage high-top. Court legend energy.",
        line: "Men · Jordan",
        ghost: "JORDAN",
        price: "$180.00",
        image: "assets/nike/jordan1-chicago.jpg",
        detail: "assets/nike/jordan1-chicago.jpg",
        angles: [
          "assets/nike/jordan1-chicago.jpg",
          "assets/nike/jordan-red.jpg",
          "assets/nike/jordan-white.jpg",
          "assets/nike/dunk-low.jpg",
        ],
        theme: { a: "#e53935", b: "#1a1a1a", page: "#c98984", ink: "#ffffff" },
        colors: [
          { id: "bred", hex: "#c62828", image: "assets/nike/jordan1-chicago.jpg", theme: { a: "#e53935", b: "#111111", page: "#c98984" } },
          { id: "red", hex: "#d32f2f", image: "assets/nike/jordan-red.jpg", theme: { a: "#ef5350", b: "#b71c1c", page: "#e0a09a" } },
          { id: "white", hex: "#eeeeee", image: "assets/nike/jordan-white.jpg", theme: { a: "#fafafa", b: "#bdbdbd", page: "#d9cfc6", ink: "#16181c" } },
        ],
      },
      {
        id: "airmax97",
        name: "Nike Air Max 97",
        short: "Full-length Air. Metallic wave lines.",
        line: "Men · Lifestyle",
        ghost: "AIR MAX",
        price: "$175.00",
        image: "assets/nike/airmax97.jpg",
        detail: "assets/nike/airmax97.jpg",
        angles: [
          "assets/nike/airmax97.jpg",
          "assets/nike/airmax-blue.jpg",
          "assets/nike/airmax-red.jpg",
          "assets/nike/vomero-green.jpg",
        ],
        theme: { a: "#90a4ae", b: "#455a64", page: "#b7c2c8", ink: "#ffffff" },
        colors: [
          { id: "silver", hex: "#90a4ae", image: "assets/nike/airmax97.jpg", theme: { a: "#cfd8dc", b: "#546e7a", page: "#b7c2c8", ink: "#16181c" } },
          { id: "blue", hex: "#1976d2", image: "assets/nike/airmax-blue.jpg", theme: { a: "#64b5f6", b: "#0d47a1", page: "#9bb8d9" } },
          { id: "heat", hex: "#e53935", image: "assets/nike/airmax-red.jpg", theme: { a: "#ef5350", b: "#b71c1c", page: "#e0a39c" } },
        ],
      },
      {
        id: "dunk",
        name: "Nike Dunk Low",
        short: "Skate heritage. Street staple.",
        line: "Men · Lifestyle",
        ghost: "DUNK",
        price: "$120.00",
        image: "assets/nike/dunk-low.jpg",
        detail: "assets/nike/dunk-low.jpg",
        angles: [
          "assets/nike/dunk-low.jpg",
          "assets/nike/af1-white.jpg",
          "assets/nike/jordan-white.jpg",
          "assets/nike/airforce-pair.jpg",
        ],
        theme: { a: "#8d6e63", b: "#4e342e", page: "#cbb3a3", ink: "#ffffff" },
        colors: [
          { id: "mocha", hex: "#6d4c41", image: "assets/nike/dunk-low.jpg", theme: { a: "#a1887f", b: "#3e2723", page: "#cbb3a3" } },
          { id: "white", hex: "#f5f5f5", image: "assets/nike/af1-white.jpg", theme: { a: "#ffffff", b: "#cfcfcf", page: "#e6d7cb", ink: "#16181c" } },
          { id: "pair", hex: "#7e57c2", image: "assets/nike/airforce-pair.jpg", theme: { a: "#b39ddb", b: "#4527a0", page: "#c5b3e0" } },
        ],
      },
    ],
    kids: [
      {
        id: "kids-force",
        name: "Nike Force Kids",
        short: "Durable court style sized for kids.",
        line: "Kids · Lifestyle",
        ghost: "FORCE",
        price: "$75.00",
        image: "assets/nike/kids-bright.jpg",
        detail: "assets/nike/kids-bright.jpg",
        angles: [
          "assets/nike/kids-bright.jpg",
          "assets/nike/kids-blue.jpg",
          "assets/nike/jordan-white.jpg",
          "assets/nike/af1-white.jpg",
        ],
        theme: { a: "#ff7043", b: "#f9a825", page: "#f0c29a", ink: "#16181c" },
        colors: [
          { id: "bright", hex: "#ff7043", image: "assets/nike/kids-bright.jpg", theme: { a: "#ff8a65", b: "#f9a825", page: "#f0c29a", ink: "#16181c" } },
          { id: "blue", hex: "#29b6f6", image: "assets/nike/kids-blue.jpg", theme: { a: "#4fc3f7", b: "#0288d1", page: "#a6d4ef" } },
          { id: "white", hex: "#eeeeee", image: "assets/nike/jordan-white.jpg", theme: { a: "#fafafa", b: "#bdbdbd", page: "#ddd2c8", ink: "#16181c" } },
        ],
      },
      {
        id: "kids-runner",
        name: "Nike Kids Runner",
        short: "Lightweight play-all-day cushioning.",
        line: "Kids · Running",
        ghost: "RUN",
        price: "$70.00",
        image: "assets/nike/kids-blue.jpg",
        detail: "assets/nike/kids-blue.jpg",
        angles: [
          "assets/nike/kids-blue.jpg",
          "assets/nike/vomero-green.jpg",
          "assets/nike/react-orange.jpg",
          "assets/nike/kids-bright.jpg",
        ],
        theme: { a: "#29b6f6", b: "#0277bd", page: "#9ecae8", ink: "#ffffff" },
        colors: [
          { id: "sky", hex: "#039be5", image: "assets/nike/kids-blue.jpg", theme: { a: "#4fc3f7", b: "#01579b", page: "#9ecae8" } },
          { id: "green", hex: "#7cb342", image: "assets/nike/vomero-green.jpg", theme: { a: "#aed581", b: "#558b2f", page: "#c5d9a0", ink: "#16181c" } },
          { id: "orange", hex: "#fb8c00", image: "assets/nike/react-orange.jpg", theme: { a: "#ffb74d", b: "#ef6c00", page: "#f0c79a", ink: "#16181c" } },
        ],
      },
      {
        id: "kids-court",
        name: "Nike Court Kids",
        short: "Classic court look for the next rotation.",
        line: "Kids · Court",
        ghost: "COURT",
        price: "$65.00",
        image: "assets/nike/jordan-white.jpg",
        detail: "assets/nike/jordan-white.jpg",
        angles: [
          "assets/nike/jordan-white.jpg",
          "assets/nike/af1-white.jpg",
          "assets/nike/dunk-low.jpg",
          "assets/nike/kids-bright.jpg",
        ],
        theme: { a: "#eceff1", b: "#90a4ae", page: "#d5cfc8", ink: "#16181c" },
        colors: [
          { id: "white", hex: "#f5f5f5", image: "assets/nike/jordan-white.jpg", theme: { a: "#ffffff", b: "#b0bec5", page: "#d5cfc8", ink: "#16181c" } },
          { id: "force", hex: "#eeeeee", image: "assets/nike/af1-white.jpg", theme: { a: "#fafafa", b: "#cfd8dc", page: "#e2d6cc", ink: "#16181c" } },
          { id: "dunk", hex: "#8d6e63", image: "assets/nike/dunk-low.jpg", theme: { a: "#a1887f", b: "#4e342e", page: "#cbb3a3" } },
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
