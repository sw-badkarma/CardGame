import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// !!! ÎNLOCUIEȘTE CU CONFIGURAȚIA TA DIN FIREBASE CONSOLE !!!
const firebaseConfig = {


    apiKey: "AIzaSyBwYwDQgLiSovFcjS2N_vaX0Wk7bw0MgYw",


    authDomain: "badkarma-game.firebaseapp.com",


    databaseURL: "https://badkarma-game-default-rtdb.asia-southeast1.firebasedatabase.app",


    projectId: "badkarma-game",


    storageBucket: "badkarma-game.firebasestorage.app",


    messagingSenderId: "952773829000",


    appId: "1:952773829000:web:763d6f38b3d8d4fc44da3d",


    measurementId: "G-B5NJD0W2ET"


  };

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const CARDS_DB = {
  strike: { name: "Atac", cost: 1, type: "attack", value: 8, desc: "Provoacă 8 daune." },
  defend: { name: "Apărare", cost: 1, type: "defense", value: 6, desc: "Oferă 6 Scut." },
  fireball: { name: "Foc", cost: 2, type: "attack", value: 16, desc: "Provoacă 16 daune." }
};

let currentRoomId = null;
let playerRole = null; // 'p1' sau 'p2'
let localHand = [];
let drawPile = [];
let discardPile = [];

const el = id => document.getElementById(id);

// --- LOGICĂ LOBBY ---
el('btn-create-room').onclick = () => {
  const roomId = Math.floor(1000 + Math.random() * 9000).toString();
  currentRoomId = roomId;
  playerRole = 'p1';

  const initialGameState = {
    status: 'waiting',
    turn: 'p1',
    lastAction: 'Așteptare Jucător 2...',
    p1: { hp: 80, shield: 0, energy: 3 },
    p2: { hp: 80, shield: 0, energy: 3 }
  };

  set(ref(db, `rooms/${roomId}`), initialGameState).then(() => {
    el('lobby-status').textContent = `Cameră creată! Cod: ${roomId}. Trimite-l prietenului!`;
    listenToRoom(roomId);
  });
};

el('btn-join-room').onclick = () => {
  const code = el('room-code-input').value.trim();
  if (code.length !== 4) {
    el('lobby-status').textContent = "Introdu un cod valid din 4 cifre!";
    return;
  }
  currentRoomId = code;
  playerRole = 'p2';

  update(ref(db, `rooms/${code}`), { status: 'in_game', lastAction: 'Jucătorul 2 s-a conectat! Tura lui P1.' })
    .then(() => {
      listenToRoom(code);
    })
    .catch(() => {
      el('lobby-status').textContent = "Camera nu există!";
    });
};

// --- SINCRONIZARE TIMP REAL ---
function listenToRoom(roomId) {
  onValue(ref(db, `rooms/${roomId}`), (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    if (data.status === 'in_game') {
      el('lobby-overlay').classList.add('hidden');
      el('game-container').classList.remove('hidden');
      el('room-id-display').textContent = roomId;

      if (localHand.length === 0 && drawPile.length === 0) {
        initLocalDeck();
      }

      updateUI(data);
    }
  });
}

function initLocalDeck() {
  drawPile = ["strike", "strike", "strike", "defend", "defend", "fireball"];
  shuffle(drawPile);
  drawCards(4);
}

function drawCards(n) {
  for (let i = 0; i < n; i++) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break;
      drawPile = [...discardPile];
      discardPile = [];
      shuffle(drawPile);
    }
    localHand.push(drawPile.pop());
  }
}

// --- LOGICĂ JOC MULTIPLAYER ---
function playCard(index, roomData) {
  if (roomData.turn !== playerRole) return;

  const cardKey = localHand[index];
  const card = CARDS_DB[cardKey];
  const myState = roomData[playerRole];

  if (myState.energy < card.cost) return;

  const opponentRole = playerRole === 'p1' ? 'p2' : 'p1';
  const oppState = roomData[opponentRole];

  let newMyEnergy = myState.energy - card.cost;
  let newMyShield = myState.shield;
  let newOppHp = oppState.hp;
  let newOppShield = oppState.shield;

  if (card.type === "attack") {
    let dmg = card.value;
    if (newOppShield > 0) {
      if (newOppShield >= dmg) { newOppShield -= dmg; dmg = 0; }
      else { dmg -= newOppShield; newOppShield = 0; }
    }
    newOppHp = Math.max(0, newOppHp - dmg);
  } else if (card.type === "defense") {
    newMyShield += card.value;
  }

  discardPile.push(localHand.splice(index, 1)[0]);

  const updates = {};
  updates[`rooms/${currentRoomId}/${playerRole}/energy`] = newMyEnergy;
  updates[`rooms/${currentRoomId}/${playerRole}/shield`] = newMyShield;
  updates[`rooms/${currentRoomId}/${opponentRole}/hp`] = newOppHp;
  updates[`rooms/${currentRoomId}/${opponentRole}/shield`] = newOppShield;
  updates[`rooms/${currentRoomId}/lastAction`] = `${playerRole.toUpperCase()} a jucat ${card.name}!`;

  if (newOppHp <= 0) {
    updates[`rooms/${currentRoomId}/status`] = 'ended';
    updates[`rooms/${currentRoomId}/lastAction`] = `Joc Încheiat! ${playerRole.toUpperCase()} a câștigat!`;
  }

  update(ref(db), updates);
}

function endTurn(roomData) {
  if (roomData.turn !== playerRole) return;

  const opponentRole = playerRole === 'p1' ? 'p2' : 'p1';
  discardPile.push(...localHand);
  localHand = [];
  drawCards(4);

  const updates = {};
  updates[`rooms/${currentRoomId}/turn`] = opponentRole;
  updates[`rooms/${currentRoomId}/${opponentRole}/energy`] = 3;
  updates[`rooms/${currentRoomId}/${opponentRole}/shield`] = 0; // Scutul se resetează la tura proprie
  updates[`rooms/${currentRoomId}/lastAction`] = `${playerRole.toUpperCase()} a încheiat tura. Este tura lui ${opponentRole.toUpperCase()}`;

  update(ref(db), updates);
}

function shuffle(arr) { arr.sort(() => Math.random() - 0.5); }

// --- RANDARE INTERFAȚĂ ---
function updateUI(data) {
  const isMyTurn = data.turn === playerRole;
  const me = data[playerRole];
  const opponent = data[playerRole === 'p1' ? 'p2' : 'p1'];

  el('p1-hp').textContent = me.hp;
  el('p1-shield').textContent = me.shield;
  el('p1-energy').textContent = me.energy;

  el('p2-hp').textContent = opponent.hp;
  el('p2-shield').textContent = opponent.shield;

  el('combat-log').textContent = data.lastAction;
  el('end-turn-btn').disabled = !isMyTurn;

  el('draw-count').textContent = drawPile.length;
  el('discard-count').textContent = discardPile.length;

  const handEl = el('hand-container');
  handEl.innerHTML = "";
  
  localHand.forEach((key, i) => {
    const card = CARDS_DB[key];
    const c = document.createElement('div');
    c.className = `card ${(!isMyTurn || me.energy < card.cost) ? 'disabled' : ''}`;
    c.innerHTML = `
      <div class="card-header"><span class="card-title">${card.name}</span><span class="card-cost">${card.cost}</span></div>
      <div class="card-desc">${card.desc}</div>
    `;
    c.onclick = () => playCard(i, data);
    handEl.appendChild(c);
  });

  el('end-turn-btn').onclick = () => endTurn(data);
}