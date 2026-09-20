import './ui/cricket-pinball.css';

const app = document.querySelector('#cricketPinballApp');

if (!app) {
  throw new Error('Cricket Pinball root element not found.');
}

document.documentElement.dataset.product = 'cricket-pinball';

app.innerHTML = `
  <main class="cricket-pinball-shell">
    <section class="cricket-pinball-boundary" aria-labelledby="cricketPinballTitle">
      <p class="cricket-pinball-kicker">CRICKET PINBALL</p>
      <h1 id="cricketPinballTitle">Dedicated match experience</h1>
      <p>This product area is isolated from the generic Infinite Pinball theme flow.</p>
      <span class="cricket-pinball-status">ROUTE READY</span>
    </section>
  </main>
`;
