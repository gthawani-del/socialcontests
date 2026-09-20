import '../ui/admin.css';

const app = document.querySelector('#cricketAdminApp');
if (!app) throw new Error('Cricket Pinball admin root not found.');

const NAV = [
  'Dashboard','Matches','Players','Game Rules','Table & Physics','Scoring Zones',
  'Assets & Portraits','Commentary & Audio','Spectator / Fan Picks','Leaderboards',
  'Analytics','Live Operations','Audit Log'
];

const user = resolveUser();
if (!user.roles.includes('admin')) {
  app.innerHTML = `<main class="admin-denied"><div><p>CRICKET PINBALL ADMIN</p><h1>ADMIN ACCESS REQUIRED</h1><span>This backoffice is role-gated. Connect authenticated admin role data before production use.</span><a href="/cricket-pinball">Back to Cricket Pinball</a></div></main>`;
} else {
  renderShell();
}

function renderShell() {
  app.innerHTML = `
    <div class="cp-admin-shell">
      <aside>
        <a class="admin-brand" href="/cricket-pinball"><b>CP</b><span><strong>Cricket Pinball</strong><small>Backoffice</small></span></a>
        <nav>${NAV.map((label,index)=>`<button type="button" data-section="${index}" class="${index===0?'active':''}">${label}</button>`).join('')}</nav>
        <footer><span>ADMIN ROLE</span><strong>${escapeHtml(user.name || 'Authenticated admin')}</strong></footer>
      </aside>
      <main>
        <header><div><span>CRICKET PINBALL</span><strong id="sectionTitle">Dashboard</strong></div><small>ADMIN SHELL · PASS 1</small></header>
        <section class="admin-placeholder" id="sectionContent">
          <p>DASHBOARD</p><h1>Backoffice architecture ready.</h1><span>Detailed functionality will be implemented from docs/cricket-pinball/backoffice.md when specified.</span>
        </section>
      </main>
    </div>
  `;

  app.querySelectorAll('[data-section]').forEach((button)=>{
    button.addEventListener('click',()=>{
      const index=Number(button.dataset.section);
      app.querySelectorAll('[data-section]').forEach((node)=>node.classList.toggle('active',node===button));
      const label=NAV[index];
      app.querySelector('#sectionTitle').textContent=label;
      app.querySelector('#sectionContent').innerHTML=`<p>${escapeHtml(label.toUpperCase())}</p><h1>${escapeHtml(label)}</h1><span>TODO — functionality intentionally deferred until the backoffice specification is written.</span>`;
    });
  });
}

function resolveUser() {
  if (window.__CRICKET_PINBALL_USER__?.roles) return window.__CRICKET_PINBALL_USER__;
  try {
    const stored = JSON.parse(sessionStorage.getItem('cricket-pinball-user') || '{}');
    return { name: stored.name || '', roles: Array.isArray(stored.roles) ? stored.roles : [] };
  } catch {
    return { name: '', roles: [] };
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g,(char)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
}
