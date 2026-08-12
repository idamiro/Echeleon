/* Spotify Glass Redesign — interactions */

const TRACKS = [
  {
    id: 0,
    title: "Pitfalls",
    artist: "Sistek",
    cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&h=800&fit=crop",
    duration: 199,
    color: "120, 90, 200",
    lyrics: [
      "Soft lights on the windowpane",
      "We dance around the pitfalls",
      "Hold the night a little longer",
      "Don’t let the silence call",
    ],
  },
  {
    id: 1,
    title: "París",
    artist: "Álvaro de Luna",
    cover: "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=800&h=800&fit=crop",
    duration: 212,
    color: "70, 140, 210",
    lyrics: [
      "Calles de París, rain on glass",
      "Your name in every café",
      "We leave footprints in the glow",
      "And never ask the time",
    ],
  },
  {
    id: 2,
    title: "Needed",
    artist: "Rihanna",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=800&fit=crop",
    duration: 236,
    color: "210, 90, 140",
    lyrics: [
      "Tell me what you needed",
      "I was always in the room",
      "Low lights, open windows",
      "Heartbeat like a boom",
    ],
  },
  {
    id: 3,
    title: "Hawái (ft. The Weeknd)",
    artist: "Maluma",
    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=800&fit=crop",
    duration: 199,
    color: "40, 170, 190",
    lyrics: [
      "Beach lights, midnight heat",
      "Hawái on my mind",
      "Two voices in the chorus",
      "Leaving summer behind",
    ],
  },
  {
    id: 4,
    title: "Cruel Summer",
    artist: "Taylor Swift",
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=800&fit=crop",
    duration: 178,
    color: "230, 120, 160",
    lyrics: [
      "Fever dream high in the quiet",
      "It’s a cruel summer",
      "Devils roll the dice",
      "Angels roll their eyes",
    ],
  },
  {
    id: 5,
    title: "Blank Space",
    artist: "Taylor Swift",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=800&fit=crop",
    duration: 231,
    color: "180, 110, 200",
    lyrics: [
      "Nice to meet you, where you been?",
      "I could show you incredible things",
      "Magic, madness, heaven, sin",
      "Saw you there and I thought",
    ],
  },
];

const ARTISTS = {
  taylor: {
    name: "Taylor Swift",
    cover: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=700&h=700&fit=crop",
    tracks: [4, 5, 2, 0],
  },
  pablo: {
    name: "Pablo Alborán",
    cover: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&h=700&fit=crop",
    tracks: [1, 0, 2, 3],
  },
};

const MOODS = [
  {
    title: "Golden Hour",
    desc: "Akşamüstü yumuşak vibes · 42 şarkı",
    image:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&h=600&fit=crop",
  },
  {
    title: "Midnight Focus",
    desc: "Derin odak · lo-fi & ambient · 38 şarkı",
    image:
      "https://images.unsplash.com/photo-1516280440614-6697288d5d38?w=900&h=600&fit=crop",
  },
  {
    title: "Sunny Drive",
    desc: "Açık yol enerjisi · 51 şarkı",
    image:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=900&h=600&fit=crop",
  },
];

const state = {
  screen: "home",
  index: 0,
  playing: true,
  progress: 62,
  liked: new Set(),
  shuffle: false,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function currentTrack() {
  return TRACKS[state.index];
}

function setAmbient(color) {
  document.documentElement.style.setProperty("--glow", color);
  const glow = $("#ambientGlow");
  if (glow) {
    glow.style.background = `radial-gradient(50% 40% at 70% 40%, rgba(${color}, 0.28), transparent 70%)`;
  }
}

function updatePlayIcons() {
  $$(".icon-play").forEach((el) => {
    el.hidden = state.playing;
  });
  $$(".icon-pause").forEach((el) => {
    el.hidden = !state.playing;
  });
}

function renderPlayer() {
  const t = currentTrack();
  $("#miniCover").src = t.cover;
  $("#miniTitle").textContent = t.title;
  $("#miniArtist").textContent = t.artist;

  $("#nowCover").src = t.cover;
  $("#nowTitle").textContent = t.title;
  $("#nowArtist").textContent = t.artist;

  const total = t.duration;
  const current = Math.round((state.progress / 100) * total);
  $("#timeCurrent").textContent = formatTime(current);
  $("#timeTotal").textContent = formatTime(total);
  $("#progress").value = String(state.progress);
  $("#progress").style.background = `linear-gradient(90deg, var(--accent) ${state.progress}%, var(--surface-ink) ${state.progress}%)`;

  $("#lyricsLines").innerHTML = t.lyrics
    .map((line, i) => `<p class="${i === 1 ? "active" : ""}">${line}</p>`)
    .join("");

  setAmbient(t.color);
  updatePlayIcons();
}

function renderRecent() {
  const list = $("#recentList");
  list.innerHTML = TRACKS.slice(0, 5)
    .map(
      (t) => `
      <li>
        <button type="button" class="track-row" data-play="${t.id}">
          <img src="${t.cover}" alt="" />
          <div class="track-copy">
            <strong>${t.title}</strong>
            <span>${t.artist}</span>
          </div>
          <span class="track-menu" aria-hidden="true">⋮</span>
        </button>
      </li>`
    )
    .join("");
}

function renderArtist(key = "taylor") {
  const artist = ARTISTS[key] || ARTISTS.taylor;
  $("#artistName").textContent = artist.name;
  $("#artistCover").src = artist.cover;
  $("#artistTracks").innerHTML = artist.tracks
    .map((id) => {
      const t = TRACKS[id];
      return `
        <li>
          <button type="button" class="track-row" data-play="${t.id}">
            <img src="${t.cover}" alt="" />
            <div class="track-copy">
              <strong>${t.title}</strong>
              <span>${t.artist}</span>
            </div>
            <span class="track-menu" aria-hidden="true">⋮</span>
            <span class="row-play" aria-hidden="true">▶</span>
          </button>
        </li>`;
    })
    .join("");

  // tap to reveal play on touch devices
  $$("#artistTracks .track-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (window.matchMedia("(hover: none)").matches) {
        if (!row.classList.contains("show-play")) {
          e.preventDefault();
          $$("#artistTracks .track-row").forEach((r) => r.classList.remove("show-play"));
          row.classList.add("show-play");
          return;
        }
      }
    });
  });
}

