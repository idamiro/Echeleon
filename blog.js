(() => {
  const tocRoot = document.querySelector('[data-article-toc]');
  const body = document.querySelector('.article-body');
  if (tocRoot && body) {
    const headings = [...body.querySelectorAll('h2[id], h3[id]')].filter((el) => {
      const skip = el.closest('.article-faq, .article-takeaways');
      return !skip && el.id;
    });
    const usable = headings.filter((el) => el.tagName === 'H2' || el.tagName === 'H3');
    if (usable.length >= 4) {
      const list = document.createElement('ol');
      list.className = 'article-toc-list';
      usable.forEach((heading) => {
        const item = document.createElement('li');
        item.className = heading.tagName === 'H3' ? 'is-sub' : '';
        const link = document.createElement('a');
        link.href = `#${heading.id}`;
        link.textContent = heading.textContent.trim();
        item.appendChild(link);
        list.appendChild(item);
      });
      tocRoot.appendChild(list);
      tocRoot.hidden = false;
    }
  }

  const filterNav = document.querySelector('[data-blog-filter]');
  const cards = [...document.querySelectorAll('[data-blog-category]')];
  if (!filterNav || !cards.length) return;

  const buttons = [...filterNav.querySelectorAll('[data-filter]')];
  const empty = document.querySelector('[data-blog-empty]');

  const applyFilter = (value) => {
    let visible = 0;
    cards.forEach((card) => {
      const match = value === 'all' || card.dataset.blogCategory === value;
      card.hidden = !match;
      if (match) visible += 1;
    });
    buttons.forEach((button) => {
      const active = button.dataset.filter === value;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('is-active', active);
    });
    if (empty) empty.hidden = visible > 0;
    const url = new URL(window.location.href);
    if (value === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', value);
    window.history.replaceState({}, '', url);
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => applyFilter(button.dataset.filter));
  });

  const initial = new URLSearchParams(window.location.search).get('category') || 'all';
  const allowed = buttons.some((button) => button.dataset.filter === initial) ? initial : 'all';
  applyFilter(allowed);
})();
