import { addTeamSelection } from './team-selection.js';
// Shared presentation shell: pre-game setup, an in-board start, and one control dial.
export function addGameMenu(root, setup, mode = "pvp") {
  const trigger=root.querySelector('#fp-settings-open');
  const help=root.querySelector('#fp-settings-dialog');
  help.querySelector('h2').textContent='Help & controls';
  const guide=root.querySelector('.fp-table-guide');
  if(guide) help.insertBefore(guide,help.querySelector('#fp-settings-done'));
  const preflight=document.createElement('section');preflight.className='fp-preflight';
  preflight.innerHTML='<a href="/football-pinball/">‹ Game selection</a><p>FOOTBALL PINBALL</p><h1>PvP Match</h1><p>Set up your match before entering the board.</p><button id="fp-enter-board" type="button">Continue to board</button>';
  preflight.insertBefore(setup.section,preflight.lastElementChild);root.append(preflight);
  preflight.querySelector('h1').textContent=root.querySelector('.fp-mode-heading h1').textContent;
  preflight.querySelectorAll('p')[1].textContent='Choose your options, then continue to the board.';
  if(mode==='pvp') addTeamSelection(root, preflight, preflight.lastElementChild);
  const hint=document.createElement('p');hint.textContent='Tap a boot to flip immediately; release to return it. Use both thumbs. '+(mode==='pvp'?'Players pass and shoot automatically on contact. Strength appears after a hit.':mode==='crash'?'Bank secures virtual points and ends the run.':'Time contact with the ball; holding does not charge a shot.');preflight.insertBefore(hint,preflight.lastElementChild);
  if(mode==='arcade-rush'){const badge=document.createElement('span');badge.id='fp-multiball-badge';badge.hidden=true;root.querySelector('#fp-arena').append(badge);}
  const sound=document.createElement('button');sound.type='button';sound.id='fp-preflight-audio';sound.dataset.footballAudio='';
  const audio=root.querySelector('#fp-audio');sound.textContent=audio.textContent;sound.setAttribute('aria-pressed',audio.getAttribute('aria-pressed'));
  sound.onclick=()=>audio.click();preflight.insertBefore(sound,preflight.lastElementChild);
  root.dataset.stage='setup';
  root.querySelector('#fp-enter-board').onclick=()=>{root.dataset.stage='play';const networkStatus=root.querySelector('#fp-network-status');if(networkStatus)help.insertBefore(networkStatus,help.querySelector('#fp-settings-done'));window.dispatchEvent(new Event('resize'));root.querySelector('#fp-serve').focus();};
  const start=root.querySelector('#fp-serve');start.textContent='Start game';root.querySelector('#fp-arena').append(start);
  const dial=document.createElement('dialog');dial.id='fp-control-dial';dial.className='fp-control-dial';dial.setAttribute('aria-label','Game controls');
  dial.innerHTML='<button id="fp-dial-close" type="button" aria-label="Close game controls">Close</button><button id="fp-help" type="button">Help</button><button id="fp-exit" type="button">Exit</button>';
  root.append(dial);
  for(const id of ['fp-pause','fp-audio','fp-reset'])dial.append(root.querySelector('#'+id));
  if(mode!=='pvp'){
    const arena=root.querySelector('#fp-arena');
    arena.append(root.querySelector('.fp-controls'),root.querySelector('#fp-status'));
  }
  const bank=root.querySelector('#fp-bank');
  if(bank){bank.innerHTML='Bank <strong id=fp-bank-button-value>0 pts</strong>';root.querySelector('.fp-controls>div').insertBefore(bank,root.querySelector('[data-boot=blue-right]'));}
  const secondary={penalty:['fp-points','fp-streak'],crash:['fp-base'],'arcade-rush':['fp-multiball']}[mode]||[];
  for(const id of secondary){const stat=root.querySelector('#'+id)?.parentElement;if(stat) help.insertBefore(stat,help.querySelector('#fp-settings-done'));}
  root.querySelector('.fp-actions').remove();
  trigger.setAttribute('aria-label','Game controls');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',dial.id);
  const open=dialog=>{dialog.showModal();root.dispatchEvent(new Event('footballsettingsopen'));};
  trigger.onclick=()=>{open(dial);trigger.setAttribute('aria-expanded','true');};
  dial.querySelector('#fp-dial-close').onclick=()=>dial.close();
  dial.querySelector('#fp-help').onclick=()=>{help.querySelector('.fp-how').open=true;open(help);dial.close();};
  const confirm=document.createElement('dialog');confirm.className='fp-confirm';confirm.setAttribute('aria-labelledby','fp-confirm-title');
  confirm.innerHTML='<h2 id="fp-confirm-title"></h2><p>Your current match progress will be lost.</p><button id="fp-confirm-cancel">Cancel</button><button id="fp-confirm-yes">Confirm</button>';
  root.append(confirm);
  let action,confirmed=false;
  const ask=kind=>{action=kind;confirm.querySelector('h2').textContent=kind==='restart'?'Restart this match?':'Return to game selection?';open(confirm);dial.close();};
  root.querySelector('#fp-reset').addEventListener('click',event=>{if(confirmed){confirmed=false;return;}event.stopImmediatePropagation();ask('restart');},true);
  root.querySelector('#fp-exit').onclick=()=>ask('exit');
  confirm.querySelector('#fp-confirm-cancel').onclick=()=>confirm.close();
  confirm.querySelector('#fp-confirm-yes').onclick=()=>{if(action==='exit'){location.href='/football-pinball/';return;}confirmed=true;root.querySelector('#fp-reset').click();confirm.close();};
  root.querySelector('#fp-pause').addEventListener('click',()=>dial.close());
  for(const panel of [dial,confirm]){
    panel.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');root.dispatchEvent(new Event('footballsettingsclose'));if(!root.querySelector('dialog[open]'))trigger.focus();});
    panel.addEventListener('click',event=>{if(event.target!==panel)return;const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close();});
  }
  return {preflight};
}
