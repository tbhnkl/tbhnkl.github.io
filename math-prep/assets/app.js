import * as pdfjsLib from './vendor/pdfjs/pdf.min.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;

const DEFAULT_TOPICS = [
  'קמירות', 'תכנון לינארי', 'נגזרות', 'אינטגרלים',
  'גבולות ורציפות', 'מטריצות ואלגברה לינארית', 'טורים', 'הסתברות וסטטיסטיקה',
];

const LAST_DOC_KEY = 'mathPrep.lastDocId';

// ---------- IndexedDB ----------

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('mathPrepDB', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cards')) {
        const cards = db.createObjectStore('cards', { keyPath: 'key' });
        cards.createIndex('by_doc', 'docId', { unique: false });
        cards.createIndex('by_topic', 'topics', { unique: false, multiEntry: true });
      }
      if (!db.objectStoreNames.contains('topics')) {
        db.createObjectStore('topics', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = openDb();

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(storeName) {
  const db = await dbPromise;
  const tx = db.transaction(storeName, 'readonly');
  const result = await reqToPromise(tx.objectStore(storeName).getAll());
  return result;
}
async function dbGetAllByIndex(storeName, indexName, key) {
  const db = await dbPromise;
  const tx = db.transaction(storeName, 'readonly');
  const idx = tx.objectStore(storeName).index(indexName);
  return reqToPromise(idx.getAll(key));
}
async function dbPut(storeName, value) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}
async function dbDelete(storeName, key) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetSimple(storeName, key) {
  const db = await dbPromise;
  const tx = db.transaction(storeName, 'readonly');
  return reqToPromise(tx.objectStore(storeName).get(key));
}

// ---------- Helpers ----------

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

let bannerTimer = null;
function showBanner(msg, ms = 3200) {
  els.banner.textContent = msg;
  els.banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { els.banner.hidden = true; }, ms);
}

// ---------- DOM refs ----------

