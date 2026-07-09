'use strict';

const VERSION = '2.1.0';

// ===== KONSTANTY =====
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYM = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_NAME = { hearts: 'Srdce', diamonds: 'Káry', clubs: 'Kříže', spades: 'Piky' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_ORDER = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };
const AI_NAMES = ['Lily', 'Otto', 'Max', 'Mia', 'Hugo', 'Ema', 'Leo', 'Bruno', 'Viktor', 'Sára'];
const PLAYER_COLORS = ['#00ffcc', '#ff6b6b', '#ffd23f', '#8a7dff', '#4dd07a', '#ff9f43'];
const HAND_SIZE = 12;          // každý dostane 12, začínající hráč 13
const DISCARD_OPEN_ROUND = 4;  // z odhozu se dá brát až od 4. kola (po 3 dohraných kolech)

// ===== STAV HRY =====
let G = {};
let speed = 1;

function getDelay(base = 800) { return base / speed; }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function isJoker(c) { return !!c && c.joker; }
function isRed(c) { return c.suit === 'hearts' || c.suit === 'diamonds'; }
function rankVal(rank, aceHigh) { if (rank === 'A') return aceHigh ? 14 : 1; return RANK_ORDER[rank]; }
function cardPoints(c) {
  if (isJoker(c)) return 25;
  if (c.rank === 'A') return 11;
  if (['K', 'Q', 'J', '10'].includes(c.rank)) return 10;
  return parseInt(c.rank, 10);
}
function handPoints(p) { return p.hand.reduce((s, c) => s + cardPoints(c), 0); }

// ===== SETUP UI =====
setupBtnGroup('mode-btns', v => {
  document.getElementById('local-settings').classList.toggle('hidden', v !== 'local');
  document.getElementById('ai-settings').classList.toggle('hidden', v !== 'ai');
  document.getElementById('online-settings').classList.toggle('hidden', v !== 'online');
});
setupBtnGroup('player-count-btns', v => buildNameInputs(parseInt(v, 10)));
setupBtnGroup('ai-count-btns');
setupBtnGroup('ai-diff-btns');

function setupBtnGroup(id, onChange) {
  const container = document.getElementById(id);
  if (!container) return;
  container.addEventListener('click', e => {
    const btn = e.target.closest('.opt-btn');
    if (!btn) return;
    container.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    if (onChange) onChange(btn.dataset.value);
  });
}
function getSelected(id) {
  const btn = document.querySelector(`#${id} .opt-btn.selected`);
  return btn ? btn.dataset.value : null;
}
function buildNameInputs(count) {
  const container = document.getElementById('player-names-container');
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'name-row';
    row.innerHTML = `<label>Hráč ${i + 1}</label><input type="text" class="name-input player-name-inp" value="Hráč ${i + 1}">`;
    container.appendChild(row);
  }
}
buildNameInputs(2);

// Online sub-tabs (stub)
document.getElementById('online-create-btn').addEventListener('click', () => {
  document.getElementById('online-create-btn').classList.add('selected');
  document.getElementById('online-join-btn').classList.remove('selected');
  document.getElementById('online-create-panel').classList.remove('hidden');
  document.getElementById('online-join-panel').classList.add('hidden');
});
document.getElementById('online-join-btn').addEventListener('click', () => {
  document.getElementById('online-join-btn').classList.add('selected');
  document.getElementById('online-create-btn').classList.remove('selected');
  document.getElementById('online-join-panel').classList.remove('hidden');
  document.getElementById('online-create-panel').classList.add('hidden');
});
document.getElementById('do-create-room-btn').addEventListener('click', () => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  document.getElementById('room-code-text').textContent = code;
  document.getElementById('room-code-display').classList.remove('hidden');
  showToast('Online hra – přijde brzy! Zkus lokální nebo vs roboti.', true);
});
document.getElementById('do-join-room-btn').addEventListener('click', () => {
  showToast('Online hra – přijde brzy! Zkus lokální nebo vs roboti.', true);
});

// Start
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', startGame);
document.getElementById('back-setup-btn').addEventListener('click', () => showScreen('screen-setup'));
document.getElementById('menu-btn').addEventListener('click', () => showScreen('screen-setup'));

// Speed
document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    speed = parseInt(btn.dataset.speed, 10);
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});

// Draw / discard pile clicks
document.getElementById('draw-pile').addEventListener('click', () => humanDrawFromStock());
document.getElementById('discard-pile').addEventListener('click', () => humanTakeFromDiscard());

