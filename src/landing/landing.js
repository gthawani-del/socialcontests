import './landing.css';

const PROGRESS_KEY = 'infinite-pinball-progress-v1';

const THEMES = {
  paris: {
    id: 'paris',
    name: 'Paris Nights',
    className: 'paris',
    href: '/play?theme=paris'
  },
  'bombay-1945': {
    id: 'bombay-1945',
    name: 'Bombay 1945',
    className: 'bombay',
    href: '/play?theme=bombay-1945'
  }
};

const progress = readProgress();
hydrateProgress(progress);
bindNavigation();
bindHeroMotion();

function bindNavigation() {
  const controls = document.querySelectorAll('[data-scroll]');

  controls.forEach((control) => {
    control.addEventListener('click', (event) => {
      const targetId = control.dataset.scroll;
      const target = document.getElementById(targetId);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveNav(targetId);
    });
  });

  const sectionIds = ['featured', 'worlds', 'historical', 'night-worlds', 'scores', 'coming-soon'];
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;
    setActiveNav(visible.target.id);
  }, {
    rootMargin: '-28% 0px -58% 0px',
    threshold: [0.01, 0.2, 0.45]
  });

  sections.forEach((section) => observer.observe(section));
}

function setActiveNav(id) {
  const chipTarget = id === 'scores' ? null : id;

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.scroll === chipTarget);
  });

  document.querySelectorAll('.dock-item[data-scroll]').forEach((item) => {
    item.classList.toggle('active', item.dataset.scroll === id);
  });

  if (id === 'historical' || id === 'night-worlds' || id === 'coming-soon') {
    const chip = document.querySelector('.chip[data-scroll="' + id + '"]');
    if (chip) {
      document.querySelectorAll('.chip').forEach((node) => node.classList.toggle('active', node === chip));
      chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }
}

function hydrateProgress(state) {
  const bombay = state.themes?.['bombay-1945'];
  const paris = state.themes?.paris;

  setScore('#bombayHighScore', bombay?.highScore);
  setScore('#parisHighScore', paris?.highScore);

  const lastId = state.lastPlayedTheme;
  const lastTheme = THEMES[lastId];
  const lastStats = lastId ? state.themes?.[lastId] : null;

  if (!lastTheme || !lastStats) return;

  const section = document.getElementById('continue');
  const slot = document.getElementById('continueSlot');
  if (!section || !slot) return;

  const difficulty = String(lastStats.difficulty || state.lastDifficulty || 'standard').toUpperCase();
  const highScore = Number(lastStats.highScore || 0);
  const lastScore = Number(lastStats.lastScore || 0);
  const href = lastTheme.href + '?difficulty=' + encodeURIComponent(
    String(lastStats.difficulty || state.lastDifficulty || 'standard').toLowerCase()
  );

  const normalizedHref = lastTheme.href.includes('?')
    ? lastTheme.href + '&difficulty=' + encodeURIComponent(
        String(lastStats.difficulty || state.lastDifficulty || 'standard').toLowerCase()
      )
    : href;

  slot.innerHTML = `
    <article class="continue-card ${lastTheme.className}">
      <div class="continue-image"></div>
      <div class="continue-copy">
        <span>LAST PLAYED</span>
        <h3>${escapeHtml(lastTheme.name)}</h3>
        <p>Resume this world on ${escapeHtml(difficulty)} difficulty.</p>
        <div class="continue-stats">
          <div><span>LAST SCORE</span><strong>${formatScore(lastScore)}</strong></div>
          <div><span>HIGH SCORE</span><strong>${formatScore(highScore)}</strong></div>
          <div><span>DIFFICULTY</span><strong>${escapeHtml(difficulty)}</strong></div>
        </div>
        <a class="continue-cta" href="${normalizedHref}">▶ Continue</a>
      </div>
    </article>
  `;

  section.hidden = false;
}

function setScore(selector, value) {
  const node = document.querySelector(selector);
  if (!node) return;
  node.textContent = value ? formatScore(value) : '—';
}

function readProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { themes: {} };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { themes: {} };
  } catch {
    return { themes: {} };
  }
}

function bindHeroMotion() {
  const hero = document.querySelector('.featured-hero');
  const media = document.querySelector('.hero-media');
  if (!hero || !media || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  hero.addEventListener('pointermove', (event) => {
    if (window.innerWidth < 900) return;
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    media.style.transform = `scale(1.035) translate(${(-x * 8).toFixed(2)}px,${(-y * 5).toFixed(2)}px)`;
  });

  hero.addEventListener('pointerleave', () => {
    media.style.transform = 'scale(1.015)';
  });
}

function formatScore(value) {
  const number = Number(value || 0);
  return number.toLocaleString('en-IN');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[char]);
}
