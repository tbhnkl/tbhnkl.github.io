'use strict';

/* ---------- Config (mirrors the Android app's PitchDetector / AudioCapture) ---------- */

const MIN_FREQUENCY_HZ = 400;
const MAX_FREQUENCY_HZ = 10000;
const SILENCE_RMS_THRESHOLD = 0.012; // ~400/32768, scaled to Web Audio's [-1, 1] range
const CONFIDENCE_THRESHOLD = 0.6;
const FRAME_SIZE = 2048;
const WINDOW_MS = 500;
const MIN_SAMPLES_IN_WINDOW = 6;
const RECORD_DURATION_MS = 4000;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 20;
const RING_CIRCUMFERENCE = 326.7256; // 2 * PI * r, r=52 (see style.css)

/* ---------- Pitch detection: normalized autocorrelation with parabolic interpolation ---------- */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function detectFrequency(samples, sampleRate) {
  const n = samples.length;
  if (n < 4) return null;

  let mean = 0;
  for (let i = 0; i < n; i++) mean += samples[i];
  mean /= n;

  const buf = new Float64Array(n);
  let energy = 0;
  for (let i = 0; i < n; i++) {
    const v = samples[i] - mean;
    buf[i] = v;
    energy += v * v;
  }

  const rms = Math.sqrt(energy / n);
  if (rms < SILENCE_RMS_THRESHOLD) return null;

  const minLag = Math.max(1, Math.floor(sampleRate / MAX_FREQUENCY_HZ));
  const maxLag = Math.min(n - 1, Math.floor(sampleRate / MIN_FREQUENCY_HZ));
  if (maxLag <= minLag + 1) return null;

  const corrs = new Float64Array(maxLag - minLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < n - lag; i++) corr += buf[i] * buf[i + lag];
    corrs[lag - minLag] = corr;
  }

  let bestIndex = 0;
  for (let i = 1; i < corrs.length; i++) {
    if (corrs[i] > corrs[bestIndex]) bestIndex = i;
  }

  const bestCorr = corrs[bestIndex];
  const normalized = bestCorr / energy;
  if (normalized < CONFIDENCE_THRESHOLD) return null;

  let refinedLag;
  if (bestIndex > 0 && bestIndex < corrs.length - 1) {
    const y0 = corrs[bestIndex - 1];
    const y1 = corrs[bestIndex];
    const y2 = corrs[bestIndex + 1];
    const denom = y0 - 2 * y1 + y2;
    const offset = denom !== 0 ? clamp(0.5 * (y0 - y2) / denom, -1, 1) : 0;
    refinedLag = (minLag + bestIndex) + offset;
  } else {
    refinedLag = minLag + bestIndex;
  }

  if (refinedLag <= 0) return null;
  return sampleRate / refinedLag;
}

/* ---------- Microphone capture for one ~4s turn ---------- */

async function recordTurn(onLiveUpdate) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { error: 'unsupported' };
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
  } catch (err) {
    return { error: 'permission' };
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextCtor();
  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch (e) { /* ignore */ }
  }

  const sampleRate = audioCtx.sampleRate;
  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(FRAME_SIZE, 1, 1);
  const mute = audioCtx.createGain();
  mute.gain.value = 0;

  source.connect(processor);
  processor.connect(mute);
  mute.connect(audioCtx.destination);

  const recentPitches = [];
  let bestAverage = null;
  const startTime = performance.now();

  return new Promise((resolve) => {
    let stopped = false;

    function cleanup() {
      if (stopped) return;
      stopped = true;
      processor.onaudioprocess = null;
      try { source.disconnect(); } catch (e) { /* ignore */ }
      try { processor.disconnect(); } catch (e) { /* ignore */ }
      try { mute.disconnect(); } catch (e) { /* ignore */ }
      stream.getTracks().forEach((track) => track.stop());
      audioCtx.close().catch(() => {});
    }

    processor.onaudioprocess = (event) => {
      if (stopped) return;
      const input = event.inputBuffer.getChannelData(0);
      const now = performance.now() - startTime;
      const freq = detectFrequency(input, sampleRate);

      if (freq !== null) recentPitches.push({ t: now, freq });
      while (recentPitches.length && now - recentPitches[0].t > WINDOW_MS) recentPitches.shift();

      if (recentPitches.length >= MIN_SAMPLES_IN_WINDOW) {
        let sum = 0;
        for (const p of recentPitches) sum += p.freq;
        const avg = sum / recentPitches.length;
        if (bestAverage === null || avg > bestAverage) bestAverage = avg;
        onLiveUpdate(avg);
      } else {
        onLiveUpdate(null);
      }
    };

    setTimeout(() => {
      cleanup();
      resolve({ score: bestAverage });
    }, RECORD_DURATION_MS);
  });
}

