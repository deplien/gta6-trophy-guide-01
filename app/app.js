// Leonida Legend — the GTA VI trophy guide & tracker.
// Plain ES module, no libraries, no network: it reads data/trophies.json once,
// keeps progress in localStorage, and renders three views (checklist + guide,
// platinum roadmap, missables). Every trophy guide is our own words and names
// its sources; the app itself never fetches anything beyond its own files.

const STORAGE_KEY = 'leonida-legend-progress-v1';
const GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
const KIND_LABEL = { platinum: 'Platinum', story: 'Story', collectibles: 'Collectibles', activities: 'Activities' };

const ROADMAP_STAGES = [
  { n: 1, title: 'Stage 1 — Arrival: Chapter 1 (and the one missable thing)',
    note: 'Play the opening and Chapter 1. Before the chapter ends, meditate with Lucia on the balcony at Jason\u2019s house \u2014 it feeds Positive Mental Attitude, the only trophy guides flag as possibly missable, and the spot is reported to disappear when Chapter 1 closes. Sample activity types as they unlock for Master of None.' },
  { n: 2, title: 'Stage 2 — Chapters 2 & 3: the crew assembles',
    note: 'Story missions in order: Chapter 2, Chapter 3 and the named set pieces (Breakfast Run, The Cartel Heist, Child\u2019s Play). All unmissable \u2014 just keep playing.' },
  { n: 3, title: 'Stage 3 — Chapter 4: open the vaults',
    note: 'Finish Chapter 4\u2019s missions (Headliners, VCIA Takedown, Operation Savage Glory). Take the OPTIONAL mission \u201CThat\u2019s Where The Money Is\u2026\u201D when it appears \u2014 guides report it unlocks the bank vaults Maximum Withdrawal needs.' },
  { n: 4, title: 'Stage 4 — The finale',
    note: 'Complete the final mission for the gold, You Gotta Know When to Get Off. After the credits you keep free-roaming, and the 100% Completion checklist appears under Progress > Stats. Nothing after this point is locked away.' },
  { n: 5, title: 'Stage 5 — Strangers & side strands',
    note: 'Finish the stranger chains: Andy, Kenton, Billy, Randy and Tyrone each carry a trophy for their final mission, Bret\u2019s hunt carries Fair Game, and any 8 completed strands earn Strangers & Freaks. Start chains when they appear \u2014 one report links strand availability to story progress.' },
  { n: 6, title: 'Stage 6 — Free-roam feats & crime spree',
    note: 'The one-off feats, most of them hidden trophies with cryptic descriptions: partner wanted-level escapes, shop and truck robberies, the VCIA jet theft, the Rhino tank, the showroom smash, the Ocean Beach cocktail, and the five still-unsolved hidden trophies. Guides are cited per trophy in the checklist.' },
  { n: 7, title: 'Stage 7 — Collections & the long grinds',
    note: 'The counters: 250 stunts, 42 shooting-range golds, drone races at 14 locations, 20 race wins, 50 challenges, 3 card sets, 100 WAiNK scans, 100 vehicles, all 52 map areas, $250,000 laundered, $100,000 spent, 8 garages, 500 Criminal Profile actions. Work them in parallel \u2014 scans, races and robberies overlap heavily.' },
  { n: 8, title: 'Stage 8 — 100% & the Platinum',
    note: 'Close out A Long Road with the in-game checklist (Progress > Stats): its thresholds run past several trophy targets (300 stunts, 70 challenges, 15 card sets, 8 vaults), so use it as the final sweep list. When the last trophy lands, Vice Got a Price! pops on its own.' },
];

const state = {
  trophies: [],
  earned: new Set(),
  counts: {},
  spoilerShield: false,
  hideEarned: false,
  kind: 'all',
  grade: 'all',
  query: '',
  view: 'checklist',
  selectedId: 28,
};

async function loadTrophies() {
  const response = await fetch('data/trophies.json');
  const doc = await response.json();
  state.trophies = doc.trophies;
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved)) { state.earned = new Set(saved); return; }
    state.earned = new Set(saved.earned ?? []);
    state.counts = saved.counts ?? {};
    state.spoilerShield = Boolean(saved.settings?.spoilerShield);
    state.hideEarned = Boolean(saved.settings?.hideEarned);
  } catch { /* a corrupt save simply starts fresh */ }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    earned: [...state.earned],
    counts: state.counts,
    settings: { spoilerShield: state.spoilerShield, hideEarned: state.hideEarned },
  }));
}

function trophyById(id) { return state.trophies.find((t) => t.id === id); }

