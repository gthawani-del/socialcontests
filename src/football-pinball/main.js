import '../access/demo-gate.js';
import './style.css';
import { renderLobby, renderGameShell, MODE_UI, updateHud } from './ui/index.js';
const mode = new URLSearchParams(location.search).get('mode') || location.pathname.split('/').filter(Boolean)[1];
if (mode === 'foundation') await import('./foundation-main.js');
else if (MODE_UI[mode]) {
  const root = document.querySelector('#footballApp');
  renderGameShell(root, mode);
  updateHud(root, { status: 'Mode implementation in progress.', sessionLabel: 'DEVELOPMENT' });
} else renderLobby();