const els = {
  banner: document.getElementById('banner'),
  appbarSubtitle: document.getElementById('appbar-subtitle'),
  tabbar: document.getElementById('tabbar'),
  screens: {
    documents: document.getElementById('screen-documents'),
    cards: document.getElementById('screen-cards'),
    topics: document.getElementById('screen-topics'),
  },
  inputPdf: document.getElementById('input-pdf'),
  docList: document.getElementById('doc-list'),
  docEmpty: document.getElementById('doc-empty'),

  cardsEmpty: document.getElementById('cards-empty'),
  cardsContent: document.getElementById('cards-content'),
  cardPosition: document.getElementById('card-position'),
  btnClearTopicFilter: document.getElementById('btn-clear-topic-filter'),
  inputManifest: document.getElementById('input-manifest'),
  pdfScroll: document.getElementById('pdf-scroll'),
  pdfCanvas: document.getElementById('pdf-canvas'),
  pdfLoading: document.getElementById('pdf-loading'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  cardLabel: document.getElementById('card-label'),
  statusRow: document.getElementById('status-row'),
  cardTopicChips: document.getElementById('card-topic-chips'),
  formAddTopicInline: document.getElementById('form-add-topic-inline'),
  inputNewTopicInline: document.getElementById('input-new-topic-inline'),
  btnAutoSplitInfo: document.getElementById('btn-auto-split-info'),
  stepsList: document.getElementById('steps-list'),
  formAddStep: document.getElementById('form-add-step'),
  inputNewStep: document.getElementById('input-new-step'),
  cardNotes: document.getElementById('card-notes'),

  topicsSummary: document.getElementById('topics-summary'),
  formAddTopic: document.getElementById('form-add-topic'),
  inputNewTopic: document.getElementById('input-new-topic'),
  topicList: document.getElementById('topic-list'),
  topicsEmpty: document.getElementById('topics-empty'),
};

// ---------- App state ----------

const state = {
  tab: 'documents',
  activeDocId: null,
  mode: 'doc', // 'doc' | 'topic'
  topicFilterId: null,
  topicFilterName: '',
  cardList: [], // {docId, cardId, page, crop, label}
  cardIndex: 0,
  zoom: 1,
  pdfDocs: new Map(), // docId -> pdfjs proxy
  topics: [], // cached topic list
};

function cardKey(docId, cardId) { return `${docId}::${cardId}`; }

// ---------- Topics ----------

async function ensureDefaultTopics() {
  const existing = await dbGetAll('topics');
  if (existing.length > 0) { state.topics = existing; return; }
  const created = [];
  for (const name of DEFAULT_TOPICS) {
    const t = { id: uid(), name, createdAt: Date.now() };
    await dbPut('topics', t);
    created.push(t);
  }
  state.topics = created;
}

async function refreshTopicsCache() {
  state.topics = await dbGetAll('topics');
  return state.topics;
}

async function findOrCreateTopicByName(name) {
  const clean = name.trim();
  if (!clean) return null;
  await refreshTopicsCache();
  const existing = state.topics.find((t) => t.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const t = { id: uid(), name: clean, createdAt: Date.now() };
  await dbPut('topics', t);
  state.topics.push(t);
  return t;
}

// ---------- Cards store access ----------

async function getCardOrDefault(docId, cardId, defaults) {
  const key = cardKey(docId, cardId);
  const existing = await dbGetSimple('cards', key);
  if (existing) return existing;
  return {
    key, docId, cardId,
    page: defaults.page,
    crop: defaults.crop || null,
    label: defaults.label || null,
    status: null,
    topics: [],
    steps: [],
    notes: '',
  };
}

async function saveCard(card) {
  await dbPut('cards', card);
}

// ---------- Documents ----------

async function getDoc(docId) {
  return dbGetSimple('documents', docId);
}

function docCardList(doc) {
  if (doc.manifest && Array.isArray(doc.manifest.questions) && doc.manifest.questions.length) {
    return doc.manifest.questions.map((q) => ({
      docId: doc.id, cardId: String(q.id), page: q.page, crop: q.crop || null, label: q.label || null,
    }));
  }
  const list = [];
  for (let p = 1; p <= doc.pageCount; p++) {
    list.push({ docId: doc.id, cardId: String(p), page: p, crop: null, label: null });
  }
  return list;
}

async function computeDocProgress(doc) {
  const cards = await dbGetAllByIndex('cards', 'by_doc', doc.id);
  const counts = { known: 0, partial: 0, unknown: 0 };
  for (const c of cards) if (c.status && counts[c.status] !== undefined) counts[c.status]++;
  const total = doc.totalCards || doc.pageCount || 1;
  return { ...counts, total };
}

async function renderDocList() {
  const docs = await dbGetAll('documents');
  docs.sort((a, b) => b.addedAt - a.addedAt);
  els.docEmpty.hidden = docs.length > 0;
  els.docList.innerHTML = '';
  for (const doc of docs) {
    const progress = await computeDocProgress(doc);
    const row = document.createElement('div');
    row.className = 'doc-card';
    const pct = (n) => `${(n / progress.total) * 100}%`;
    row.innerHTML = `
      <p class="doc-card-name">${escapeHtml(doc.name)}</p>
      <p class="doc-card-meta">${progress.total} כרטיסיות · ${formatBytes(doc.size)} · נוסף ${formatDate(doc.addedAt)}${doc.manifest ? ' · פורק לשאלות' : ''}</p>
      <div class="doc-progress">
        <span class="seg-known" style="width:${pct(progress.known)};background:var(--known)"></span>
        <span class="seg-partial" style="width:${pct(progress.partial)};background:var(--partial)"></span>
        <span class="seg-unknown" style="width:${pct(progress.unknown)};background:var(--unknown)"></span>
      </div>
      <div class="doc-card-actions">
        <button class="btn btn-primary btn-sm" data-action="open">פתח</button>
        <button class="btn-danger-text" data-action="delete">מחק</button>
      </div>
    `;
    row.querySelector('[data-action="open"]').addEventListener('click', () => openDocument(doc.id));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteDocument(doc.id, doc.name));
    els.docList.appendChild(row);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function handlePdfInput(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showBanner('נא לבחור קובץ PDF');
    return;
  }
  showBanner('טוען PDF…', 60000);
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const doc = {
      id: uid(),
      name: file.name.replace(/\.pdf$/i, ''),
      size: file.size,
      addedAt: Date.now(),
      pageCount: pdf.numPages,
      totalCards: pdf.numPages,
      manifest: null,
      blob: file,
    };
    await dbPut('documents', doc);
    state.pdfDocs.set(doc.id, pdf);
    els.banner.hidden = true;
    showBanner(`נוסף "${doc.name}" (${pdf.numPages} עמודים)`);
    await renderDocList();
    openDocument(doc.id);
  } catch (err) {
    console.error(err);
    showBanner('שגיאה בטעינת ה-PDF. ודאו שהקובץ תקין.');
  }
}

async function deleteDocument(docId, name) {
  if (!confirm(`למחוק את "${name}"? כל הסימונים וההתקדמות יימחקו לצמיתות.`)) return;
  const cards = await dbGetAllByIndex('cards', 'by_doc', docId);
  for (const c of cards) await dbDelete('cards', c.key);
  await dbDelete('documents', docId);
  state.pdfDocs.delete(docId);
  if (state.activeDocId === docId) {
    state.activeDocId = null;
    state.cardList = [];
    localStorage.removeItem(LAST_DOC_KEY);
  }
  await renderDocList();
  showBanner(`"${name}" נמחק`);
  if (state.tab === 'cards') renderCardsScreen();
}

async function openDocument(docId) {
  const doc = await getDoc(docId);
  if (!doc) return;
  state.activeDocId = docId;
  state.mode = 'doc';
  state.topicFilterId = null;
  state.cardList = docCardList(doc);
  state.cardIndex = 0;
  state.zoom = 1;
  localStorage.setItem(LAST_DOC_KEY, docId);
  switchTab('cards');
}

// ---------- PDF rendering ----------

async function getPdf(docId) {
  if (state.pdfDocs.has(docId)) return state.pdfDocs.get(docId);
  const doc = await getDoc(docId);
  if (!doc) throw new Error('missing doc');
  const buf = await doc.blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  state.pdfDocs.set(docId, pdf);
  return pdf;
}

async function renderPdfCard(item) {
  els.pdfLoading.hidden = false;
  try {
    const pdf = await getPdf(item.docId);
    const page = await pdf.getPage(item.page);
    const containerWidth = Math.max(els.pdfScroll.clientWidth - 24, 200);
    const base = page.getViewport({ scale: 1 });
    const fitScale = containerWidth / base.width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const renderScale = fitScale * state.zoom * dpr;
    const viewport = page.getViewport({ scale: renderScale });

    const off = document.createElement('canvas');
    off.width = Math.round(viewport.width);
    off.height = Math.round(viewport.height);
    await page.render({ canvasContext: off.getContext('2d'), viewport }).promise;

    const visible = els.pdfCanvas;
    const vctx = visible.getContext('2d');
    if (item.crop) {
      const sx = item.crop.x * off.width;
      const sy = item.crop.y * off.height;
      const sw = item.crop.w * off.width;
      const sh = item.crop.h * off.height;
      visible.width = Math.round(sw);
      visible.height = Math.round(sh);
      visible.style.width = `${sw / dpr}px`;
      visible.style.height = `${sh / dpr}px`;
      vctx.clearRect(0, 0, visible.width, visible.height);
      vctx.drawImage(off, sx, sy, sw, sh, 0, 0, visible.width, visible.height);
    } else {
      visible.width = off.width;
      visible.height = off.height;
      visible.style.width = `${off.width / dpr}px`;
      visible.style.height = `${off.height / dpr}px`;
      vctx.clearRect(0, 0, visible.width, visible.height);
      vctx.drawImage(off, 0, 0);
    }
  } catch (err) {
    console.error(err);
    showBanner('שגיאה בהצגת העמוד');
  } finally {
    els.pdfLoading.hidden = true;
  }
}

// ---------- Cards screen ----------

function renderTopicChips(card) {
  els.cardTopicChips.innerHTML = '';
  for (const topic of state.topics) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (card.topics.includes(topic.id) ? ' is-active' : '');
    chip.textContent = topic.name;
    chip.addEventListener('click', async () => {
      const has = card.topics.includes(topic.id);
      card.topics = has ? card.topics.filter((id) => id !== topic.id) : [...card.topics, topic.id];
      await saveCard(card);
      renderTopicChips(card);
    });
    els.cardTopicChips.appendChild(chip);
  }
}