function isSpoilerHidden(trophy) {
  return state.spoilerShield && trophy.kind === 'story' && !state.earned.has(trophy.id);
}

function displayName(trophy) {
  return isSpoilerHidden(trophy) ? 'Hidden story trophy' : trophy.name;
}

function displayDescription(trophy) {
  if (isSpoilerHidden(trophy)) return 'Spoiler shield is on: this story trophy\u2019s description stays hidden until you earn it.';
  return trophy.description;
}

function trophyMatchesFilters(trophy) {
  if (state.kind === 'missable' && !trophy.missable) return false;
  if (state.kind !== 'all' && state.kind !== 'missable' && trophy.kind !== state.kind) return false;
  if (state.grade !== 'all' && trophy.grade !== state.grade) return false;
  if (state.hideEarned && state.earned.has(trophy.id)) return false;
  if (state.query) {
    if (isSpoilerHidden(trophy)) return false;
    const haystack = `${trophy.name} ${trophy.description} ${trophy.kind}`.toLowerCase();
    if (!haystack.includes(state.query)) return false;
  }
  return true;
}

function sortedTrophies() {
  return [...state.trophies].sort((a, b) =>
    a.stage - b.stage || GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || a.id - b.id);
}

function renderProgressHeader() {
  const total = state.trophies.length;
  const done = state.earned.size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const ring = document.getElementById('progress-ring');
  ring.style.background = `conic-gradient(var(--teal) ${pct * 3.6}deg, #3a2d6b ${pct * 3.6}deg)`;
  ring.dataset.pct = `${pct}%`;
  document.getElementById('progress-line').textContent = `${done} of ${total} earned`;
  const tally = (grade) => {
    const all = state.trophies.filter((t) => t.grade === grade);
    return all.filter((t) => state.earned.has(t.id)).length + '/' + all.length;
  };
  document.getElementById('grade-line').textContent =
    `Platinum ${tally('platinum')} · Gold ${tally('gold')} · Silver ${tally('silver')} · Bronze ${tally('bronze')}`;
}

function makeTag(text, className) {
  const span = document.createElement('span');
  span.className = `tag ${className}`;
  span.textContent = text;
  return span;
}

function renderTrophyList() {
  const list = document.getElementById('trophy-list');
  list.replaceChildren();
  const visible = sortedTrophies().filter(trophyMatchesFilters);
  for (const trophy of visible) {
    const row = document.createElement('li');
    row.className = 'trophy-row' +
      (state.earned.has(trophy.id) ? ' is-earned' : '') +
      (state.selectedId === trophy.id ? ' is-selected' : '');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = state.earned.has(trophy.id);
    box.setAttribute('aria-label', `Mark ${trophy.name} as earned`);
    box.addEventListener('click', (event) => event.stopPropagation());
    box.addEventListener('change', () => toggleEarned(trophy.id, box.checked));
    const badge = document.createElement('span');
    badge.className = `grade-badge grade-${trophy.grade}`;
    badge.textContent = trophy.grade;
    const main = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'row-name' + (isSpoilerHidden(trophy) ? ' spoiler-name' : '');
    name.textContent = displayName(trophy);
    const desc = document.createElement('span');
    desc.className = 'row-desc';
    desc.textContent = displayDescription(trophy);
    main.append(name, desc);
    const tags = document.createElement('span');
    tags.className = 'row-tags';
    tags.append(makeTag(KIND_LABEL[trophy.kind] ?? trophy.kind, 'tag-kind'));
    if (trophy.missable) tags.append(makeTag('⚠ Missable', 'tag-missable'));
    if (trophy.hidden) tags.append(makeTag('Hidden', 'tag-hidden'));
    if (trophy.count) tags.append(makeTag(`× ${trophy.count}`, 'tag-count'));
    row.append(box, badge, main, tags);
    row.addEventListener('click', () => selectTrophy(trophy.id));
    list.append(row);
  }
  const missableLeft = state.trophies.filter((t) => t.missable && !state.earned.has(t.id)).length;
  document.getElementById('list-summary').textContent =
    `Showing ${visible.length} of ${state.trophies.length} trophies, in roadmap order. ` +
    (missableLeft ? `⚠ ${missableLeft} missable trophy still unearned \u2014 see the Missables tab before Chapter 1 ends.` :
      'The missable trophy is earned. Nothing else in this list can be permanently missed.');
}

function toggleEarned(id, on) {
  if (on) state.earned.add(id); else state.earned.delete(id);
  saveProgress();
  renderAll();
}

