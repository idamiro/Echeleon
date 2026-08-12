/* Kinetic Clarity — motion + interaction */

(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document.documentElement;
  const body = document.body;
  const loader = document.getElementById("loader");
  const progress = document.querySelector("#progress span");
  const menuBtn = document.getElementById("menuBtn");
  const overlay = document.getElementById("overlayNav");
  const year = document.getElementById("year");
  const track = document.getElementById("movementTrack");
  const movementSection = document.getElementById("movement");

  if (year) year.textContent = String(new Date().getFullYear());

  /* —— Loader —— */
  body.classList.add("is-loading");
  const finishLoad = () => {
    loader?.classList.add("is-done");
    body.classList.remove("is-loading");
    body.classList.add("is-ready");
    loader?.setAttribute("aria-hidden", "true");
  };

  // Stagger hero copy after loader
  const heroReveals = [...document.querySelectorAll(".hero .reveal")];
  heroReveals.forEach((el, i) => {
    el.style.transitionDelay = reduced ? "0ms" : `${180 + i * 110}ms`;
  });

  if (reduced) {
    finishLoad();
    heroReveals.forEach((el) => el.classList.add("is-in"));
  } else {
    window.setTimeout(() => {
      finishLoad();
      heroReveals.forEach((el) => el.classList.add("is-in"));
    }, 1500);
  }

  /* —— Menu —— */
  const setNav = (open) => {
    body.classList.toggle("nav-open", open);
    menuBtn?.setAttribute("aria-expanded", String(open));
    if (!overlay) return;
    overlay.hidden = false;
    overlay.classList.toggle("is-open", open);
    if (!open) {
      window.setTimeout(() => {
        if (!body.classList.contains("nav-open")) overlay.hidden = true;
      }, 400);
    }
  };

  menuBtn?.addEventListener("click", () => {
    setNav(!body.classList.contains("nav-open"));
  });

  overlay?.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", () => setNav(false));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setNav(false);
  });

  /* —— Scroll progress —— */
  const onScrollProgress = () => {
    if (!progress) return;
    const max = doc.scrollHeight - window.innerHeight;
    const p = max > 0 ? (window.scrollY / max) * 100 : 0;
    progress.style.width = `${p}%`;
  };

  /* —— Reveal on view —— */
  const reveals = [...document.querySelectorAll(".reveal")].filter(
    (el) => !el.closest(".hero")
  );
  if (reduced) {
    reveals.forEach((el) => el.classList.add("is-in"));
  } else if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }

  /* —— Hero parallax —— */
  const heroImg = document.querySelector(".hero-img");
  const heroParallax = () => {
    if (reduced || !heroImg) return;
    const y = Math.min(window.scrollY, window.innerHeight);
    heroImg.style.transform = `scale(${1 + y * 0.00015}) translate3d(0, ${y * 0.18}px, 0)`;
  };

  /* —— Horizontal movement track driven by vertical scroll —— */
  let moveStart = 0;
  let moveDistance = 0;

  const measureMovement = () => {
    if (!track || !movementSection) return;
    moveDistance = Math.max(0, track.scrollWidth - window.innerWidth + 48);
    // Give the section extra scroll room via padding-bottom spacer feel
    movementSection.style.minHeight = reduced
      ? "auto"
      : `${window.innerHeight + moveDistance * 0.65}px`;
  };

  const updateMovement = () => {
    if (reduced || !track || !movementSection || moveDistance <= 0) {
      if (track) track.style.transform = "";
      return;
    }
    const rect = movementSection.getBoundingClientRect();
    const total = movementSection.offsetHeight - window.innerHeight;
    if (total <= 0) return;
    const passed = Math.min(Math.max(-rect.top, 0), total);
    const t = passed / total;
    track.style.transform = `translate3d(${-moveDistance * t}px, 0, 0)`;
  };

  /* —— Magnetic buttons —— */
  const magnets = [...document.querySelectorAll(".magnetic")];
  magnets.forEach((btn) => {
    if (reduced || window.matchMedia("(hover: none)").matches) return;
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${x * 0.22}px, ${y * 0.28}px)`;
    });
    btn.addEventListener("pointerleave", () => {
      btn.style.transform = "";
    });
  });

  /* —— Smooth-ish scroll for internal links (native + close menu) —— */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      setNav(false);
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    });
  });

  /* —— RAF scroll loop —— */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      onScrollProgress();
      heroParallax();
      updateMovement();
      ticking = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    measureMovement();
    updateMovement();
    onScrollProgress();
  });

  measureMovement();
  onScroll();
})();
