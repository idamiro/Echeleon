/* Kinetic Surface — unofficial PlayStation homepage study.
   Hardware carousel, game switching and PS Plus billing toggle. */
(function () {
  'use strict';

  /* ---------------- hardware carousel ---------------- */
  var products = [
    {
      title: 'Play Has<br>No Limits<i>.</i>',
      sub: 'Marvel at incredible graphics and experience new PS5 features.',
      price: '499.99',
      cta: 'Buy Now',
      pad: true
    },
    {
      title: 'Answer<br>In Your Hands<i>.</i>',
      sub: 'Haptic feedback and adaptive triggers put the state of the game into your grip.',
      price: '74.99',
      cta: 'Add to cart',
      pad: 'solo'
    },
    {
      title: 'Start With<br>A World<i>.</i>',
      sub: 'The PS5 console bundled with Aster Fall, a survey mission across a mapped red planet.',
      price: '559.99',
      cta: 'Buy bundle',
      pad: 'bundle'
    }
  ];

  var index = 0;
  var heroTitle = document.getElementById('heroTitle');
  var heroSub = document.getElementById('heroSub');
  var heroPrice = document.getElementById('heroPrice');
  var buyLabel = document.getElementById('buyLabel');
  var heroStage = document.getElementById('heroStage');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');

  function paint() {
    var p = products[index];
    heroTitle.innerHTML = p.title;
    heroSub.textContent = p.sub;
    heroPrice.textContent = p.price;
    buyLabel.textContent = p.cta;
    heroStage.classList.toggle('is-solo', p.pad === 'solo');
    heroStage.classList.toggle('is-bundle', p.pad === 'bundle');
  }

  function step(delta) {
    index = (index + delta + products.length) % products.length;
    paint();
  }

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', function () { step(-1); });
    nextBtn.addEventListener('click', function () { step(1); });
  }

  /* ---------------- games ---------------- */
  var games = {
    asterfall: {
      title: 'Aster Fall',
      genre: 'Sci-fi exploration',
      copy: 'A survey crew wakes up alone on a red world that has already been mapped once. Every ridge has a name nobody remembers giving it.',
      chip: 'PS5 · Single player'
    },
    ironbloom: {
      title: 'Ironbloom',
      genre: 'Action RPG',
      copy: 'A winter kingdom runs on a sword that has to be fed. You carry it north, and the forest keeps score of what it costs.',
      chip: 'PS5 · Single player'
    },
    coilworks: {
      title: 'Coilworks',
      genre: 'Platformer',
      copy: 'A workshop robot loses its inventor and rebuilds the machine from memory, one brass gear and one bad idea at a time.',
      chip: 'PS5 · 1-2 players'
    },
    hollowsun: {
      title: 'Hollow Sun',
      genre: 'Open world',
      copy: 'The desert buried a city and kept the doors. A wanderer walks in during a sandstorm because the storm is the only cover there is.',
      chip: 'PS5 · Single player'
    },
    neondrift: {
      title: 'Neon Drift',
      genre: 'Racing',
      copy: 'Street racing in permanent rain. Grip is a rumour, the city is the track, and every corner is lit by somebody else’s advertising.',
      chip: 'PS5 · Up to 12 online'
    },
    deepline: {
      title: 'Deepline',
      genre: 'Underwater adventure',
      copy: 'A solo diver follows a bioluminescent line down past the last depth her suit was rated for. Something down there is keeping the light on.',
      chip: 'PS5 · Single player'
    }
  };

  var gameArt = document.getElementById('gameArt');
  var gameTitle = document.getElementById('gameTitle');
  var gameGenre = document.getElementById('gameGenre');
  var gameCopy = document.getElementById('gameCopy');
  var gameChip = document.getElementById('gameChip');
  var rows = Array.prototype.slice.call(document.querySelectorAll('.game-row'));
  var tiles = Array.prototype.slice.call(document.querySelectorAll('.tile'));

  function selectGame(key) {
    var g = games[key];
    if (!g || !gameArt) return;

    gameArt.style.opacity = '0';
    window.setTimeout(function () {
      gameArt.src = 'assets/wide-' + key + '.webp';
      gameArt.alt = g.title + ' key art.';
      gameArt.style.opacity = '1';
    }, 160);

    gameTitle.textContent = g.title;
    gameGenre.textContent = g.genre;
    gameCopy.textContent = g.copy;
    gameChip.textContent = g.chip;

    rows.forEach(function (r) {
      r.classList.toggle('is-active', r.getAttribute('data-game') === key);
    });
    tiles.forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-game') === key);
    });
  }

  if (gameArt) {
    gameArt.style.transition = 'opacity 220ms ease';
  }

  rows.concat(tiles).forEach(function (el) {
    el.addEventListener('click', function () {
      var key = el.getAttribute('data-game');
      selectGame(key);
      if (el.classList.contains('tile')) {
        var games_section = document.getElementById('games');
        if (games_section) games_section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ---------------- PS Plus billing toggle ---------------- */
  var toggleBtns = Array.prototype.slice.call(document.querySelectorAll('.toggle-btn'));
  var amounts = Array.prototype.slice.call(document.querySelectorAll('.plan-price b'));
  var termLabels = Array.prototype.slice.call(document.querySelectorAll('[data-term-label]'));

  toggleBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var term = btn.getAttribute('data-term');
      toggleBtns.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      amounts.forEach(function (b) {
        b.textContent = b.getAttribute('data-' + term);
      });
      termLabels.forEach(function (l) {
        l.textContent = term === 'yearly' ? '/12 months' : '/month';
      });
    });
  });

  /* ---------------- nav highlight on scroll ---------------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.mainnav a'));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (s) { observer.observe(s); });
  }
})();