function selectTrophy(id) {
  state.selectedId = id;
  renderTrophyList();
  renderDetailPanel();
}

function renderDetailPanel() {
  const panel = document.getElementById('detail-panel');
  const trophy = trophyById(state.selectedId) ?? state.trophies[0];
  if (!trophy) { panel.textContent = 'Loading the trophy list\u2026'; return; }
  panel.replaceChildren();
  if (trophy.missable) {
    const banner = document.createElement('div');
    banner.className = 'missable-banner';
    banner.textContent = '\u26a0 MISSABLE \u2014 read the guide before you finish Chapter 1.';
    panel.append(banner);
  }
  const grade = document.createElement('span');
  grade.className = 'detail-grade';
  grade.style.color = `var(--${trophy.grade})`;
  grade.textContent = `${trophy.grade} trophy \u00b7 #${trophy.id} of 55`;
  const title = document.createElement('h2');
  title.textContent = displayName(trophy);
  const desc = document.createElement('p');
  desc.className = 'detail-desc';
  desc.textContent = `\u201c${displayDescription(trophy)}\u201d \u2014 official PlayStation description`;
  const meta = document.createElement('div');
  meta.className = 'detail-meta';
  meta.append(
    makeTag(`Kind: ${KIND_LABEL[trophy.kind] ?? trophy.kind}`, 'tag-kind'),
    makeTag(`Roadmap stage ${trophy.stage}`, 'tag-kind'),
  );
  if (trophy.hidden) meta.append(makeTag('Hidden on PSN until earned', 'tag-hidden'));
  if (trophy.count) meta.append(makeTag(`PlayStation tracks progress to ${trophy.count}`, 'tag-count'));
  const guide = document.createElement('p');
  guide.className = 'detail-guide';
  guide.textContent = isSpoilerHidden(trophy)
    ? 'Spoiler shield is on, so this story trophy\u2019s guide stays hidden too \u2014 it would give the mission away. Earn the trophy, or switch the shield off, to read it.'
    : trophy.guide;
  panel.append(grade, title, desc, meta, guide);
  if (trophy.count) {
    const row = document.createElement('div');
    row.className = 'counter-row';
    const label = document.createElement('label');
    label.textContent = 'Your progress:';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(trophy.count);
    input.value = String(state.counts[trophy.id] ?? 0);
    input.setAttribute('aria-label', `Progress count for ${trophy.name}`);
    input.addEventListener('change', () => {
      const value = Math.max(0, Math.min(trophy.count, Number(input.value) || 0));
      state.counts[trophy.id] = value;
      if (value >= trophy.count) state.earned.add(trophy.id);
      saveProgress();
      renderAll();
    });
    const of = document.createElement('span');
    of.textContent = `of ${trophy.count}`;
    row.append(label, input, of);
    panel.append(row);
  }
  const earn = document.createElement('button');
  earn.id = 'detail-earn';
  earn.type = 'button';
  const isEarned = state.earned.has(trophy.id);
  earn.textContent = isEarned ? '\u2713 Earned \u2014 tap to undo' : 'Mark as earned';
  earn.classList.toggle('is-earned', isEarned);
  earn.addEventListener('click', () => toggleEarned(trophy.id, !state.earned.has(trophy.id)));
  panel.append(earn);
  const sources = document.createElement('div');
  sources.className = 'sources';
  const heading = document.createElement('h3');
  heading.textContent = 'Sources for this guide';
  const ul = document.createElement('ul');
  for (const source of trophy.sources ?? []) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = source.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = source.label;
    li.append(a);
    ul.append(li);
  }
  sources.append(heading, ul);
  panel.append(sources);
}

function renderRoadmap() {
  const wrap = document.getElementById('roadmap-stages');
  wrap.replaceChildren();
  for (const stage of ROADMAP_STAGES) {
    const section = document.createElement('section');
    section.className = 'stage';
    const heading = document.createElement('h3');
    heading.textContent = stage.title;
    const inStage = state.trophies.filter((t) => t.stage === stage.n);
    const doneCount = inStage.filter((t) => state.earned.has(t.id)).length;
    const count = document.createElement('span');
    count.className = 'stage-count';
    count.textContent = `${doneCount}/${inStage.length} earned`;
    heading.append(count);
    const note = document.createElement('p');
    note.className = 'stage-note';
    note.textContent = stage.note;
    const chips = document.createElement('div');
    chips.className = 'stage-chips';
    for (const trophy of inStage) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'stage-chip' + (state.earned.has(trophy.id) ? ' is-earned' : '');
      const dot = document.createElement('span');
      dot.className = `dot dot-${trophy.grade}`;
      dot.textContent = '\u25cf';
      chip.append(dot, document.createTextNode(
        displayName(trophy) + (trophy.missable ? ' \u26a0' : '')));
      chip.addEventListener('click', () => { setView('checklist'); selectTrophy(trophy.id); });
      chips.append(chip);
    }
    section.append(heading, note, chips);
    wrap.append(section);
  }
}