// ===== BALÍČEK =====
function buildDeck() {
  const deck = [];
  for (let d = 0; d < 2; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank, id: `${rank}_${suit}_${d}` });
      }
    }
  }
  for (let j = 1; j <= 4; j++) deck.push({ suit: null, rank: 'JKR', id: `JKR_${j}`, joker: true });
  return shuffle(deck);
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== INICIALIZACE HRY =====
function startGame() {
  const mode = getSelected('mode-btns') || 'ai';
  let players = [];

  if (mode === 'local') {
    const count = parseInt(getSelected('player-count-btns') || '2', 10);
    const inputs = document.querySelectorAll('.player-name-inp');
    for (let i = 0; i < count; i++) {
      const name = inputs[i] ? (inputs[i].value.trim() || `Hráč ${i + 1}`) : `Hráč ${i + 1}`;
      players.push(makePlayer(name, false, null, i));
    }
  } else {
    const humanName = document.getElementById('ai-player-name').value.trim() || 'TY';
    const aiCount = parseInt(getSelected('ai-count-btns') || '2', 10);
    const difficulty = getSelected('ai-diff-btns') || 'medium';
    const pool = shuffle([...AI_NAMES]);
    players.push(makePlayer(humanName, false, null, 0));
    for (let i = 0; i < aiCount; i++) {
      players.push(makePlayer(pool[i] || `Robot ${i + 1}`, true, difficulty, i + 1));
    }
    if (mode === 'online') showToast('Online zatím není – hraješ proti robotům.', true);
  }

  const deck = buildDeck();
  for (let i = 0; i < HAND_SIZE; i++) {
    for (const p of players) p.hand.push(deck.pop());
  }
  players[0].hand.push(deck.pop()); // začínající hráč má o kartu víc (13)
  players.forEach((p, i) => { p.color = PLAYER_COLORS[i % PLAYER_COLORS.length]; });

  G = {
    players,
    deck,
    discardPile: [],            // odhoz začíná prázdný – naplní ho první odhození začínajícího hráče
    tableMelds: [],
    meldSeq: 0,
    starterIdx: 0,
    round: 1,
    starterFirstPending: true,  // začínající hráč v 1. kole jen odhazuje, nebere si
    currentPlayerIdx: 0,
    phase: 'meld',
    hasDrawn: true,
    tookFromDiscardId: null,
    lastDrawnId: null,          // karta, kterou si hráč právě vzal (pro zvýraznění)
    selected: new Set(),
    winners: [],
    mode: mode === 'online' ? 'ai' : mode,
  };

  showScreen('none');
  sortHand(players[0]);
  startTurn();
}

function makePlayer(name, isAI, difficulty, idx) {
  return { name, isAI, difficulty, hand: [], opened: false, finished: false, finishPos: null, idx };
}

// ===== KDO SE DÍVÁ NA RUKU =====
function viewIdx() { return G.mode === 'local' ? G.currentPlayerIdx : 0; }
function isHumansInteractiveTurn() {
  const p = G.players[G.currentPlayerIdx];
  return p && !p.isAI && G.currentPlayerIdx === viewIdx();
}

// ===== VALIDACE SESTAV =====
function isSet(cards) {
  if (cards.length < 3 || cards.length > 4) return false;
  const jok = cards.filter(isJoker);
  if (jok.length > 1) return false;
  const nat = cards.filter(c => !isJoker(c));
  if (nat.length < 2) return false;
  const rank = nat[0].rank;
  if (!nat.every(c => c.rank === rank)) return false;
  const suits = nat.map(c => c.suit);
  return new Set(suits).size === suits.length;
}
function isRun(cards) {
  if (cards.length < 3) return false;
  const jok = cards.filter(isJoker);
  if (jok.length > 1) return false;
  const nat = cards.filter(c => !isJoker(c));
  if (nat.length < 2) return false;
  const suit = nat[0].suit;
  if (!nat.every(c => c.suit === suit)) return false;
  const jokers = jok.length;
  for (const aceHigh of [false, true]) {
    const vals = nat.map(c => rankVal(c.rank, aceHigh));
    if (new Set(vals).size !== vals.length) continue;
    const sorted = [...vals].sort((a, b) => a - b);
    const min = sorted[0], max = sorted[sorted.length - 1];
    const span = max - min;
    const internalGaps = span - (sorted.length - 1);
    if (internalGaps < 0 || internalGaps > jokers) continue;
    const jokersLeft = jokers - internalGaps;
    const highBound = aceHigh ? 14 : 13;
    if ((min - 1) + (highBound - max) >= jokersLeft) return true;
  }
  return false;
}
function meldType(cards) {
  if (isSet(cards)) return 'set';
  if (isRun(cards)) return 'run';
  return null;
}

// Uspořádání karet sestavy pro zobrazení
function orderMeld(cards, type) {
  if (type === 'set') {
    const nat = cards.filter(c => !isJoker(c)).sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
    const jok = cards.filter(isJoker);
    return [...nat, ...jok];
  }
  const jok = cards.filter(isJoker);
  const nat = cards.filter(c => !isJoker(c));
  const aceHigh = nat.some(c => c.rank === 'A') && nat.some(c => c.rank === 'K');
  const sorted = [...nat].sort((a, b) => rankVal(a.rank, aceHigh) - rankVal(b.rank, aceHigh));
  const result = [];
  const jk = [...jok];
  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (i < sorted.length - 1) {
      let gap = rankVal(sorted[i + 1].rank, aceHigh) - rankVal(sorted[i].rank, aceHigh) - 1;
      while (gap > 0 && jk.length) { result.push(jk.pop()); gap--; }
    }
  }
  while (jk.length) result.push(jk.pop());
  return result;
}

