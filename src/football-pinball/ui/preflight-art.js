const paths={
 back:'M15 5l-7 7 7 7',next:'M9 5l7 7-7 7',sound:'M11 5L6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
 boot:'M4 4h6l3 9 7 3v4H3V9Zm7 5h4m-3 4h4',ball:'M8 3h8l5 6v7l-5 5H8l-5-5V9Z M9 9h6l2 5-5 4-5-4Z',
 goal:'M3 21V4h18v17M3 9h18M8 4v17m8-17v17M3 15h18',bank:'M4 8h16v12H4ZM2 8l10-5 10 5M8 11v6m8-6v6',clock:'M9 2h6m-3 0v4m7 1 2 2M12 10v5l3 2',
};
export const setupIcon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name==='clock'?'<circle cx="12" cy="15" r="8"/>':''}<path d="${paths[name]||paths.ball}"/></svg>`;
export function decoratePreflight(preflight,mode){
 const configs={pvp:['HEAD TO HEAD','goal','Players pass & shoot','Automatic on contact'],penalty:['FIVE SHOTS','goal','Beat the keeper','Time each strike'],crash:['SURVIVAL','bank','Bank your points','Bank ends the run'],'arcade-rush':['90 SECONDS','clock','Race the clock','Hit targets & build combos']};
 const [tag,icon,title,caption]=configs[mode];
 const back=preflight.querySelector('a');back.innerHTML=setupIcon('back')+'<span>Game selection</span>';
 const header=document.createElement('header');header.className='fp-setup-heading';
 header.innerHTML=`<span class="fp-setup-emblem">${setupIcon(icon)}</span><div><span class="fp-setup-tag">${tag}</span></div>`;
 header.lastElementChild.append(preflight.querySelector('h1'));back.after(header);
 preflight.querySelector('p').remove();preflight.querySelector('p').textContent='Set your game. Take the field.';
 const art=document.createElement('div');art.className='fp-setup-art';art.setAttribute('aria-hidden','true');
 const targets=mode==='pvp'?'<circle cx="115" cy="70" r="8"/><circle cx="205" cy="70" r="8"/><circle cx="160" cy="116" r="8"/>':mode==='penalty'?'<path d="M150 62h20m-10-8v28m0-7-12 14m12-14 12 14"/>':mode==='crash'?'<path d="m160 54 28 44h-56Z"/>':'<circle cx="115" cy="83" r="12"/><circle cx="205" cy="83" r="12"/>';
 art.innerHTML=`<svg viewBox="0 0 320 166" fill="none"><rect x="48" y="8" width="224" height="150" rx="20" fill="#0c2732" stroke="#365666"/><rect x="61" y="20" width="198" height="126" rx="12" fill="#133f36" stroke="#436f66"/><g stroke="#85ad9f" opacity=".55"><path d="M61 83h198M130 20v28h60V20"/><circle cx="160" cy="83" r="23"/></g><path d="M128 26V12h64v14" stroke="#f18489" stroke-width="3"/><g stroke="#f18489" stroke-width="3">${targets}</g><g class="fp-setup-flippers" stroke="#61baff" stroke-width="10" stroke-linecap="round"><path d="m92 128 39 9m97-9-39 9"/></g><circle class="fp-setup-ball" cx="160" cy="108" r="7" fill="#fff" stroke="#83c9ed" stroke-width="2"/><path d="M38 49v25m244 23v25" stroke="#e5c47d" stroke-width="3"/></svg>`;
 header.after(art);
 const hint=preflight.querySelector('.fp-setup-instructions');
 hint.innerHTML=`<div>${setupIcon('boot')}<span><strong>Tap to flip</strong><small>Release to return</small></span></div><div>${setupIcon(icon)}<span><strong>${title}</strong><small>${caption}</small></span></div>`;
 const sound=preflight.querySelector('#fp-preflight-audio'),start=preflight.querySelector('#fp-enter-board');
 sound.innerHTML=setupIcon('sound')+`<span data-audio-label>${sound.textContent}</span>`;
 start.innerHTML='<span>Continue</span>'+setupIcon('next');
 const actions=document.createElement('div');actions.className='fp-setup-actions';actions.append(sound,start);preflight.append(actions);
}