function renderSteps(card) {
  els.stepsList.innerHTML = '';
  for (const step of card.steps) {
    const li = document.createElement('li');
    li.className = 'step-item' + (step.done ? ' is-done' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = step.done;
    cb.addEventListener('change', async () => {
      step.done = cb.checked;
      await saveCard(card);
      renderSteps(card);
    });
    const span = document.createElement('span');
    span.textContent = step.text;
    const del = document.createElement('button');
    del.className = 'step-remove';
    del.type = 'button';
    del.textContent = '✕';
    del.addEventListener('click', async () => {
      card.steps = card.steps.filter((s) => s.id !== step.id);
      await saveCard(card);
      renderSteps(card);
    });
    li.append(cb, span, del);
    els.stepsList.appendChild(li);
  }
}

function updateStatusButtons(card) {
  els.statusRow.querySelectorAll('.status-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.status === card.status);
  });
}

let currentCard = null;

async function renderCurrentCard() {
  if (!state.cardList.length) {
    els.cardsEmpty.hidden = false;
    els.cardsContent.hidden = true;
    return;
  }
  els.cardsEmpty.hidden = true;
  els.cardsContent.hidden = false;

  const item = state.cardList[state.cardIndex];
  els.cardPosition.textContent = `${state.cardIndex + 1} / ${state.cardList.length}`;
  els.cardLabel.textContent = item.label || `עמוד ${item.page}`;
  els.btnPrev.disabled = state.cardIndex === 0;
  els.btnNext.disabled = state.cardIndex === state.cardList.length - 1;

  const card = await getCardOrDefault(item.docId, item.cardId, item);
  currentCard = card;

  updateStatusButtons(card);
  renderTopicChips(card);
  renderSteps(card);
  els.cardNotes.value = card.notes || '';

  await renderPdfCard(item);
}

