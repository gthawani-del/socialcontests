import './landing.css';

const cards = document.querySelectorAll('[data-card]');

cards.forEach((card) => {
  const reset = () => {
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
    card.style.setProperty('--mx', '50%');
    card.style.setProperty('--my', '50%');
  };

  card.addEventListener('pointermove', (event) => {
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    card.style.setProperty('--ry', ((x - 0.5) * 6).toFixed(2) + 'deg');
    card.style.setProperty('--rx', ((0.5 - y) * 5).toFixed(2) + 'deg');
    card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  });

  card.addEventListener('pointerleave', reset);
  reset();
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.15 });

document.querySelectorAll('.theme-card,.platform article,.history-note').forEach((node) => observer.observe(node));