// ===== POMOCNÉ =====
function sortHand(p) {
  p.hand.sort((a, b) => {
    if (isJoker(a) && isJoker(b)) return 0;
    if (isJoker(a)) return 1;
    if (isJoker(b)) return -1;
    if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    return rankVal(a.rank, false) - rankVal(b.rank, false);
  });
}
function removeCardFromHand(p, card) {
  const i = p.hand.findIndex(c => c.id === card.id);
  if (i !== -1) p.hand.splice(i, 1);
}
function clearSelection() { G.selected = new Set(); }
function selectedCards() {
  const p = G.players[viewIdx()];
  return p.hand.filter(c => G.selected.has(c.id));
}
function reshuffleStock() {
  if (G.discardPile.length <= 1) return;
  const top = G.discardPile.pop();
  G.deck = shuffle(G.discardPile);
  G.discardPile = [top];
  showToast('Balíček byl znovu zamíchán.');
}

// ===== PRŮBĚH KOLA =====
function startTurn() {
  clearSelection();
  const p = G.players[G.currentPlayerIdx];
  const starterFirst = G.starterFirstPending && G.currentPlayerIdx === G.starterIdx;
  if (starterFirst) { G.phase = 'meld'; G.hasDrawn = true; }
  else { G.phase = 'draw'; G.hasDrawn = false; }
  G.tookFromDiscardId = null;
  G.lastDrawnId = null;
  if (p.isAI) { renderAll(); scheduleAiTurn(); return; }
  if (G.mode === 'local' && G.players.length > 1) {
    showPassOverlay(G.currentPlayerIdx, () => { sortHand(p); renderAll(); });
  } else {
    renderAll();
  }
}

function advanceTurn() {
  if (G.currentPlayerIdx === G.starterIdx) G.starterFirstPending = false;
  G.currentPlayerIdx = (G.currentPlayerIdx + 1) % G.players.length;
  if (G.currentPlayerIdx === G.starterIdx) G.round++;
}

function canTakeFromDiscard() { return G.round >= DISCARD_OPEN_ROUND; }

function checkFinish(idx) {
  const p = G.players[idx];
  if (p.hand.length === 0 && !p.finished) {
    p.finished = true;
    p.finishPos = 1;
    G.winners.push(idx);
    showToast(`${p.name} vyložil(a) všechny karty! 🏆`);
    endGame();
    return true;
  }
  return false;
}

function endGame() {
  const winner = G.players[G.winners[0]];
  const rest = G.players.filter(p => p.idx !== winner.idx)
    .sort((a, b) => handPoints(a) - handPoints(b));
  rest.forEach((p, i) => { p.finishPos = i + 2; });
  renderWin();
  showScreen('screen-win');
}