function moveCard(delta) {
  const next = state.cardIndex + delta;
  if (next < 0 || next >= state.cardList.length) return;
  state.cardIndex = next;
  renderCurrentCard();
}

async function handleManifestImport(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !state.activeDocId) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.questions)) throw new Error('bad schema');

    const doc = await getDoc(state.activeDocId);
    let imported = 0;
    for (const q of data.questions) {
      if (!q.id || !q.page) continue;
      const topicIds = [];
      for (const name of (q.topics || [])) {
        const t = await findOrCreateTopicByName(name);
        if (t) topicIds.push(t.id);
      }
      const card = await getCardOrDefault(doc.id, String(q.id), {
        page: q.page, crop: q.crop || null, label: q.label || null,
      });
      card.page = q.page;
      card.crop = q.crop || null;
      card.label = q.label || null;
      card.topics = Array.from(new Set([...card.topics, ...topicIds]));
      const existingStepTexts = new Set(card.steps.map((s) => s.text));
      for (const stepText of (q.steps || [])) {
        if (!existingStepTexts.has(stepText)) {
          card.steps.push({ id: uid(), text: stepText, done: false });
        }
      }
      await saveCard(card);
      imported++;
    }
    doc.manifest = data;
    doc.totalCards = data.questions.length;
    await dbPut('documents', doc);
    await refreshTopicsCache();

    state.cardList = docCardList(doc);
    state.cardIndex = 0;
    renderCurrentCard();
    showBanner(`יובאו ${imported} שאלות מפורקות`);
  } catch (err) {
    console.error(err);
    showBanner('שגיאה בקריאת קובץ הפירוק. ודאו שזהו JSON תקין במבנה הנכון.');
  }
}

// ---------- Topics screen ----------