function navigate(screen) {
  state.screen = screen;
  $$(".screen").forEach((el) => {
    el.classList.toggle("active", el.dataset.screen === screen);
  });
  $$(".tab").forEach((tab) => {
    const on = tab.dataset.nav === screen || (screen === "artist" && tab.dataset.nav === "discover");
    tab.classList.toggle("active", on);
    if (on) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  $("#miniPlayer").classList.toggle("hidden", screen === "now");
}

function playTrack(id) {
  state.index = Number(id);
  state.playing = true;
  state.progress = Math.min(state.progress, 90) || 8;
  renderPlayer();
  showToast(`▶ ${currentTrack().title}`, false);
}

function nextTrack(dir = 1) {
  const len = TRACKS.length;
  state.index = (state.index + dir + len) % len;
  state.progress = 8;
  state.playing = true;
  renderPlayer();
}

function showToast(text, like = false) {
  const el = $("#gestureToast");
  el.textContent = text;
  el.hidden = false;
  el.classList.toggle("like", like);
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.hidden = true;
  }, 1400);
}

function showMiniSwipe(text, skip = false) {
  const toast = $("#swipeToast");
  toast.textContent = text;
  toast.hidden = false;
  toast.classList.toggle("skip", skip);
  clearTimeout(showMiniSwipe._t);
  showMiniSwipe._t = setTimeout(() => {
    toast.hidden = true;
  }, 700);
}

/* Theme */
function initTheme() {
  const saved = localStorage.getItem("spotify-glass-theme");
  const theme = saved || "light";
  document.documentElement.setAttribute("data-theme", theme);
  $("#themeLabel").textContent = theme === "light" ? "Dark" : "Light";

  $("#themeToggle").addEventListener("click", () => {
    const next =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "dark"
        : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("spotify-glass-theme", next);
    $("#themeLabel").textContent = next === "light" ? "Dark" : "Light";
  });
}

/* Mood of the day rotates by hour */
function initMood() {
  const mood = MOODS[new Date().getHours() % MOODS.length];
  $("#moodTitle").textContent = mood.title;
  $("#moodDesc").textContent = mood.desc;
  $(".mood-day-bg").style.background = `linear-gradient(120deg, rgba(29,185,84,0.35), transparent 50%), url('${mood.image}') center/cover`;
}

/* Navigation + play bindings */
function initNav() {
  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      const screen = nav.dataset.nav;
      if (screen === "artist") {
        renderArtist(nav.dataset.artist || "taylor");
      }
      navigate(screen);
      return;
    }

    const play = e.target.closest("[data-play]");
    if (play) {
      playTrack(play.dataset.play);
      if (e.target.closest(".pick-card, .quick-card, .feature-cover, .accent-btn, .row-play, #shufflePlay")) {
        // keep current screen unless from artist shuffle
      }
    }
  });

  $("#miniPlayer").addEventListener("click", (e) => {
    if (e.target.closest("#miniPlay")) return;
    navigate("now");
  });
}

function initTransport() {
  $("#playBtn").addEventListener("click", () => {
    state.playing = !state.playing;
    updatePlayIcons();
  });
  $("#miniPlay").addEventListener("click", (e) => {
    e.stopPropagation();
    state.playing = !state.playing;
    updatePlayIcons();
  });
  $("#prevBtn").addEventListener("click", () => nextTrack(-1));
  $("#nextBtn").addEventListener("click", () => nextTrack(1));
  $("#shufflePlay").addEventListener("click", () => {
    playTrack(TRACKS[Math.floor(Math.random() * TRACKS.length)].id);
    navigate("now");
  });
  $("#progress").addEventListener("input", (e) => {
    state.progress = Number(e.target.value);
    renderPlayer();
  });
  $("#likeBtn").addEventListener("click", () => {
    const id = currentTrack().id;
    if (state.liked.has(id)) state.liked.delete(id);
    else state.liked.add(id);
    $("#likeBtn").setAttribute("aria-pressed", String(state.liked.has(id)));
    showToast(state.liked.has(id) ? "Beğenildi ♥" : "Beğeni kaldırıldı", true);
  });
  $("#shuffleBtn").addEventListener("click", () => {
    state.shuffle = !state.shuffle;
    $("#shuffleBtn").setAttribute("aria-pressed", String(state.shuffle));
  });
  $("#lyricsBtn").addEventListener("click", () => openLyrics(true));
  $("#lyricsClose").addEventListener("click", () => openLyrics(false));
}