// ===== TAHY HRÁČE =====
function humanDrawFromStock() {
  if (!isHumansInteractiveTurn() || G.phase !== 'draw') return;
  if (G.deck.length === 0) reshuffleStock();
  if (G.deck.length === 0) { showToast('Balíček je prázdný.'); return; }
  const p = G.players[G.currentPlayerIdx];
  const card = G.deck.pop();
  p.hand.push(card);          // nová karta jde na konec ruky (ať je vidět), neřadíme automaticky
  G.lastDrawnId = card.id;
  G.hasDrawn = true;
  G.phase = 'meld';
  renderAll();
  revealDrawnCard(card, 'draw-pile');
}
function humanTakeFromDiscard() {
  if (!isHumansInteractiveTurn() || G.phase !== 'draw') return;
  if (G.discardPile.length === 0) return;
  if (!canTakeFromDiscard()) { showToast(`Z odhozu se dá brát až od ${DISCARD_OPEN_ROUND}. kola.`, true); return; }
  const p = G.players[G.currentPlayerIdx];
  const card = G.discardPile.pop();
  p.hand.push(card);
  G.lastDrawnId = card.id;
  G.tookFromDiscardId = card.id;
  G.hasDrawn = true;
  G.phase = 'meld';
  renderAll();
  revealDrawnCard(card, 'discard-pile');
}
function humanLayDown() {
  if (!isHumansInteractiveTurn() || G.phase !== 'meld') return;
  const sel = selectedCards();
  const type = meldType(sel);
  if (!type) { shakeHand(); showToast('Tohle není platná skupina ani postupka.', true); return; }
  const p = G.players[G.currentPlayerIdx];
  sel.forEach(c => removeCardFromHand(p, c));
  G.tableMelds.push({ id: ++G.meldSeq, type, cards: orderMeld(sel, type), ownerIdx: p.idx });
  p.opened = true;
  clearSelection();
  showToast('Vyloženo! 👍');
  if (!checkFinish(p.idx)) renderAll();
}
function humanLayOff(meldId) {
  if (!isHumansInteractiveTurn() || G.phase !== 'meld') return;
  const p = G.players[G.currentPlayerIdx];
  if (!p.opened) { showToast('Nejdřív musíš vyložit vlastní skupinu nebo postupku.', true); return; }
  const sel = selectedCards();
  if (sel.length === 0) return;
  const meld = G.tableMelds.find(m => m.id === meldId);
  if (!meld) return;
  const combined = [...meld.cards, ...sel];
  const type = meldType(combined);
  if (!type) { showToast('Tyhle karty sem nepasují.', true); return; }
  meld.cards = orderMeld(combined, type);
  meld.type = type;
  sel.forEach(c => removeCardFromHand(p, c));
  clearSelection();
  showToast('Přiloženo! 👍');
  if (!checkFinish(p.idx)) renderAll();
}
async function humanDiscard() {
  if (!isHumansInteractiveTurn() || G.phase !== 'meld') return;
  const sel = selectedCards();
  if (sel.length !== 1) { showToast('Vyber jednu kartu k odhození.', true); return; }
  const card = sel[0];
  if (card.id === G.tookFromDiscardId) {
    showToast('Tuhle kartu jsi právě vzal – odhoď jinou.', true);
    return;
  }
  const p = G.players[G.currentPlayerIdx];
  clearSelection();
  await animateDiscard(G.currentPlayerIdx, card);
  removeCardFromHand(p, card);
  G.discardPile.push(card);
  if (checkFinish(p.idx)) return;
  advanceTurn();
  startTurn();
}
function humanSort() {
  const p = G.players[viewIdx()];
  sortHand(p);
  renderAll();
}

// ===== AI =====
function scheduleAiTurn() {
  setTimeout(() => { aiTurn(); }, getDelay(700) + Math.random() * getDelay(300));
}

function extractMelds(cards) {
  let rem = [...cards];
  const melds = [];
  while (true) {
    const m = findBestMeld(rem);
    if (!m) break;
    melds.push(m);
    const ids = new Set(m.map(c => c.id));
    rem = rem.filter(c => !ids.has(c.id));
  }
  const meldedCount = melds.reduce((s, m) => s + m.length, 0);
  return { melds, leftover: rem, meldedCount };
}
function findBestMeld(cards) {
  const cands = candidateMelds(cards);
  if (cands.length === 0) return null;
  cands.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const ja = a.some(isJoker) ? 1 : 0, jb = b.some(isJoker) ? 1 : 0;
    return ja - jb;
  });
  return cands[0];
}
function candidateMelds(cards) {
  const cands = [];
  const jokers = cards.filter(isJoker);
  const oneJoker = jokers.length ? [jokers[0]] : [];
  const nat = cards.filter(c => !isJoker(c));

  // SETS
  const byRank = {};
  for (const c of nat) (byRank[c.rank] = byRank[c.rank] || []).push(c);
  for (const rank in byRank) {
    const seen = {}; const distinct = [];
    for (const c of byRank[rank]) if (!seen[c.suit]) { seen[c.suit] = 1; distinct.push(c); }
    if (distinct.length >= 3) cands.push(distinct.slice(0, 4));
    else if (distinct.length === 2 && oneJoker.length) cands.push([...distinct, ...oneJoker]);
  }
  // RUNS
  for (const suit of SUITS) {
    const cs = nat.filter(c => c.suit === suit);
    cands.push(...runCandidates(cs, oneJoker));
  }
  return cands.filter(m => m.length >= 3 && meldType(m));
}
function runCandidates(cs, jokerArr) {
  const out = [];
  const pick = {};
  for (const c of cs) {
    const vl = rankVal(c.rank, false);
    if (!pick[vl]) pick[vl] = c;
    if (c.rank === 'A' && !pick[14]) pick[14] = c;
  }
  for (let start = 1; start <= 14; start++) {
    for (let end = start + 2; end <= 14; end++) {
      const need = []; let missing = 0; const used = new Set();
      for (let v = start; v <= end; v++) {
        const c = pick[v];
        if (c && !used.has(c.id)) { need.push(c); used.add(c.id); }
        else missing++;
      }
      if (missing === 0) out.push(need);
      else if (missing === 1 && jokerArr.length) out.push([...need, ...jokerArr]);
    }
  }
  return out;
}