async function renderTopicsScreen() {
  await refreshTopicsCache();
  const allTagged = await dbGetAll('cards');
  const taggedCount = allTagged.filter((c) => c.topics.length > 0).length;
  const knownCount = allTagged.filter((c) => c.status === 'known').length;
  els.topicsSummary.textContent = state.topics.length
    ? `${taggedCount} כרטיסיות מתויגות ב-${state.topics.length} נושאים · ${knownCount} מסומנות כידועות`
    : '';

  els.topicsEmpty.hidden = state.topics.length > 0;
  els.topicList.innerHTML = '';

  const sorted = [...state.topics].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  for (const topic of sorted) {
    const cards = await dbGetAllByIndex('cards', 'by_topic', topic.id);
    const counts = { known: 0, partial: 0, unknown: 0, unset: 0 };
    for (const c of cards) counts[c.status && counts[c.status] !== undefined ? c.status : 'unset']++;
    const total = cards.length;
    const pct = (n) => (total ? `${(n / total) * 100}%` : '0%');
    const pctKnown = total ? Math.round((counts.known / total) * 100) : 0;

    const row = document.createElement('div');
    row.className = 'topic-card';
    row.innerHTML = `
      <div class="topic-card-head">
        <span class="topic-card-name">${escapeHtml(topic.name)}</span>
        <button class="topic-delete" type="button" aria-label="מחק נושא">🗑️</button>
      </div>
      <div class="topic-progress">
        <span class="seg-known" style="width:${pct(counts.known)}"></span>
        <span class="seg-partial" style="width:${pct(counts.partial)}"></span>
        <span class="seg-unknown" style="width:${pct(counts.unknown)}"></span>
        <span class="seg-unset" style="width:${pct(counts.unset)}"></span>
      </div>
      <p class="topic-card-count">${total} שאלות מתויגות · ${pctKnown}% ידועות</p>
    `;
    row.addEventListener('click', (ev) => {
      if (ev.target.closest('.topic-delete')) return;
      enterTopicMode(topic, cards);
    });
    row.querySelector('.topic-delete').addEventListener('click', async () => {
      if (!confirm(`למחוק את הנושא "${topic.name}"? השאלות עצמן יישארו, רק התיוג יוסר.`)) return;
      for (const c of cards) {
        c.topics = c.topics.filter((id) => id !== topic.id);
        await saveCard(c);
      }
      await dbDelete('topics', topic.id);
      renderTopicsScreen();
    });
    els.topicList.appendChild(row);
  }
}

function enterTopicMode(topic, cards) {
  if (!cards.length) {
    showBanner(`אין עדיין שאלות מתויגות בנושא "${topic.name}"`);
    return;
  }
  state.mode = 'topic';
  state.topicFilterId = topic.id;
  state.topicFilterName = topic.name;
  state.cardList = cards.map((c) => ({ docId: c.docId, cardId: c.cardId, page: c.page, crop: c.crop, label: c.label }));
  state.cardIndex = 0;
  state.zoom = 1;
  switchTab('cards');
}

function exitTopicMode() {
  state.mode = 'doc';
  state.topicFilterId = null;
  if (state.activeDocId) {
    getDoc(state.activeDocId).then((doc) => {
      state.cardList = doc ? docCardList(doc) : [];
      state.cardIndex = 0;
      renderCardsScreen();
    });
  } else {
    state.cardList = [];
    renderCardsScreen();
  }
}

// ---------- Tabs ----------

function switchTab(tab) {
  state.tab = tab;
  for (const [name, el] of Object.entries(els.screens)) el.hidden = name !== tab;
  els.tabbar.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  });
  if (tab === 'documents') { els.appbarSubtitle.hidden = true; renderDocList(); }
  if (tab === 'cards') renderCardsScreen();
  if (tab === 'topics') { els.appbarSubtitle.hidden = true; renderTopicsScreen(); }
}

