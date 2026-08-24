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
  panel.innerHTML = `
    <span>Privacy choice</span>
    <h2 id="consent-title">Help improve the website?</h2>
    <p>Vulcet uses Google Analytics only with your permission. Necessary site functions remain available either way. Read the <a href="${relativeRoot}privacy/">privacy notice</a>.</p>
    <div class="consent-actions">
      <button type="button" data-consent="denied">Decline analytics</button>
      <button type="button" data-consent="granted">Allow analytics</button>
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