/* ---------- App state ---------- */

const state = {
  phase: 'setup', // 'setup' | 'turn' | 'results'
  playerCount: 2,
  playerNames: ['שחקן 1', 'שחקן 2'],
  players: [],
  currentPlayerIndex: 0,
  isRecording: false,
  hasResult: false,
  lastResult: null
};

function defaultName(index) {
  return `שחקן ${index + 1}`;
}

/* ---------- DOM references ---------- */

const el = {
  banner: document.getElementById('banner'),

  screenSetup: document.getElementById('screen-setup'),
  playerCountValue: document.getElementById('player-count-value'),
  playerNamesContainer: document.getElementById('player-names'),
  btnCountMinus: document.getElementById('btn-count-minus'),
  btnCountPlus: document.getElementById('btn-count-plus'),
  btnStartCompetition: document.getElementById('btn-start-competition'),

  screenTurn: document.getElementById('screen-turn'),
  turnTitle: document.getElementById('turn-title'),
  turnIdle: document.getElementById('turn-idle'),
  turnRecording: document.getElementById('turn-recording'),
  turnResult: document.getElementById('turn-result'),
  liveFrequency: document.getElementById('live-frequency'),
  pitchRingProgress: document.getElementById('pitch-ring-progress'),
  turnResultLabel: document.getElementById('turn-result-label'),
  turnResultValue: document.getElementById('turn-result-value'),
  btnStartRecording: document.getElementById('btn-start-recording'),
  turnResultActions: document.getElementById('turn-result-actions'),
  btnRetry: document.getElementById('btn-retry'),
  btnNextPlayer: document.getElementById('btn-next-player'),

  screenResults: document.getElementById('screen-results'),
  resultsWinner: document.getElementById('results-winner'),
  resultsBody: document.getElementById('results-body'),
  btnRestart: document.getElementById('btn-restart')
};

let bannerTimeout = null;
function showBanner(message) {
  el.banner.textContent = message;
  el.banner.hidden = false;
  if (bannerTimeout) clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => { el.banner.hidden = true; }, 4000);
}

/* ---------- Setup screen ---------- */

function rebuildPlayerNameInputs() {
  el.playerNamesContainer.innerHTML = '';
  state.playerNames.forEach((name, index) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-name-input';
    input.placeholder = `שם שחקן ${index + 1}`;
    input.value = name;
    input.maxLength = 24;
    input.addEventListener('input', (e) => {
      state.playerNames[index] = e.target.value;
    });
    el.playerNamesContainer.appendChild(input);
  });
}

function setPlayerCount(count) {
  const clamped = clamp(count, MIN_PLAYERS, MAX_PLAYERS);
  const names = [];
  for (let i = 0; i < clamped; i++) {
    names.push(state.playerNames[i] || defaultName(i));
  }
  state.playerCount = clamped;
  state.playerNames = names;
  el.playerCountValue.textContent = String(clamped);
  rebuildPlayerNameInputs();
}

/* ---------- Turn / recording ---------- */

function startCompetition() {
  state.players = state.playerNames.map((name, i) => ({
    id: i,
    name: name.trim() ? name.trim() : defaultName(i),
    score: null
  }));
  state.currentPlayerIndex = 0;
  state.phase = 'turn';
  state.isRecording = false;
  state.hasResult = false;
  state.lastResult = null;
  render();
}

function triggerRingAnimation() {
  const ring = el.pitchRingProgress;
  ring.classList.remove('animating');
  ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
  // Force reflow so the animation restarts cleanly on every turn.
  void ring.getBoundingClientRect();
  ring.style.animationDuration = `${RECORD_DURATION_MS}ms`;
  ring.classList.add('animating');
}

