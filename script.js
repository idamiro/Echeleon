const header = document.querySelector('.site-header');
const headerTrigger = document.querySelector('[data-header-trigger]');
const menuButton = document.querySelector('.menu-trigger');
const mobileNav = document.querySelector('.mobile-nav');

if (headerTrigger) {
  new IntersectionObserver(([entry]) => header.classList.toggle('site-header--fixed', !entry.isIntersecting)).observe(headerTrigger);
}

function setMenu(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  mobileNav.setAttribute('aria-hidden', String(!open));
  mobileNav.classList.toggle('mobile-nav--open', open);
  menuButton.querySelector('.menu-icon').classList.toggle('menu-icon--open', open);
  menuButton.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu';
  document.body.classList.toggle('nav-open', open);
}

menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
mobileNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => { if (event.key === 'Escape') { setMenu(false); menuButton?.focus(); } });

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
  new IntersectionObserver(entries => {
    entries.filter(entry => entry.isIntersecting).forEach(entry => {
      stages.forEach(stage => stage.classList.toggle('process-stage--current', stage === entry.target));
    });
  }, { rootMargin: '-35% 0px -35% 0px' }).observe(stages[0]);
  stages.slice(1).forEach(stage => new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) stages.forEach(item => item.classList.toggle('process-stage--current', item === stage));
  }, { rootMargin: '-35% 0px -35% 0px' }).observe(stage));
}

document.getElementById('year').textContent = new Date().getFullYear();
