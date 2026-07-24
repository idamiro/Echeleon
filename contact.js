(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const steps = [...form.querySelectorAll('[data-step]')];
  const progress = [...document.querySelectorAll('[data-progress]')];
  const status = form.querySelector('.contact-form-status');
  const projectTypes = [...form.querySelectorAll('input[name="project_type"]')];
  const existingUrlWrap = form.querySelector('.contact-existing-url');
  const existingUrl = form.querySelector('#contact-website');
  const submitButton = form.querySelector('button[type="submit"]');
  const success = document.querySelector('#contact-success');
  const needSelect = form.querySelector('#contact-need');
  let activeStep = 1;

  const requestedService = new URLSearchParams(window.location.search).get('service');
  const serviceLabels = {
    'business-website': 'Business Website',
    'growth-website': 'Growth Website',
    'custom-product': 'Custom Digital Product',
    'website-care': 'Care & Support'
  };
  if (requestedService && serviceLabels[requestedService]) {
    needSelect.value = serviceLabels[requestedService];
  }

  const updateWebsiteField = () => {
    const needsExistingUrl = projectTypes.some((input) => input.checked && input.value === 'Redesign an existing website');
    existingUrlWrap.hidden = !needsExistingUrl;
    existingUrl.required = needsExistingUrl;
    if (!needsExistingUrl) existingUrl.value = '';
  };

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
    if (validateStep(1)) {
      if (typeof window.gtag === 'function') window.gtag('event', 'form_step_complete', { form_name: 'project_brief', step: 1 });
      showStep(2);
    }
  });

  form.querySelector('[data-back]')?.addEventListener('click', () => showStep(1));
  projectTypes.forEach((input) => input.addEventListener('change', updateWebsiteField));
  updateWebsiteField();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateStep(activeStep)) return;

    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending your project brief…';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Submission failed');

      form.reset();
      updateWebsiteField();
      form.hidden = true;
      document.querySelector('.contact-progress').hidden = true;
      success.hidden = false;
      success.focus?.();
      if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { form_name: 'project_brief' });
    } catch (error) {
      status.setAttribute('role', 'alert');
      status.textContent = 'The brief could not be sent. Please try again or email hello@vulcet.com.';
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
    }
  });
})();
