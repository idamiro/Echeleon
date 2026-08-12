/* Interactive product stage — carousel → detail → sizes */

(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const PRODUCTS = [
    {
      id: "pulse",
      name: "Vaporstride Pulse",
      short: "Night race energy with PulseFoam Core.",
      line: "Race line",
      ghost: "PULSE",
      price: "$240.00",
      image: "assets/shoe-pulse-side.jpg",
      detail: "assets/shoe-pulse-angle.jpg",
      angles: [
        "assets/shoe-pulse-side.jpg",
        "assets/shoe-pulse-angle.jpg",
        "assets/shoe-pulse-heel.jpg",
        "assets/shoe-pulse-top.jpg",
      ],
      colors: [
        { id: "pulse", hex: "#d94f8a", image: "assets/shoe-pulse-angle.jpg" },
        { id: "tide", hex: "#2ec4b6", image: "assets/shoe-tide-side.jpg" },
        { id: "dune", hex: "#c4a35a", image: "assets/shoe-dune-side.jpg" },
      ],
    },
    {
      id: "tide",
      name: "Vaporstride Tide",
      short: "Coastal pace. LoomFlex shell that breathes.",
      line: "City line",
      ghost: "TIDE",
      price: "$220.00",
      image: "assets/shoe-tide-side.jpg",
      detail: "assets/shoe-tide-side.jpg",
      angles: [
        "assets/shoe-tide-side.jpg",
        "assets/shoe-pulse-angle.jpg",
        "assets/shoe-pulse-heel.jpg",
        "assets/shoe-pulse-top.jpg",
      ],
      colors: [
        { id: "tide", hex: "#2ec4b6", image: "assets/shoe-tide-side.jpg" },
        { id: "pulse", hex: "#d94f8a", image: "assets/shoe-pulse-angle.jpg" },
        { id: "dune", hex: "#c4a35a", image: "assets/shoe-dune-side.jpg" },
      ],
    },
    {
      id: "dune",
      name: "Vaporstride Dune",
      short: "Warm-weather stride. HeatSync Weave.",
      line: "Forge line",
      ghost: "DUNE",
      price: "$230.00",
      image: "assets/shoe-dune-side.jpg",
      detail: "assets/shoe-dune-side.jpg",
      angles: [
        "assets/shoe-dune-side.jpg",
        "assets/shoe-pulse-angle.jpg",
        "assets/shoe-pulse-heel.jpg",
        "assets/shoe-pulse-top.jpg",
      ],
      colors: [
        { id: "dune", hex: "#c4a35a", image: "assets/shoe-dune-side.jpg" },
        { id: "pulse", hex: "#d94f8a", image: "assets/shoe-pulse-angle.jpg" },
        { id: "tide", hex: "#2ec4b6", image: "assets/shoe-tide-side.jpg" },
      ],
    },
  ];

  const DETAIL_SIZES = ["5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9"];
  const FULL_SIZES = [
    "UK 3.5","UK 4","UK 4.5","UK 5","UK 5.5","UK 6","UK 6.5","UK 7",
    "UK 7.5","UK 8","UK 8.5","UK 9","UK 9.5","UK 10","UK 10.5","UK 11",
  ];

  const state = {
    view: "carousel",
    productIndex: 0,
    colorIndex: 0,
    size: "7",
    fullSize: "UK 7",
  };

  const els = {
    stage: document.getElementById("stage"),
    tiltRoot: document.getElementById("tiltRoot"),
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

  function product() {
    return PRODUCTS[state.productIndex];
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
    els.carousel.innerHTML = PRODUCTS.map(
      (p, i) => `
      <button type="button" class="product-card${i === 1 ? " is-hot" : ""}" data-open="${i}" aria-label="Open ${p.name}">
        <img src="${p.image}" alt="" width="480" height="320">
        <h2>${p.name}</h2>
        <p>${p.short}</p>
        <span class="know-more">Know more</span>
      </button>`
    ).join("");

    els.dots.innerHTML = PRODUCTS.map(
      (_, i) => `<button type="button" aria-label="Product ${i + 1}" data-dot="${i}" class="${i === state.productIndex ? "is-active" : ""}"></button>`
    ).join("");
  }

  function renderDetail() {
    const p = product();
    const color = p.colors[state.colorIndex] || p.colors[0];
    els.ghost.textContent = p.ghost;
    els.title.textContent = p.name;
    els.line.textContent = p.line;
    els.price.textContent = p.price;
    els.shoe.src = color.image || p.detail;
    els.shoe.alt = p.name;

    els.sizeRow.innerHTML = DETAIL_SIZES.map(
      (s) =>
        `<button type="button" class="size-chip${s === state.size ? " is-active" : ""}" role="option" aria-selected="${s === state.size}" data-size="${s}">${s}</button>`
    ).join("");

    els.swatches.innerHTML = p.colors
      .map(
        (c, i) =>
          `<button type="button" class="swatch${i === state.colorIndex ? " is-active" : ""}" role="option" aria-label="Color ${c.id}" aria-selected="${i === state.colorIndex}" data-color="${i}" style="background:${c.hex}"></button>`
      )
      .join("");
  }

  function renderSizes() {
    const p = product();
    els.angleGrid.innerHTML = p.angles
      .map((src) => `<img src="${src}" alt="">`)
      .join("");
    els.sizeGrid.innerHTML = FULL_SIZES.map(
      (s) =>
        `<button type="button" class="size-cell${s === state.fullSize ? " is-active" : ""}" data-full="${s}">${s.replace("UK ", "")}</button>`
    ).join("");
  }

  function openProduct(index) {
    state.productIndex = index;
    state.colorIndex = 0;
    renderDetail();
    setView("detail");
    // entrance nudge
    if (!reduced) {
      els.shoe.style.opacity = "0";
      els.shoe.style.transform = "rotate(-18deg) scale(0.92)";
      requestAnimationFrame(() => {
        els.shoe.style.opacity = "1";
        els.shoe.style.transform = "";
      });
    }
  }

  /* events */
  document.getElementById("carousel").addEventListener("click", (e) => {
    const card = e.target.closest("[data-open]");
    if (!card) return;
    openProduct(Number(card.dataset.open));
  });

  document.getElementById("carouselDots").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-dot]");
    if (!btn) return;
    state.productIndex = Number(btn.dataset.dot);
    [...els.dots.children].forEach((d, i) => d.classList.toggle("is-active", i === state.productIndex));
    [...els.carousel.children].forEach((c, i) => c.classList.toggle("is-hot", i === state.productIndex));
  });

  document.getElementById("homeBtn").addEventListener("click", () => {
    setView("carousel");
  });

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
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
      // flash shoe
      if (!reduced) {
        els.shoe.style.transition = "opacity 0.25s ease, transform 0.45s cubic-bezier(0.22,1,0.36,1)";
        els.shoe.style.transform = "rotate(-6deg) scale(1.04)";
        setTimeout(() => { els.shoe.style.transform = ""; }, 280);
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
  document.getElementById("backDetail").addEventListener("click", () => setView("detail"));

  els.views.sizes.addEventListener("click", (e) => {
    const cell = e.target.closest("[data-full]");
    if (!cell) return;
    state.fullSize = cell.dataset.full;
    renderSizes();
  });

  document.getElementById("buyBtn").addEventListener("click", () => {
    const btn = document.getElementById("buyBtn");
    btn.textContent = "Added · Concept only";
    setTimeout(() => { btn.textContent = "Add to bag"; }, 1600);
  });

  /* Parallax tilt on stage */
  if (canHover && !reduced) {
    const root = els.tiltRoot;
    const ghost = els.ghost;
    const shoe = els.shoe;
    let raf = 0;
    let tx = 0;
    let ty = 0;

    document.getElementById("stageCard").addEventListener("pointermove", (e) => {
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

    document.getElementById("stageCard").addEventListener("pointerleave", () => {
      root.style.transform = "";
      ghost.style.transform = "translate(-50%, -50%)";
      shoe.style.translate = "";
    });
  }

  /* boot */
  renderCarousel();
  renderDetail();
  setView("carousel");
})();
