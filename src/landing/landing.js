import './landing.css';

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
