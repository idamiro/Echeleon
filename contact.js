(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const steps = [...form.querySelectorAll('[data-step]')];
  const progress = [...document.querySelectorAll('[data-progress]')];
  const status = form.querySelector('.contact-form-status');
  let activeStep = 1;

  const showStep = (step) => {
    activeStep = step;
    steps.forEach((fieldset) => {
      const isCurrent = Number(fieldset.dataset.step) === step;
      fieldset.hidden = !isCurrent;
      if (isCurrent) {
        const firstControl = fieldset.querySelector('input, select, textarea');
        firstControl?.focus({ preventScroll: true });
      }
    });
    progress.forEach((item) => {
      const isCurrent = Number(item.dataset.progress) === step;
      item.classList.toggle('is-active', isCurrent);
      if (isCurrent) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    status.textContent = '';
  };

  const validateStep = (step) => {
    const fieldset = steps.find((item) => Number(item.dataset.step) === step);
    const controls = [...fieldset.querySelectorAll('input, select, textarea')];
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    return true;
  };

  form.querySelector('[data-next]')?.addEventListener('click', () => {
    if (validateStep(1)) showStep(2);
  });

  form.querySelector('[data-back]')?.addEventListener('click', () => showStep(1));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateStep(activeStep)) return;

    const data = new FormData(form);
    const subject = `Project enquiry — ${data.get('company') || data.get('name')}`;
    const body = [
      `Name: ${data.get('name')}`,
      `Work email: ${data.get('email')}`,
      `Company / organisation: ${data.get('company') || 'Not provided'}`,
      `What is needed: ${data.get('need')}`,
      `Estimated budget: ${data.get('budget')}`,
      `Current website: ${data.get('website') || 'Not provided'}`,
      `Preferred start: ${data.get('start')}`,
      '',
      'Project details:',
      data.get('details'),
      '',
      `How they found Vulcet: ${data.get('source') || 'Not provided'}`
    ].join('\n');

    status.textContent = 'Your project brief is ready. Continue in your email application to send it.';
    window.location.href = `mailto:hello@vulcet.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
})();
