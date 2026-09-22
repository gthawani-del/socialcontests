import './landing.css';

bindDemoGate();
bindNavigation();

function bindNavigation() {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const controls = document.querySelectorAll('[data-scroll]');

  controls.forEach((control) => {
    control.addEventListener('click', (event) => {
      const targetId = control.dataset.scroll;
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setActiveNav(targetId);
    });
  });

  const sections = ['featured', 'worlds', 'more-worlds', 'sports', 'scores', 'coming-soon']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setActiveNav(visible.target.id);
  }, { rootMargin: '-25% 0px -60% 0px', threshold: [0.01, 0.2, 0.45] });

  sections.forEach((section) => observer.observe(section));
}

function setActiveNav(id) {
  document.querySelectorAll('.categories [data-scroll]').forEach((item) => {
    const target = item.dataset.scroll;
    const active = target === id || (id === 'more-worlds' && ['more-worlds'].includes(target));
    item.classList.toggle('active', active);
  });

  document.querySelectorAll('.mobile-dock [data-scroll]').forEach((item) => {
    item.classList.toggle('active', item.dataset.scroll === id);
  });
}


function bindDemoGate() {
  const gate = document.getElementById('demoGate');
  if (!gate) return;

  const SESSION_KEY = 'infinite-pinball-demo-access';
  // Temporary client-side demo gate only. These values are intentionally easy to rotate.
  const DEMO_USER = 'infinite-preview';
  const DEMO_PASS = 'Flip@Worlds#26';
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 30000;

  if (sessionStorage.getItem(SESSION_KEY) === 'granted') {
    gate.hidden = true;
    return;
  }

  document.body.classList.add('demo-locked');

  const disclaimer = document.getElementById('disclaimerStep');
  const login = document.getElementById('loginStep');
  const consent = document.getElementById('demoConsent');
  const continueButton = document.getElementById('continueDemo');
  const backButton = document.getElementById('demoBack');
  const error = document.getElementById('demoError');
  const username = document.getElementById('demoUsername');
  const password = document.getElementById('demoPassword');

  let attempts = 0;
  let lockedUntil = 0;

  consent.addEventListener('change', () => {
    continueButton.disabled = !consent.checked;
  });

  continueButton.addEventListener('click', () => {
    if (!consent.checked) return;
    disclaimer.hidden = true;
    login.hidden = false;
    username.focus();
  });

  backButton.addEventListener('click', () => {
    login.hidden = true;
    disclaimer.hidden = false;
    error.textContent = '';
  });

  login.addEventListener('submit', (event) => {
    event.preventDefault();
    const now = Date.now();

    if (now < lockedUntil) {
      error.textContent = 'Too many attempts. Please wait 30 seconds and try again.';
      return;
    }

    if (username.value.trim() === DEMO_USER && password.value === DEMO_PASS) {
      sessionStorage.setItem(SESSION_KEY, 'granted');
      gate.hidden = true;
      document.body.classList.remove('demo-locked');
      password.value = '';
      return;
    }

    attempts += 1;
    password.value = '';
    password.focus();

    if (attempts >= MAX_ATTEMPTS) {
      lockedUntil = now + LOCK_MS;
      attempts = 0;
      error.textContent = 'Too many attempts. Please wait 30 seconds and try again.';
      return;
    }

    error.textContent = 'Incorrect demo credentials.';
  });
}
