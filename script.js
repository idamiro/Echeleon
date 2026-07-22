const header = document.querySelector('.site-header');
const headerTrigger = document.querySelector('[data-header-trigger]');
const menuButton = document.querySelector('.menu-trigger');
const mobileNav = document.querySelector('.mobile-nav');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

document.documentElement.dataset.motion = reduceMotion ? 'reduced' : 'ready';

if (headerTrigger) {
  new IntersectionObserver(([entry]) => header.classList.toggle('site-header--fixed', !entry.isIntersecting)).observe(headerTrigger);
}

function setMenu(open) {
  if (!menuButton || !mobileNav) return;
  menuButton.setAttribute('aria-expanded', String(open));
  mobileNav.setAttribute('aria-hidden', String(!open));
  mobileNav.classList.toggle('mobile-nav--open', open);
  menuButton.querySelector('.menu-icon').classList.toggle('menu-icon--open', open);
  menuButton.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu';
  document.body.classList.toggle('nav-open', open);
  if (open) requestAnimationFrame(() => mobileNav.querySelector('a')?.focus());
}

menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
mobileNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuButton.focus();
  }
  if (event.key === 'Tab' && menuButton?.getAttribute('aria-expanded') === 'true') {
    const focusable = [menuButton, ...mobileNav.querySelectorAll('a, button')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

document.querySelectorAll('.faq-item button').forEach((button, index) => {
  const answer = button.closest('.faq-item').querySelector('.faq-answer');
  const id = `faq-answer-${index + 1}`;
  answer.id = id;
  button.setAttribute('aria-controls', id);
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    answer.hidden = open;
    button.closest('.faq-item').classList.toggle('faq-item--open', !open);
  });
});

if (!matchMedia('(max-width: 899px), (prefers-reduced-motion: reduce)').matches) {
  const stages = [...document.querySelectorAll('.process-stage')];
  const stageObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => Math.abs(a.boundingClientRect.top - innerHeight / 2) - Math.abs(b.boundingClientRect.top - innerHeight / 2));
    if (visible[0]) stages.forEach(stage => stage.classList.toggle('process-stage--current', stage === visible[0].target));
  }, { rootMargin: '-35% 0px -35% 0px' });
  stages.forEach(stage => stageObserver.observe(stage));
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

const revealGroups = [
  ['.positioning-list li', 'split'],
  ['.work-label, .project-heading, .project-meta', 'editorial'],
  ['.project-canvas, .project-caption, .project-link', 'project'],
  ['.growth-grid > .editorial-label, .growth-grid > h2, .problem-copy', 'dark'],
  ['.diagnostic-row', 'diagnostic'],
  ['.growth-transition, .growth-intro, .scope-grid > div, .growth-price, .growth-actions', 'dark'],
  ['.services-grid > .editorial-label, .services-intro, .service-row, .price-note', 'service'],
  ['.process-grid > .editorial-label, .working-model, .process-stage', 'process'],
  ['.studio-grid > .editorial-label, .portrait-block, .studio-copy > *', 'studio'],
  ['.faq-grid > .editorial-label, .faq-grid > h2, .faq-item', 'faq'],
  ['.final-grid > .editorial-label, .final-grid h2, .final-support, .footer-grid > *', 'final'],
];

const revealItems = [];
revealGroups.forEach(([selector, variant]) => {
  document.querySelectorAll(selector).forEach((item, index) => {
    item.classList.add('motion-reveal');
    item.dataset.reveal = variant;
    item.style.setProperty('--reveal-order', String(index % 5));
    revealItems.push(item);
  });
});

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { rootMargin: '0px 0px -10%', threshold: .08 });
revealItems.forEach(item => reduceMotion ? item.classList.add('is-visible') : revealObserver.observe(item));

function bindPointer(element, xName, yName, amount = 10) {
  element.addEventListener('pointermove', event => {
    const rect = element.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * amount;
    const y = ((event.clientY - rect.top) / rect.height - .5) * amount;
    element.style.setProperty(xName, `${x.toFixed(2)}px`);
    element.style.setProperty(yName, `${y.toFixed(2)}px`);
  });
  element.addEventListener('pointerleave', () => {
    element.style.setProperty(xName, '0px');
    element.style.setProperty(yName, '0px');
  });
}

if (finePointer && !reduceMotion) {
  const hero = document.querySelector('.hero');
  const project = document.querySelector('.project-canvas');
  const portrait = document.querySelector('.portrait-block');
  if (hero) bindPointer(hero, '--hero-x', '--hero-y', 12);
  if (project) bindPointer(project, '--project-x', '--project-y', 16);
  if (portrait) bindPointer(portrait, '--portrait-x', '--portrait-y', 10);
  document.querySelectorAll('.service-row').forEach(row => bindPointer(row, '--row-x', '--row-y', 8));
  document.querySelectorAll('.button').forEach(button => bindPointer(button, '--button-x', '--button-y', 5));
}

let scrollFrame = 0;
function updateScrollMotion() {
  scrollFrame = 0;
  const root = document.documentElement;
  const max = Math.max(1, root.scrollHeight - innerHeight);
  root.style.setProperty('--page-progress', String(Math.min(1, scrollY / max)));

  const project = document.querySelector('.project-canvas');
  if (project) {
    const rect = project.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)));
    project.style.setProperty('--project-lift', `${((progress - .5) * -10).toFixed(2)}px`);
    project.style.setProperty('--project-mobile-lift', `${((progress - .5) * -22).toFixed(2)}px`);
    project.style.setProperty('--project-note-lift', `${((1 - progress) * 12).toFixed(2)}px`);
    project.style.setProperty('--project-overlay', String(.2 + progress * .8));
    project.style.setProperty('--project-note-opacity', String(Math.min(1, .35 + progress * 1.2)));
  }

  const growth = document.querySelector('.growth-section');
  if (growth) {
    const rect = growth.getBoundingClientRect();
    growth.style.setProperty('--growth-progress', String(Math.max(0, Math.min(1, (innerHeight - rect.top) / innerHeight))));
  }

  const processList = document.querySelector('.process-list');
  if (processList) {
    const rect = processList.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (innerHeight * .55 - rect.top) / Math.max(1, rect.height - innerHeight * .35)));
    processList.style.setProperty('--process-progress', `${Math.round(progress * 100)}%`);
  }
}

addEventListener('scroll', () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollMotion);
}, { passive: true });
updateScrollMotion();
