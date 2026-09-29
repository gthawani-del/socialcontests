const STORAGE_KEY = 'cricket-pinball-playtest-v1';
const MAX_DELIVERIES = 200;

const round = value => Number.isFinite(Number(value)) ? Math.round(Number(value) * 1000) / 1000 : null;
const upper = value => value == null ? null : String(value).toUpperCase();

export function createTelemetryState(meta = {}, existing = []) {
  return {
    sessionId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
    meta: { ...meta },
    deliveries: Array.isArray(existing) ? existing.slice(-MAX_DELIVERIES) : [],
    current: null,
    matchResult: null
  };
}

export function reduceTelemetryEvent(state, event = {}, now = Date.now) {
  if (!state || !event?.type) return state;
  const at = now();

  if (event.type === 'DELIVERY_LAUNCH') {
    const match = event.match || {};
    const score = match.score || {};
    state.current = {
      id: `${state.sessionId}-${state.deliveries.length + 1}`,
      startedAt: new Date(at).toISOString(),
      format: match.format || null,
      difficulty: match.difficulty || null,
      innings: match.innings || null,
      inningsBall: Number(score.balls || 0) + 1,
      battingPlayerId: match.battingPlayerId || null,
      bowlingPlayerId: match.bowlingPlayerId || null,
      line: upper(event.selection?.line),
      deliveryType: upper(event.selection?.type || 'PACE'),
      power: round(event.selection?.power),
      timing: null,
      contactQuality: null,
      timingScore: null,
      angleScore: null,
      impactScore: null,
      shotIntent: null,
      attackRisk: null,
      bat: null,
      contactZ: null,
      swingProgress: null,
      targetAttempted: null,
      zoneId: null,
      result: null,
      reason: null,
      wicketReason: null,
      durationMs: null
    };
    return state;
  }

  if (event.type === 'BAT_CONTACT' && state.current) {
    const feedback = event.feedback || {};
    const hit = event.hit || {};
    Object.assign(state.current, {
      timing: upper(feedback.timing),
      contactQuality: round(feedback.quality),
      timingScore: round(feedback.timingScore),
      angleScore: round(feedback.angleScore),
      impactScore: round(feedback.impactScore),
      shotIntent: upper(feedback.shotIntent),
      attackRisk: round(feedback.attackRisk),
      bat: upper(hit.id),
      contactZ: round(hit.z),
      swingProgress: round(feedback.swingProgress)
    });
    return state;
  }

  if (event.type === 'OUTCOME') {
    const metadata = event.metadata || {};
    const current = state.current || {
      id: `${state.sessionId}-${state.deliveries.length + 1}`,
      startedAt: new Date(at).toISOString(),
      format: event.match?.format || null,
      difficulty: event.match?.difficulty || null,
      innings: event.match?.innings || null,
      inningsBall: event.match?.score?.balls || null,
      battingPlayerId: event.match?.battingPlayerId || null,
      bowlingPlayerId: event.match?.bowlingPlayerId || null
    };
    const result = upper(event.outcome);
    const reason = upper(metadata.reason);
    current.targetAttempted = upper(metadata.attemptedOutcome || (metadata.zoneId ? event.outcome : null));
    current.zoneId = metadata.zoneId || null;
    current.result = result;
    current.reason = reason;
    current.wicketReason = result === 'WICKET' ? reason : null;
    current.durationMs = Math.max(0, at - Date.parse(current.startedAt || new Date(at).toISOString()));
    current.scoreAfter = event.match?.score ? { ...event.match.score } : null;
    current.targetAfter = event.match?.target ?? null;
    state.deliveries.push(current);
    if (state.deliveries.length > MAX_DELIVERIES) state.deliveries.splice(0, state.deliveries.length - MAX_DELIVERIES);
    state.current = null;
    return state;
  }

  if (event.type === 'MATCH_RESULT') {
    state.matchResult = event.result ? { ...event.result } : null;
    return state;
  }

  return state;
}

export function summarizeTelemetry(deliveries = []) {
  const summary = {
    deliveries: deliveries.length,
    contacts: 0,
    contactRate: 0,
    avgQuality: null,
    timing: { EARLY: 0, PERFECT: 0, LATE: 0, NONE: 0 },
    intent: { SAFE: 0, ATTACK: 0, NONE: 0 },
    results: {},
    deliveryTypes: {},
    wickets: {},
    boundaries: 0,
    boundaryAttempts: 0,
    boundaryConversion: null
  };
  let qualityTotal = 0, qualityCount = 0;

  for (const row of deliveries) {
    const timing = row.timing || 'NONE';
    summary.timing[timing] = (summary.timing[timing] || 0) + 1;
    const intent = row.shotIntent || 'NONE';
    summary.intent[intent] = (summary.intent[intent] || 0) + 1;
    const result = row.result || 'UNKNOWN';
    summary.results[result] = (summary.results[result] || 0) + 1;
    const deliveryType = row.deliveryType || 'UNKNOWN';
    summary.deliveryTypes[deliveryType] = (summary.deliveryTypes[deliveryType] || 0) + 1;

    if (row.timing) summary.contacts += 1;
    if (Number.isFinite(row.contactQuality)) {
      qualityTotal += row.contactQuality;
      qualityCount += 1;
    }
    if (row.wicketReason) summary.wickets[row.wicketReason] = (summary.wickets[row.wicketReason] || 0) + 1;
    if (['FOUR', 'SIX'].includes(row.targetAttempted)) summary.boundaryAttempts += 1;
    if (['FOUR', 'SIX'].includes(row.result)) summary.boundaries += 1;
  }

  summary.contactRate = summary.deliveries ? summary.contacts / summary.deliveries : 0;
  summary.avgQuality = qualityCount ? qualityTotal / qualityCount : null;
  summary.boundaryConversion = summary.boundaryAttempts ? summary.boundaries / summary.boundaryAttempts : null;
  return summary;
}

function loadStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStored(deliveries) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(deliveries.slice(-MAX_DELIVERIES))); } catch {}
}

const pct = value => Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
const val = value => value == null ? '—' : value;

export function createPlaytestTelemetry({ app, enabled = false, meta = {} } = {}) {
  if (!enabled || !app) return { enabled: false, handle() {}, getState: () => null, clear() {} };

  const state = createTelemetryState({
    ...meta,
    viewport: { width: innerWidth, height: innerHeight },
    userAgent: navigator.userAgent
  }, loadStored());

  const toggle = document.createElement('button');
  toggle.id = 'telemetryToggle';
  toggle.type = 'button';
  toggle.innerHTML = 'TEST DATA <span>0</span>';

  const panel = document.createElement('aside');
  panel.id = 'telemetryPanel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="telemetry-head">
      <div><b>PLAYTEST TELEMETRY</b><small>LOCAL DEVICE ONLY</small></div>
      <button type="button" id="telemetryClose" aria-label="Close telemetry">×</button>
    </div>
    <div id="telemetrySummary" class="telemetry-summary"></div>
    <div class="telemetry-actions">
      <button type="button" id="telemetryCopy">COPY JSON</button>
      <button type="button" id="telemetryClear">CLEAR</button>
    </div>
    <div class="telemetry-table-wrap">
      <table class="telemetry-table">
        <thead><tr><th>#</th><th>Ball</th><th>Delivery</th><th>Timing</th><th>Q</th><th>Intent</th><th>Target</th><th>Result</th><th>Reason</th></tr></thead>
        <tbody id="telemetryRows"></tbody>
      </table>
    </div>`;

  app.append(toggle, panel);

  const count = toggle.querySelector('span');
  const summaryEl = panel.querySelector('#telemetrySummary');
  const rowsEl = panel.querySelector('#telemetryRows');
  const copyButton = panel.querySelector('#telemetryCopy');

  function render() {
    const summary = summarizeTelemetry(state.deliveries);
    count.textContent = String(summary.deliveries);
    summaryEl.innerHTML = `
      <div><small>BALLS</small><strong>${summary.deliveries}</strong></div>
      <div><small>CONTACT</small><strong>${pct(summary.contactRate)}</strong></div>
      <div><small>AVG Q</small><strong>${summary.avgQuality == null ? '—' : summary.avgQuality.toFixed(2)}</strong></div>
      <div><small>PERFECT</small><strong>${summary.timing.PERFECT || 0}</strong></div>
      <div><small>ATTACK</small><strong>${summary.intent.ATTACK || 0}</strong></div>
      <div><small>BOUNDARY</small><strong>${pct(summary.boundaryConversion)}</strong></div>`;

    const rows = state.deliveries.slice(-30).reverse();
    rowsEl.innerHTML = rows.map((row, index) => `
      <tr>
        <td>${state.deliveries.length - index}</td>
        <td>I${val(row.innings)}·B${val(row.inningsBall)}</td>
        <td><b>${val(row.line)}</b><small>${val(row.deliveryType)} · ${row.power == null ? '—' : Math.round(row.power * 100) + '%'}</small></td>
        <td>${val(row.timing)}<small>${val(row.bat)}</small></td>
        <td>${row.contactQuality == null ? '—' : row.contactQuality.toFixed(2)}</td>
        <td>${val(row.shotIntent)}</td>
        <td>${val(row.targetAttempted)}<small>${val(row.zoneId)}</small></td>
        <td><b>${val(row.result)}</b></td>
        <td>${val(row.wicketReason || row.reason)}</td>
      </tr>`).join('');
  }

  function persist() {
    saveStored(state.deliveries);
    render();
  }

  function handle(event) {
    reduceTelemetryEvent(state, event);
    if (event?.type === 'OUTCOME' || event?.type === 'MATCH_RESULT') persist();
    else render();
  }

  async function copyJson() {
    const payload = {
      schema: 'cricket-pinball-playtest-v1',
      sessionId: state.sessionId,
      startedAt: state.startedAt,
      exportedAt: new Date().toISOString(),
      meta: state.meta,
      matchResult: state.matchResult,
      summary: summarizeTelemetry(state.deliveries),
      deliveries: state.deliveries
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = 'COPIED';
      setTimeout(() => { copyButton.textContent = 'COPY JSON'; }, 1000);
    } catch {
      console.log('CRICKET_PINBALL_TELEMETRY', text);
      copyButton.textContent = 'LOGGED';
      setTimeout(() => { copyButton.textContent = 'COPY JSON'; }, 1000);
    }
  }

  function clear() {
    state.deliveries.length = 0;
    state.current = null;
    state.matchResult = null;
    saveStored([]);
    render();
  }

  toggle.onclick = () => { panel.hidden = !panel.hidden; };
  panel.querySelector('#telemetryClose').onclick = () => { panel.hidden = true; };
  panel.querySelector('#telemetryCopy').onclick = copyJson;
  panel.querySelector('#telemetryClear').onclick = clear;

  render();
  return { enabled: true, handle, getState: () => state, clear };
}
