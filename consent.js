(() => {
  const storageKey = 'vulcet-analytics-consent';
  const relativeRoot = document.documentElement.dataset.root || './';
  const i18n = window.__VULCET_I18N__?.consent || {};
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

  const eyebrow = i18n.eyebrow || 'Privacy choice';
  const title = i18n.title || 'Help improve the website?';
  const bodyTemplate = i18n.body || 'Vulcet uses Google Analytics only with your permission. Necessary site functions remain available either way. Read the <a href="__PRIVACY__">privacy notice</a>.';
  const decline = i18n.decline || 'Decline analytics';
  const allow = i18n.allow || 'Allow analytics';
  const body = bodyTemplate.replace('__PRIVACY__', `${relativeRoot}privacy/`);

  const panel = document.createElement('aside');
  panel.className = 'consent-panel';
  panel.setAttribute('aria-labelledby', 'consent-title');
  panel.hidden = Boolean(savedChoice);
  panel.innerHTML = `
    <span>${eyebrow}</span>
    <h2 id="consent-title">${title}</h2>
    <p>${body}</p>
    <div class="consent-actions">
      <button type="button" data-consent="denied">${decline}</button>
      <button type="button" data-consent="granted">${allow}</button>
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