function aiWantsDiscard(p, top) {
  if (!canTakeFromDiscard()) return false;
  if (isJoker(top)) return true;
  const before = extractMelds(p.hand).meldedCount;
  const after = extractMelds([...p.hand, top]).meldedCount;
  if (after > before) return true;
  if (p.opened) {
    for (const m of G.tableMelds) if (meldType([...m.cards, top])) return true;
  }
  return false;
}
function aiLayDown(p) {
  if (p.difficulty === 'easy' && !p.opened && Math.random() < 0.35) return;
  const ex = extractMelds(p.hand);
  for (const m of ex.melds) {
    const type = meldType(m);
    if (!type) continue;
    m.forEach(c => removeCardFromHand(p, c));
    G.tableMelds.push({ id: ++G.meldSeq, type, cards: orderMeld(m, type), ownerIdx: p.idx });
    p.opened = true;
  }
}
function aiLayOff(p) {
  if (!p.opened) return;
  let changed = true;
  while (changed && p.hand.length > 1) {
    changed = false;
    for (const c of [...p.hand]) {
      if (isJoker(c)) continue;
      for (const m of G.tableMelds) {
        const type = meldType([...m.cards, c]);
        if (type) {
          m.cards = orderMeld([...m.cards, c], type);
          m.type = type;
          removeCardFromHand(p, c);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
}
function aiChooseDiscard(p) {
  const pool = p.hand.filter(c => !isJoker(c));
  const list = pool.length ? pool : p.hand;
  const potential = c => {
    let pt = 0;
    for (const o of p.hand) {
      if (o.id === c.id || isJoker(o)) continue;
      if (o.rank === c.rank) pt += 2;
      if (o.suit === c.suit && Math.abs(rankVal(o.rank, false) - rankVal(c.rank, false)) <= 2) pt += 1;
    }
    return pt;
  };
  let best = list[0], bestScore = -Infinity;
  for (const c of list) {
    const score = cardPoints(c) - potential(c) * 3;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

async function aiTurn() {
  const idx = G.currentPlayerIdx;
  const p = G.players[idx];
  if (!p || !p.isAI) return;

  await delay(getDelay(450));
  // DRAW (začínající hráč v 1. kole si nebere)
  const starterFirst = G.starterFirstPending && idx === G.starterIdx;
  if (!starterFirst) {
    const top = G.discardPile[G.discardPile.length - 1];
    if (top && aiWantsDiscard(p, top)) {
      G.discardPile.pop();
      p.hand.push(top);
      showToast(`${p.name} bere z odhozu.`);
    } else {
      if (G.deck.length === 0) reshuffleStock();
      if (G.deck.length) p.hand.push(G.deck.pop());
      showToast(`${p.name} bere z balíčku.`);
    }
    G.hasDrawn = true;
    renderAll();
    await delay(getDelay(550));
  }

  // MELD + LAY OFF
  aiLayDown(p);
  aiLayOff(p);
  renderAll();
  await delay(getDelay(350));

  if (p.hand.length === 0) { checkFinish(idx); return; }

  // DISCARD
  const card = aiChooseDiscard(p);
  await animateDiscard(idx, card);
  removeCardFromHand(p, card);
  G.discardPile.push(card);
  showToast(`${p.name} odhazuje.`);
  if (checkFinish(idx)) return;
  advanceTurn();
  startTurn();
}

// ===== ANIMACE =====
async function animateDiscard(playerIdx, card) {
  const discardEl = document.getElementById('discard-pile');
  let fromRect;
  if (playerIdx === viewIdx()) {
    const el = [...document.querySelectorAll('#my-hand .card')].find(e => e.dataset.id === card.id);
    fromRect = el ? el.getBoundingClientRect() : discardEl.getBoundingClientRect();
  } else {
    const slot = document.querySelector(`.player-slot[data-pid="${playerIdx}"]`);
    fromRect = slot ? slot.getBoundingClientRect() : { left: window.innerWidth / 2, top: 120 };
  }
  const toRect = discardEl.getBoundingClientRect();
  const proxy = document.createElement('div');
  proxy.className = `card-proxy ${cardTxtClass(card)}`;
  proxy.innerHTML = cardFace(card);
  const dur = Math.max(getDelay(380), 160);
  proxy.style.transitionDuration = (dur / 1000) + 's';
  proxy.style.transitionProperty = 'left,top,transform,opacity';
  proxy.style.left = fromRect.left + 'px';
  proxy.style.top = fromRect.top + 'px';
  proxy.style.opacity = '1';
  document.body.appendChild(proxy);
  proxy.getBoundingClientRect();
  const rot = (Math.random() * 12) - 6;
  proxy.style.left = toRect.left + 'px';
  proxy.style.top = toRect.top + 'px';
  proxy.style.transform = `rotate(${rot}deg)`;
  await delay(dur + 40);
  proxy.remove();
}

// Odhalení karty, kterou si hráč právě vzal: vyletí z hromádky, zvětší se
// (ať je jasně vidět, co to je), pak doletí do ruky a zmizí.
function revealDrawnCard(card, fromId) {
  const fromEl = document.getElementById(fromId);
  if (!fromEl) return;
  const fromRect = fromEl.getBoundingClientRect();
  const proxy = document.createElement('div');
  proxy.className = `card-proxy draw-reveal ${cardTxtClass(card)}`;
  proxy.innerHTML = cardFace(card);
  proxy.style.left = fromRect.left + 'px';
  proxy.style.top = fromRect.top + 'px';
  proxy.style.opacity = '1';
  document.body.appendChild(proxy);
  proxy.getBoundingClientRect();
  const step = Math.max(getDelay(420), 200);
  proxy.style.transitionDuration = (step / 1000) + 's';
  proxy.style.transitionProperty = 'left,top,transform,opacity';
  proxy.style.left = (window.innerWidth / 2 - fromRect.width / 2) + 'px';
  proxy.style.top = (window.innerHeight * 0.4) + 'px';
  proxy.style.transform = 'scale(2.1)';
  const hold = Math.max(getDelay(700), 350);
  setTimeout(() => {
    const hand = document.getElementById('my-hand');
    const target = hand && ([...hand.querySelectorAll('.card')].find(e => e.dataset.id === card.id) || hand);
    const tr = target ? target.getBoundingClientRect() : fromRect;
    proxy.style.left = tr.left + 'px';
    proxy.style.top = tr.top + 'px';
    proxy.style.transform = 'scale(1)';
    proxy.style.opacity = '0';
    setTimeout(() => proxy.remove(), step + 80);
  }, step + hold);
}

// ===== RENDER =====
function cardFace(c) {
  if (isJoker(c)) return `<span class="c-rank">🃏</span><span class="c-suit">JOK</span>`;
  return `<span class="c-rank">${c.rank}</span><span class="c-suit">${SUIT_SYM[c.suit]}</span>`;
}
function cardTxtClass(c) { return isJoker(c) ? 'joker-card' : (isRed(c) ? 'txt-red' : 'txt-black'); }

function renderAll() {
  if (!G.players || G.players.length === 0) return;
  renderOpponents();
  renderTable();
  renderBottom();
  renderTopBar();
}

function renderOpponents() {
  const strip = document.getElementById('opponents-strip');
  strip.innerHTML = '';
  G.players.forEach((p, i) => {
    if (i === viewIdx()) return;
    const slot = document.createElement('div');
    const active = G.currentPlayerIdx === i;
    slot.className = `player-slot${active ? ' active-player' : ''}`;
    slot.dataset.pid = i;
    const col = p.color || '#888';
    const n = Math.min(p.hand.length, 15);
    const mini = Array.from({ length: n }, () => `<div class="mini-card" style="border-color:${col}"></div>`).join('');
    slot.innerHTML = `<div class="player-info" style="border-color:${col};${active ? `box-shadow:0 0 16px ${col}99;background:${col}22` : ''}">
      <div class="player-name-label" style="color:${col}">${esc(p.name)}${p.isAI ? ' 🤖' : ''}</div>
      <div class="player-cards-row">${mini}</div>
      <div class="player-extra">${p.hand.length} karet</div>
      ${p.opened ? `<div class="player-opened" style="color:${col}">✔ vyloženo</div>` : ''}
    </div>`;
    strip.appendChild(slot);
  });
}

function renderTable() {
  // Balíček
  document.getElementById('deck-count-label').textContent = `${G.deck.length} v balíčku`;
  const drawPile = document.getElementById('draw-pile');
  drawPile.classList.toggle('can-draw', isHumansInteractiveTurn() && G.phase === 'draw');

  // Odhoz
  const discardEl = document.getElementById('discard-pile');
  discardEl.innerHTML = '';
  const top = G.discardPile[G.discardPile.length - 1];
  if (top) {
    const d = document.createElement('div');
    d.className = `discard-card ${cardTxtClass(top)}`;
    d.innerHTML = cardFace(top);
    discardEl.appendChild(d);
  }
  const lbl = document.createElement('div');
  lbl.className = 'discard-label';
  lbl.textContent = 'odhoz';
  discardEl.appendChild(lbl);
  discardEl.classList.toggle('can-take', isHumansInteractiveTurn() && G.phase === 'draw' && !!top && canTakeFromDiscard());

  // Vyložené sestavy
  const list = document.getElementById('melds-list');
  const hint = document.getElementById('melds-empty-hint');
  list.innerHTML = '';
  hint.classList.toggle('hidden', G.tableMelds.length > 0);

  const sel = isHumansInteractiveTurn() ? selectedCards() : [];
  const canLayOff = isHumansInteractiveTurn() && G.phase === 'meld' && sel.length > 0 && G.players[G.currentPlayerIdx].opened;

  G.tableMelds.forEach(m => {
    const el = document.createElement('div');
    el.className = 'meld';
    const owner = G.players.find(pl => pl.idx === m.ownerIdx);
    const col = owner && owner.color ? owner.color : '#888';
    el.style.setProperty('--meld-color', col);
    let isTarget = false;
    if (canLayOff && meldType([...m.cards, ...sel])) { isTarget = true; el.classList.add('layoff-target'); }
    const cardsHtml = m.cards.map(c =>
      `<div class="mini-play-card ${cardTxtClass(c)}">
        <span class="mp-rank">${isJoker(c) ? '🃏' : c.rank}</span>
        <span class="mp-suit">${isJoker(c) ? '' : SUIT_SYM[c.suit]}</span>
      </div>`).join('');
    el.innerHTML = `<div class="meld-cards">${cardsHtml}</div><div class="meld-owner">${esc(owner ? owner.name : '')}</div>`;
    if (isTarget) el.addEventListener('click', () => humanLayOff(m.id));
    list.appendChild(el);
  });
}

function renderBottom() {
  const p = G.players[viewIdx()];
  const myTurn = isHumansInteractiveTurn();

  // Info řádek
  const col = p.color || 'var(--accent)';
  const slotC = document.getElementById('my-player-slot-container');
  slotC.innerHTML = `<div class="player-slot${myTurn ? ' active-player' : ''}">
    <div class="player-info" style="border-color:${col};${myTurn ? `box-shadow:0 0 14px ${col}88` : ''}">
      <div class="player-name-label" style="color:${col}">${esc(p.name)}</div>
      <div class="player-extra">${p.hand.length} karet${p.opened ? ' · ✔ vyloženo' : ''}</div>
    </div></div>`;

  // Ruka
  const hand = document.getElementById('my-hand');
  hand.innerHTML = '';
  p.hand.forEach(c => {
    const el = document.createElement('div');
    el.className = `card ${cardTxtClass(c)}${G.selected.has(c.id) ? ' selected' : ''}${c.id === G.lastDrawnId ? ' just-drawn' : ''}`;
    el.dataset.id = c.id;
    el.innerHTML = cardFace(c);
    if (myTurn) {
      el.addEventListener('pointerdown', e => onCardPointerDown(e, c));
    } else {
      el.classList.add('disabled');
    }
    hand.appendChild(el);
  });

  // Akční tlačítka
  const area = document.getElementById('action-area');
  area.innerHTML = '';
  const hintEl = document.getElementById('turn-hint');

  if (!myTurn) {
    hintEl.textContent = G.players[G.currentPlayerIdx].isAI ? 'Na tahu je robot…' : 'Čekej na svůj tah.';
    if (viewIdx() === G.currentPlayerIdx) hintEl.textContent = '';
    area.appendChild(makeBtn('Seřadit karty', false, humanSort));
    return;
  }

  const starterFirst = G.starterFirstPending && G.currentPlayerIdx === G.starterIdx;

  if (G.phase === 'draw') {
    hintEl.textContent = canTakeFromDiscard()
      ? 'Vezmi si kartu z balíčku nebo z odhozu. Karty si můžeš přetáhnout a uspořádat.'
      : `Vezmi si kartu z balíčku. (Z odhozu až od ${DISCARD_OPEN_ROUND}. kola.) Karty si můžeš přetáhnout.`;
    area.appendChild(makeBtn('Vzít z balíčku', 'primary pulse', humanDrawFromStock));
    const top = G.discardPile[G.discardPile.length - 1];
    if (top && canTakeFromDiscard()) area.appendChild(makeBtn(`Vzít z odhozu`, false, humanTakeFromDiscard));
  } else {
    hintEl.textContent = starterFirst
      ? 'Začínáš – uspořádej si karty (přetáhni je), pak vylož sestavu a jednu kartu odhoď.'
      : 'Klepni na karty (vyber sestavu), přetažením je přeskupíš. Vylož, přilož, nebo odhoď.';
    const sel = selectedCards();
    const canLay = sel.length >= 3 && !!meldType(sel);
    area.appendChild(makeBtn('Vyložit', canLay ? 'primary' : false, humanLayDown, !canLay));
    const canDiscard = sel.length === 1;
    area.appendChild(makeBtn('Odhodit', canDiscard ? 'primary' : false, humanDiscard, !canDiscard));
    area.appendChild(makeBtn('Seřadit', false, humanSort));
  }
}

function makeBtn(label, cls, handler, disabled) {
  const b = document.createElement('button');
  b.className = 'btn-action' + (cls ? ' ' + cls : '');
  b.textContent = label;
  if (disabled) b.disabled = true;
  else b.addEventListener('click', handler);
  return b;
}

function toggleSelect(id) {
  if (G.selected.has(id)) G.selected.delete(id);
  else G.selected.add(id);
  renderAll();
}

// ===== PŘETAHOVÁNÍ KARET V RUCE (klepnutí = výběr, tažení = přesun) =====
let dragState = null;
function onCardPointerDown(e, card) {
  if (!isHumansInteractiveTurn()) return;
  if (e.button !== undefined && e.button !== 0) return;
  const el = e.currentTarget;
  dragState = { card, el, startX: e.clientX, startY: e.clientY, moved: false, clone: null, offX: 0, offY: 0 };
  const move = ev => onCardPointerMove(ev);
  const up = ev => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    onCardPointerUp(ev);
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}
function onCardPointerMove(ev) {
  if (!dragState) return;
  const dx = ev.clientX - dragState.startX, dy = ev.clientY - dragState.startY;
  if (!dragState.moved && Math.hypot(dx, dy) > 8) {
    dragState.moved = true;
    const r = dragState.el.getBoundingClientRect();
    const clone = dragState.el.cloneNode(true);
    clone.className = 'card ' + (dragState.card.joker ? 'joker-card' : (isRed(dragState.card) ? 'txt-red' : 'txt-black')) + ' drag-clone';
    clone.style.width = r.width + 'px';
    clone.style.height = r.height + 'px';
    clone.style.left = r.left + 'px';
    clone.style.top = r.top + 'px';
    document.body.appendChild(clone);
    dragState.clone = clone;
    dragState.offX = dragState.startX - r.left;
    dragState.offY = dragState.startY - r.top;
    dragState.el.classList.add('dragging');
  }
  if (dragState.moved) {
    ev.preventDefault();
    dragState.clone.style.left = (ev.clientX - dragState.offX) + 'px';
    dragState.clone.style.top = (ev.clientY - dragState.offY) + 'px';
  }
}
function onCardPointerUp(ev) {
  if (!dragState) return;
  const ds = dragState;
  dragState = null;
  if (ds.clone) ds.clone.remove();
  if (ds.el) ds.el.classList.remove('dragging');
  if (!ds.moved) { toggleSelect(ds.card.id); return; }   // nepohnul = klepnutí = výběr
  const p = G.players[viewIdx()];
  const from = p.hand.findIndex(c => c.id === ds.card.id);
  if (from === -1) { renderAll(); return; }
  let target = handDropIndex(ev.clientX, ev.clientY);
  const [moved] = p.hand.splice(from, 1);
  if (target > from) target -= 1;
  target = Math.max(0, Math.min(target, p.hand.length));
  p.hand.splice(target, 0, moved);
  renderAll();
}
function handDropIndex(x, y) {
  const cards = [...document.querySelectorAll('#my-hand .card')];
  let best = cards.length, bestDist = Infinity;
  cards.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const d = Math.hypot(x - cx, y - cy);
    if (d < bestDist) { bestDist = d; best = (x < cx) ? i : i + 1; }
  });
  return best;
}

function renderTopBar() {
  const p = G.players[G.currentPlayerIdx];
  document.getElementById('round-num').textContent = `Kolo ${G.round}`;
  const pill = document.getElementById('phase-pill');
  const what = G.phase === 'draw' ? 'bere kartu' : 'skládá';
  pill.textContent = p ? `${p.name}: ${what}` : '';
}

function renderWin() {
  const winner = G.players[G.winners[0]];
  document.getElementById('win-title').textContent = `${winner.name} vyhrál(a)! 🏆`;
  const standings = document.getElementById('standings');
  standings.innerHTML = '';
  const medals = ['🥇', '🥈', '🥉'];
  const sorted = [...G.players].sort((a, b) => (a.finishPos || 99) - (b.finishPos || 99));
  sorted.forEach(p => {
    const row = document.createElement('div');
    row.className = 'standing-row';
    const pts = p.finishPos === 1 ? 'vítěz' : `${handPoints(p)} trestných bodů`;
    row.innerHTML = `<span class="s-pos">${medals[p.finishPos - 1] || (p.finishPos + '.')}</span>
      <span class="s-name">${esc(p.name)}</span>
      <span class="s-cards">${pts}</span>`;
    standings.appendChild(row);
  });
}

// ===== PŘEDEJ ZAŘÍZENÍ =====
function showPassOverlay(nextPlayerIdx, callback) {
  const overlay = document.getElementById('pass-overlay');
  document.getElementById('pass-player-name').textContent = G.players[nextPlayerIdx].name;
  overlay.classList.remove('hidden');
  const btn = document.getElementById('pass-ready-btn');
  const handler = () => {
    btn.removeEventListener('click', handler);
    overlay.classList.add('hidden');
    callback();
  };
  btn.addEventListener('click', handler);
}

// ===== OBRAZOVKY / TOASTY / UTIL =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  if (id !== 'none') {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }
}
function showToast(msg, warn) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast' + (warn ? ' warn' : '');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
function shakeHand() {
  const hand = document.getElementById('my-hand');
  hand.style.animation = 'none';
  void hand.offsetHeight;
  hand.style.animation = 'shake 0.3s ease';
  setTimeout(() => hand.style.animation = '', 400);
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Verze
const verEl = document.getElementById('app-version');
if (verEl) verEl.textContent = `v${VERSION}`;