function openLyrics(open) {
  const overlay = $("#lyricsOverlay");
  overlay.hidden = !open;
  $("#nowCoverWrap").classList.toggle("pressed", open);
  if (open) $("#longpressHint").classList.add("hide");
}

/* Long-press cover → lyrics */
function initLongPress() {
  const wrap = $("#nowCoverWrap");
  let timer = null;
  let moved = false;

  const start = (e) => {
    if (e.target.closest(".lyrics-overlay")) return;
    moved = false;
    wrap.classList.add("pressed");
    timer = setTimeout(() => {
      openLyrics(true);
      timer = null;
    }, 520);
  };
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if ($("#lyricsOverlay").hidden) wrap.classList.remove("pressed");
  };

  wrap.addEventListener("pointerdown", start);
  wrap.addEventListener("pointerup", cancel);
  wrap.addEventListener("pointerleave", cancel);
  wrap.addEventListener("pointercancel", cancel);
  wrap.addEventListener("pointermove", () => {
    moved = true;
  });
}

/* Swipe mini player to change song */
function initMiniSwipe() {
  const el = $("#miniPlayer");
  let startX = 0;
  let dx = 0;
  let dragging = false;

  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#miniPlay")) return;
    dragging = true;
    startX = e.clientX;
    dx = 0;
    el.setPointerCapture?.(e.pointerId);
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    el.style.transform = `translateX(${dx * 0.35}px)`;
  });

  const end = () => {
    if (!dragging) return;
    dragging = false;
    el.style.transform = "";
    if (Math.abs(dx) > 70) {
      if (dx < 0) {
        nextTrack(1);
        showMiniSwipe("Sonraki →", true);
      } else {
        nextTrack(-1);
        showMiniSwipe("← Önceki");
      }
    }
  };

  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

/* Track row gestures: left = like, right = skip */
function initTrackGestures() {
  const app = $("#app");
  let startX = 0;
  let startY = 0;
  let row = null;
  let dx = 0;
  let locked = null;

  app.addEventListener("pointerdown", (e) => {
    row = e.target.closest(".track-row");
    if (!row) return;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    locked = null;
  });

  app.addEventListener("pointermove", (e) => {
    if (!row) return;
    const x = e.clientX - startX;
    const y = e.clientY - startY;
    if (locked === null && (Math.abs(x) > 10 || Math.abs(y) > 10)) {
      locked = Math.abs(x) > Math.abs(y) ? "x" : "y";
    }
    if (locked !== "x") return;
    dx = x;
    row.style.transform = `translateX(${dx}px)`;
    row.style.background =
      dx < 0
        ? `linear-gradient(90deg, transparent, rgba(29,185,84,0.18))`
        : `linear-gradient(90deg, rgba(40,48,64,0.12), transparent)`;
  });

  const end = () => {
    if (!row) return;
    if (locked === "x" && Math.abs(dx) > 90) {
      const id = Number(row.dataset.play);
      if (dx < 0) {
        state.liked.add(id);
        showToast("Beğenildi ♥", true);
      } else {
        showToast("Atlandı →");
        if (id === state.index) nextTrack(1);
      }
    }
    row.style.transform = "";
    row.style.background = "";
    row = null;
    locked = null;
    dx = 0;
  };

  app.addEventListener("pointerup", end);
  app.addEventListener("pointercancel", end);
}

/* Fake progress while playing */
function initTicker() {
  setInterval(() => {
    if (!state.playing) return;
    state.progress = Math.min(100, state.progress + 0.15);
    if (state.progress >= 100) {
      nextTrack(1);
    } else {
      const t = currentTrack();
      const current = Math.round((state.progress / 100) * t.duration);
      $("#timeCurrent").textContent = formatTime(current);
      $("#progress").value = String(state.progress);
      $("#progress").style.background = `linear-gradient(90deg, var(--accent) ${state.progress}%, var(--surface-ink) ${state.progress}%)`;
    }
  }, 400);
}

function init() {
  initTheme();
  initMood();
  renderRecent();
  renderArtist("taylor");
  renderPlayer();
  initNav();
  initTransport();
  initLongPress();
  initMiniSwipe();
  initTrackGestures();
  initTicker();
  navigate("home");

  // hide longpress hint after first visit feel
  setTimeout(() => $("#longpressHint")?.classList.add("hide"), 5000);
}

document.addEventListener("DOMContentLoaded", init);