function renderMissables() {
  const wrap = document.getElementById('missable-cards');
  wrap.replaceChildren();
  for (const trophy of state.trophies.filter((t) => t.missable)) {
    const card = document.createElement('article');
    card.className = 'missable-card';
    const heading = document.createElement('h3');
    heading.textContent = `\u26a0 ${trophy.name} (${trophy.grade})`;
    const desc = document.createElement('p');
    desc.className = 'detail-desc';
    desc.textContent = `\u201c${trophy.description}\u201d`;
    const guide = document.createElement('p');
    guide.className = 'detail-guide';
    guide.textContent = trophy.guide;
    const sources = document.createElement('p');
    sources.className = 'sources';
    sources.textContent = 'Sources: ' + (trophy.sources ?? []).map((s) => s.label).join(' \u00b7 ');
    card.append(heading, desc, guide, sources);
    wrap.append(card);
  }
}

function setView(name) {
  state.view = name;
  for (const tab of document.querySelectorAll('#view-tabs .tab')) {
    tab.classList.toggle('is-active', tab.dataset.view === name);
  }
  for (const section of document.querySelectorAll('.view')) {
    section.hidden = section.id !== `view-${name}`;
  }
  if (name === 'roadmap') renderRoadmap();
  if (name === 'missables') renderMissables();
}

function exportProgress() {
  const payload = JSON.stringify({
    app: 'leonida-legend',
    version: 1,
    earned: [...state.earned],
    counts: state.counts,
    settings: { spoilerShield: state.spoilerShield, hideEarned: state.hideEarned },
  }, null, 2);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  link.download = 'gta6-trophy-progress.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importProgress(file) {
  const data = JSON.parse(await file.text());
  const byName = new Map(state.trophies.map((t) => [t.name, t.id]));
  const ids = [];
  for (const entry of data.earned ?? []) {
    if (typeof entry === 'number' && trophyById(entry)) ids.push(entry);
    else if (typeof entry === 'string' && byName.has(entry)) ids.push(byName.get(entry));
  }
  state.earned = new Set(ids);
  state.counts = data.counts ?? {};
  if (data.settings) {
    state.spoilerShield = Boolean(data.settings.spoilerShield);
    state.hideEarned = Boolean(data.settings.hideEarned);
  }
  saveProgress();
  syncToolbar();
  renderAll();
}

function syncToolbar() {
  document.getElementById('spoiler-toggle').checked = state.spoilerShield;
  document.getElementById('hide-earned-toggle').checked = state.hideEarned;
}

function wireToolbar() {
  document.getElementById('search').addEventListener('input', (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderTrophyList();
  });
  for (const chip of document.querySelectorAll('#kind-filters .chip')) {
    chip.addEventListener('click', () => {
      state.kind = chip.dataset.kind;
      for (const other of document.querySelectorAll('#kind-filters .chip')) {
        other.classList.toggle('is-active', other === chip);
      }
      renderTrophyList();
    });
  }
  document.getElementById('grade-filter').addEventListener('change', (event) => {
    state.grade = event.target.value;
    renderTrophyList();
  });
  document.getElementById('spoiler-toggle').addEventListener('change', (event) => {
    state.spoilerShield = event.target.checked;
    saveProgress();
    renderAll();
  });
  document.getElementById('hide-earned-toggle').addEventListener('change', (event) => {
    state.hideEarned = event.target.checked;
    saveProgress();
    renderTrophyList();
  });
  document.getElementById('export-btn').addEventListener('click', exportProgress);
  document.getElementById('import-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) await importProgress(file);
    event.target.value = '';
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    state.earned.clear();
    state.counts = {};
    saveProgress();
    renderAll();
  });
  for (const tab of document.querySelectorAll('#view-tabs .tab')) {
    tab.addEventListener('click', () => setView(tab.dataset.view));
  }
}

function renderAll() {
  renderProgressHeader();
  renderTrophyList();
  renderDetailPanel();
  if (state.view === 'roadmap') renderRoadmap();
  if (state.view === 'missables') renderMissables();
}

loadProgress();
await loadTrophies();
wireToolbar();
syncToolbar();
renderAll();
