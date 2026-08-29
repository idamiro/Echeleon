(() => {
  const storageKey = 'vulcet-analytics-consent';
  const relativeRoot = document.documentElement.dataset.root || './';
  const savedChoice = localStorage.getItem(storageKey);

  const updateConsent = (choice) => {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: choice,
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
  };

  if (savedChoice === 'granted' || savedChoice === 'denied') {
    updateConsent(savedChoice);
  }

  const panel = document.createElement('aside');
  panel.className = 'consent-panel';
  panel.setAttribute('aria-labelledby', 'consent-title');
  panel.hidden = Boolean(savedChoice);
  const isAz = document.documentElement.lang === 'az';
  const copy = isAz
    ? {
        eyebrow: 'Məxfilik seçimi',
        title: 'Veb-saytı təkmilləşdirməyə kömək edək?',
        body: `Vulcet Google Analytics-dən yalnız icazənizlə istifadə edir. Saytın zəruri funksiyaları hər halda işləyir. <a href="${relativeRoot}privacy/">Məxfilik bildirişini</a> oxuyun.`,
        decline: 'Analitikanı rədd et',
        allow: 'Analitikaya icazə ver'
      }
    : {
        eyebrow: 'Privacy choice',
        title: 'Help improve the website?',
        body: `Vulcet uses Google Analytics only with your permission. Necessary site functions remain available either way. Read the <a href="${relativeRoot}privacy/">privacy notice</a>.`,
        decline: 'Decline analytics',
        allow: 'Allow analytics'
      };

  panel.innerHTML = `
    <span>${copy.eyebrow}</span>
    <h2 id="consent-title">${copy.title}</h2>
    <p>${copy.body}</p>
    <div class="consent-actions">
      <button type="button" data-consent="denied">${copy.decline}</button>
      <button type="button" data-consent="granted">${copy.allow}</button>
    </div>
  `;

  document.body.appendChild(panel);

  const setChoice = (choice) => {
    localStorage.setItem(storageKey, choice);
    updateConsent(choice);
    panel.hidden = true;
  };

  panel.querySelectorAll('[data-consent]').forEach((button) => {
    button.addEventListener('click', () => setChoice(button.dataset.consent));
  });

  document.querySelectorAll('[data-cookie-settings]').forEach((button) => {
    button.addEventListener('click', () => {
      panel.hidden = false;
      panel.querySelector('button')?.focus();
    });
  });
})();