async function startRecording() {
  if (state.isRecording) return;

  state.isRecording = true;
  state.hasResult = false;
  state.lastResult = null;
  render();
  triggerRingAnimation();

  const result = await recordTurn((freq) => {
    el.liveFrequency.textContent = freq !== null ? `${Math.round(freq)} הרץ` : '…';
  });

  if (result.error) {
    state.isRecording = false;
    render();
    const message = result.error === 'permission'
      ? 'האפליקציה צריכה גישה למיקרופון כדי לזהות את גובה הצפצוף'
      : 'הדפדפן שלכם לא תומך בהקלטת מיקרופון';
    showBanner(message);
    return;
  }

  const player = state.players[state.currentPlayerIndex];
  if (player) player.score = result.score;

  state.isRecording = false;
  state.hasResult = true;
  state.lastResult = result.score;
  render();
}

function nextPlayer() {
  const next = state.currentPlayerIndex + 1;
  if (next >= state.players.length) {
    state.phase = 'results';
  } else {
    state.currentPlayerIndex = next;
    state.hasResult = false;
    state.lastResult = null;
  }
  render();
}

function restart() {
  state.phase = 'setup';
  state.players = [];
  state.currentPlayerIndex = 0;
  state.isRecording = false;
  state.hasResult = false;
  state.lastResult = null;
  setPlayerCount(2);
  render();
}

/* ---------- Results ---------- */

function renderResults() {
  const ranked = [...state.players].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const winner = ranked.find((p) => p.score !== null) || null;

  el.resultsWinner.textContent = winner
    ? `🏆 ${winner.name} ניצח/ה עם ${Math.round(winner.score)} הרץ!`
    : 'אף אחד לא הצליח להפיק צליל ברור';

  el.resultsBody.innerHTML = '';
  ranked.forEach((player, index) => {
    const row = document.createElement('tr');
    if (winner && player.id === winner.id) row.classList.add('winner-row');

    const place = document.createElement('td');
    place.textContent = String(index + 1);

    const name = document.createElement('td');
    name.textContent = player.name;

    const freq = document.createElement('td');
    freq.className = 'align-end';
    freq.textContent = player.score !== null ? String(Math.round(player.score)) : '—';

    row.append(place, name, freq);
    el.resultsBody.appendChild(row);
  });
}

/* ---------- Render ---------- */

function render() {
  el.screenSetup.hidden = state.phase !== 'setup';
  el.screenTurn.hidden = state.phase !== 'turn';
  el.screenResults.hidden = state.phase !== 'results';

  if (state.phase === 'turn') {
    const player = state.players[state.currentPlayerIndex];
    const playerName = player ? player.name : '';
    const isLastPlayer = state.currentPlayerIndex === state.players.length - 1;

    el.turnTitle.textContent = `תור של ${playerName}`;

    el.turnIdle.hidden = !(!state.isRecording && !state.hasResult);
    el.turnRecording.hidden = !state.isRecording;
    el.turnResult.hidden = !(state.hasResult && !state.isRecording);

    el.btnStartRecording.hidden = state.isRecording || state.hasResult;
    el.turnResultActions.hidden = !(state.hasResult && !state.isRecording);

    if (state.isRecording) {
      el.liveFrequency.textContent = '…';
    }

    if (state.hasResult) {
      el.turnResultLabel.textContent = `התוצאה של ${playerName}`;
      if (state.lastResult !== null) {
        el.turnResultValue.hidden = false;
        el.turnResultValue.textContent = `${Math.round(state.lastResult)} הרץ`;
        el.turnResultValue.style.color = '';
      } else {
        el.turnResultValue.hidden = false;
        el.turnResultValue.textContent = 'לא זוהה צפצוף, נסו שוב';
        el.turnResultValue.style.color = 'var(--danger)';
      }
      el.btnNextPlayer.textContent = isLastPlayer ? 'לתוצאות הסופיות' : 'לשחקן הבא';
    }
  }

  if (state.phase === 'results') {
    renderResults();
  }
}

/* ---------- Wire up events ---------- */

el.btnCountMinus.addEventListener('click', () => setPlayerCount(state.playerCount - 1));
el.btnCountPlus.addEventListener('click', () => setPlayerCount(state.playerCount + 1));
el.btnStartCompetition.addEventListener('click', startCompetition);

el.btnStartRecording.addEventListener('click', startRecording);
el.btnRetry.addEventListener('click', startRecording);
el.btnNextPlayer.addEventListener('click', nextPlayer);

el.btnRestart.addEventListener('click', restart);

/* ---------- Init ---------- */

setPlayerCount(state.playerCount);
render();