async function renderCardsScreen() {
  els.btnClearTopicFilter.hidden = state.mode !== 'topic';
  const manifestLabel = els.inputManifest.closest('label');
  if (manifestLabel) manifestLabel.hidden = state.mode !== 'doc' || !state.activeDocId;

  if (state.mode === 'topic') {
    els.appbarSubtitle.hidden = false;
    els.appbarSubtitle.textContent = `נושא: ${state.topicFilterName}`;
  } else if (state.activeDocId) {
    const doc = await getDoc(state.activeDocId);
    els.appbarSubtitle.hidden = false;
    els.appbarSubtitle.textContent = doc ? doc.name : '';
  } else {
    els.appbarSubtitle.hidden = true;
  }
  await renderCurrentCard();
}

// ---------- Wiring ----------

function wireEvents() {
  els.inputPdf.addEventListener('change', handlePdfInput);
  els.inputManifest.addEventListener('change', handleManifestImport);

  els.tabbar.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  els.btnPrev.addEventListener('click', () => moveCard(-1));
  els.btnNext.addEventListener('click', () => moveCard(1));

  els.btnZoomIn.addEventListener('click', () => {
    state.zoom = Math.min(3, state.zoom * 1.2);
    renderPdfCard(state.cardList[state.cardIndex]);
  });
  els.btnZoomOut.addEventListener('click', () => {
    state.zoom = Math.max(0.5, state.zoom / 1.2);
    renderPdfCard(state.cardList[state.cardIndex]);
  });

  els.btnClearTopicFilter.addEventListener('click', exitTopicMode);

  els.statusRow.querySelectorAll('.status-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!currentCard) return;
      const val = btn.dataset.status;
      currentCard.status = currentCard.status === val ? null : val;
      await saveCard(currentCard);
      updateStatusButtons(currentCard);
    });
  });

  els.formAddTopicInline.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = els.inputNewTopicInline.value.trim();
    if (!name || !currentCard) return;
    const topic = await findOrCreateTopicByName(name);
    els.inputNewTopicInline.value = '';
    if (topic && !currentCard.topics.includes(topic.id)) {
      currentCard.topics.push(topic.id);
      await saveCard(currentCard);
    }
    renderTopicChips(currentCard);
  });

  els.formAddStep.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = els.inputNewStep.value.trim();
    if (!text || !currentCard) return;
    currentCard.steps.push({ id: uid(), text, done: false });
    els.inputNewStep.value = '';
    await saveCard(currentCard);
    renderSteps(currentCard);
  });

  let notesTimer = null;
  els.cardNotes.addEventListener('input', () => {
    if (!currentCard) return;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(async () => {
      currentCard.notes = els.cardNotes.value;
      await saveCard(currentCard);
    }, 400);
  });

  els.btnAutoSplitInfo.addEventListener('click', () => {
    alert(
      'פירוק אוטומטי (בקרוב):\n\n' +
      'בשלב הבא, אפשר יהיה לבקש מקלוד לנתח את קובץ ה-PDF ולייצר קובץ JSON שמפרק כל עמוד לשאלות נפרדות עם נושאים ושלבי פתרון מוצעים. ' +
      'את הקובץ הזה מייבאים כאן דרך "ייבוא פירוק JSON".\n\n' +
      'בינתיים אפשר לפרק כל שאלה ידנית בעזרת "הוסיפו שלב" למטה.'
    );
  });

  els.formAddTopic.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = els.inputNewTopic.value.trim();
    if (!name) return;
    await findOrCreateTopicByName(name);
    els.inputNewTopic.value = '';
    renderTopicsScreen();
  });

  window.addEventListener('resize', () => {
    if (state.tab === 'cards' && state.cardList.length) renderPdfCard(state.cardList[state.cardIndex]);
  });
}

// ---------- Init ----------

async function init() {
  wireEvents();
  await ensureDefaultTopics();
  await renderDocList();

  const lastDocId = localStorage.getItem(LAST_DOC_KEY);
  if (lastDocId) {
    const doc = await getDoc(lastDocId);
    if (doc) {
      state.activeDocId = doc.id;
      state.cardList = docCardList(doc);
    } else {
      localStorage.removeItem(LAST_DOC_KEY);
    }
  }
  switchTab('documents');
}

init();
