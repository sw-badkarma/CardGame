import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const auth = getAuth(app);

let currentFirebaseUser = null;

// --- SISTEM DE REALIZĂRI (ACHIEVEMENTS) & ASCENSIUNE ---
let playerAchievements = {
  shield_master: { name: "🛡️ Maestrul Scutului", desc: "Acumulează 50 Scut într-o singură luptă.", unlocked: false },
  vampire_lord: { name: "🧛 Lordul Vampir", desc: "Câștigă o luptă având sub 15 HP.", unlocked: false },
  century_club: { name: "⭐ Călătorul", desc: "Atinge nivelul 100 în Aventura Solo.", unlocked: false },
  ascension_hero: { name: "👑 Ascensiune Divină", desc: "Deblocează Modul Ascensiune (New Game+).", unlocked: false }
};

let ascensionLevel = 0;

function checkAchievement(key) {
  if (playerAchievements[key] && !playerAchievements[key].unlocked) {
    playerAchievements[key].unlocked = true;
    showNotification(`🏅 Realizare Deblocată: ${playerAchievements[key].name}`);
    saveCloudProgress();
  }
}

function showNotification(msg) {
  const note = document.createElement('div');
  note.className = "achievement-toast";
  note.textContent = msg;
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 3500);
}

const el = id => document.getElementById(id);

if(el('btn-open-achievements')) {
  el('btn-open-achievements').onclick = () => {
    const container = el('achievements-container');
    if(!container) return;
    container.innerHTML = "";
    Object.keys(playerAchievements).forEach(k => {
      const ac = playerAchievements[k];
      const div = document.createElement('div');
      div.className = "talent-item";
      div.innerHTML = `
        <div class="shop-card-info">
          <div class="shop-card-title">${ac.name}</div>
          <div class="shop-card-desc">${ac.desc}</div>
        </div>
        <div style="font-weight: bold; color: ${ac.unlocked ? '#10b981' : '#64748b'};">${ac.unlocked ? '✅ Deblocat' : '🔒 Blocat'}</div>
      `;
      container.appendChild(div);
    });
    el('achievements-overlay').classList.remove('hidden');
    setTimeout(() => el('achievements-overlay').classList.add('active'), 20);
  };
}

if(el('btn-close-achievements')) {
  el('btn-close-achievements').onclick = () => {
    el('achievements-overlay').classList.remove('active');
    setTimeout(() => el('achievements-overlay').classList.add('hidden'), 250);
  };
}

function switchScreen(hideId, showId) {
  const hideEl = document.getElementById(hideId);
  const showEl = document.getElementById(showId);
  if (hideEl) { hideEl.classList.remove('active'); setTimeout(() => hideEl.classList.add('hidden'), 250); }
  if (showEl) { showEl.classList.remove('hidden'); setTimeout(() => showEl.classList.add('active'), 20); }
}

const authOverlay = document.getElementById('auth-overlay');
const authStatus = document.getElementById('auth-status');
const lobbyOverlay = document.getElementById('lobby-overlay');

onAuthStateChanged(auth, (user) => {
  currentFirebaseUser = user;
  if (user) {
    if(authOverlay) authOverlay.classList.add('hidden');
    if(lobbyOverlay) { lobbyOverlay.classList.remove('hidden'); lobbyOverlay.classList.add('active'); }
    const emailName = user.email.split('@')[0];
    playerName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
    if(document.getElementById('player-name-input')) document.getElementById('player-name-input').value = playerName;
    loadCloudProgress(user.uid);
  } else {
    if(authOverlay) {
      authOverlay.classList.remove('hidden');
      authOverlay.classList.add('active');
    }
  }
});

function saveCloudProgress() {
  if (!currentFirebaseUser) { saveSoloProgress(); return; }
  const saveData = {
    level: currentStageLevel,
    coins: playerCoins,
    xp: playerXP,
    talents: playerTalents,
    deck: playerDeck,
    relics: playerRelics,
    name: playerName,
    avatar: selectedAvatar,
    heroClass: selectedClass,
    achievements: playerAchievements,
    ascension: ascensionLevel,
    lastUpdated: Date.now()
  };
  set(ref(db, `users/${currentFirebaseUser.uid}/save`), saveData);
  set(ref(db, `leaderboard/${currentFirebaseUser.uid}`), {
    name: playerName + (ascensionLevel > 0 ? ` [A${ascensionLevel}]` : ''),
    level: currentStageLevel,
    avatar: selectedAvatar
  });
}

function loadCloudProgress(uid) {
  get(ref(db, `users/${uid}/save`)).then((snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      currentStageLevel = data.level || 1;
      playerCoins = data.coins || 0;
      playerXP = data.xp || 0;
      playerTalents = data.talents || playerTalents;
      playerDeck = data.deck || playerDeck;
      playerRelics = data.relics || playerRelics;
      if (data.achievements) playerAchievements = data.achievements;
      if (data.ascension) ascensionLevel = data.ascension;
      if (data.name) playerName = data.name;
      if (data.avatar) selectedAvatar = data.avatar;
      if (data.heroClass) selectedClass = data.heroClass;

      if(el('lobby-xp')) el('lobby-xp').textContent = playerXP;
      if(currentStageLevel > 1 && el('btn-continue-solo')) {
        el('btn-continue-solo').classList.remove('hidden');
        el('btn-continue-solo').textContent = `▶️ Continuă Solo (Lvl ${currentStageLevel} ${ascensionLevel > 0 ? '| Ascensiune ' + ascensionLevel : ''})`;
      }
    } else {
      checkSaveFile();
    }
  });
}

if(el('btn-close-auth')) {
  el('btn-close-auth').onclick = () => {
    if(authOverlay) {
      authOverlay.classList.remove('active');
      setTimeout(() => authOverlay.classList.add('hidden'), 250);
    }
    // Afișează corect ecranul de Lobby în mod offline
    if(lobbyOverlay) {
      lobbyOverlay.classList.remove('hidden');
      setTimeout(() => lobbyOverlay.classList.add('active'), 20);
    }
    const warn = document.getElementById('offline-warning-overlay');
    if(warn) {
      warn.classList.remove('hidden');
      setTimeout(() => warn.classList.add('active'), 20);
    }
  };
}

if(el('btn-close-offline-warning')) {
  el('btn-close-offline-warning').onclick = () => {
    const warn = document.getElementById('offline-warning-overlay');
    if(warn) {
      warn.classList.remove('active');
      setTimeout(() => warn.classList.add('hidden'), 250);
    }
  };
}

if(el('btn-login')) {
  el('btn-login').onclick = () => {
    const email = document.getElementById('auth-email-input').value.trim();
    const pass = document.getElementById('auth-pass-input').value.trim();
    if(!email || !pass) { authStatus.textContent = "Completează toate câmpurile!"; return; }
    signInWithEmailAndPassword(auth, email, pass).catch(e => authStatus.textContent = "Eroare: " + e.message);
  };
}

if(el('btn-register')) {
  el('btn-register').onclick = () => {
    const email = document.getElementById('auth-email-input').value.trim();
    const pass = document.getElementById('auth-pass-input').value.trim();
    if(!email || pass.length < 6) { authStatus.textContent = "Parola min. 6 caractere!"; return; }
    createUserWithEmailAndPassword(auth, email, pass).catch(e => authStatus.textContent = "Eroare: " + e.message);
  };
}

if(el('btn-open-leaderboard')) {
  el('btn-open-leaderboard').onclick = () => {
    const container = el('leaderboard-container');
    if(!container) return;
    container.innerHTML = "Se încarcă clasamentul...";
    el('leaderboard-overlay').classList.remove('hidden');
    setTimeout(() => el('leaderboard-overlay').classList.add('active'), 20);

    onValue(ref(db, 'leaderboard'), (snapshot) => {
      container.innerHTML = "";
      if (!snapshot.exists()) { container.innerHTML = "<div style='color:#94a3b8; text-align:center;'>Niciun jucător.</div>"; return; }
      const scores = [];
      snapshot.forEach(child => scores.push(child.val()));
      scores.sort((a, b) => b.level - a.level);

      scores.slice(0, 10).forEach((sc, idx) => {
        const div = document.createElement('div');
        div.className = "talent-item";
        div.innerHTML = `
          <div class="shop-card-info"><div class="shop-card-title">#${idx+1} ${sc.avatar || '🧙‍♂️'} ${sc.name}</div></div>
          <div style="color: #facc15; font-weight: bold;">Nivel ${sc.level}</div>
        `;
        container.appendChild(div);
      });
    }, { onlyOnce: true });
  };
}

if(el('btn-close-leaderboard')) {
  el('btn-close-leaderboard').onclick = () => {
    el('leaderboard-overlay').classList.remove('active');
    setTimeout(() => el('leaderboard-overlay').classList.add('hidden'), 250);
  };
}

const canvas = document.getElementById('fx-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let particles = [];
function resizeCanvas() {
  if(canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
}
window.onresize = resizeCanvas;
resizeCanvas();

function spawnFX(x, y, color) {
  for (let i = 0; i < 20; i++) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, size: Math.random() * 6 + 2, color, alpha: 1 });
  }
}

function renderFX() {
  if(ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, index) => {
      p.x += p.vx; p.y += p.vy; p.alpha -= 0.03;
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      if (p.alpha <= 0) particles.splice(index, 1);
    });
  }
  requestAnimationFrame(renderFX);
}
renderFX();

// --- SISTEM AUDIO HARDCODED (CĂI DIRECTE) ---
let soundEnabled = true;
const bgmAudio = new Audio('audio/fundal/muzica_fundal.mp3');
bgmAudio.loop = true; bgmAudio.volume = 0.4;

const soundCache = {
  attack: new Audio('audio/victorie.mp3'),
  shield: new Audio('audio/shield.mp3'),
  heal: new Audio('audio/heal.mp3'),
  buy: new Audio('audio/buy.mp3'),
  victory: new Audio('audio/victorie.mp3')
};
Object.values(soundCache).forEach(snd => snd.volume = 0.6);

function playSound(type) {
  if (!soundEnabled) return;
  const snd = soundCache[type];
  if (snd) { snd.currentTime = 0; snd.play().catch(() => {}); }
}

const soundToggleBtn = document.getElementById('btn-toggle-sound');
if(soundToggleBtn) {
  soundToggleBtn.onclick = () => {
    soundEnabled = !soundEnabled;
    if(soundEnabled) { soundToggleBtn.textContent = "🔊 Sunet: ON"; bgmAudio.play().catch(() => {}); }
    else { soundToggleBtn.textContent = "🔇 Sunet: OFF"; bgmAudio.pause(); }
  };
}

document.body.addEventListener('click', () => {
  if (soundEnabled && bgmAudio.paused) bgmAudio.play().catch(() => {});
}, { once: true });

const HERO_CLASSES = {
  mage: { name: "Mager", desc: "Mager: +1 Energie Max, +10% Magic DMG.", energyBonus: 1, hpBonus: 0, shieldBonus: 0 },
  ninja: { name: "Ninja", desc: "Ninja: 20% Șansă Atac Critic (Double DMG).", energyBonus: 0, hpBonus: 0, shieldBonus: 0 },
  elf: { name: "Elfiță", desc: "Elfiță: Inamicii încep cu +2 Otrăvire.", energyBonus: 0, hpBonus: 0, shieldBonus: 0 },
  knight: { name: "Cavaler", desc: "Cavaler: Începe lupta cu +10 Scut gratuit.", energyBonus: 0, hpBonus: 0, shieldBonus: 10 },
  vampire: { name: "Vampir", desc: "Vampir: Te vindeci cu +2 HP la fiecare atac.", energyBonus: 0, hpBonus: 0, shieldBonus: 0 },
  cyborg: { name: "Cyborg", desc: "Cyborg: Ultima se încarcă cu 20% mai rapid.", energyBonus: 0, hpBonus: 0, shieldBonus: 0 },
  beast: { name: "Bestie", desc: "Bestie: +25 Max HP.", energyBonus: 0, hpBonus: 25, shieldBonus: 0 }
};

const CARDS_DB = {
  strike: { name: "Atac", cost: 1, type: "attack", value: 8, desc: "Provoacă 8 daune." },
  defend: { name: "Apărare", cost: 1, type: "defense", value: 6, desc: "Oferă 6 Scut." },
  fireball: { name: "Foc", cost: 2, type: "attack", value: 16, desc: "Provoacă 16 daune." },
  heal: { name: "Regenerare", cost: 1, type: "heal", value: 10, desc: "Restaurează 10 HP." },
  poison: { name: "Otrăvire", cost: 1, type: "poison", value: 4, desc: "+4 Otrăvire." },
  mantra: { name: "Mantra", cost: 0, type: "energy", value: 1, desc: "Oferă +1 Energie." },
  double_strike: { name: "Atac Dublu", cost: 2, type: "attack", value: 22, desc: "Provoacă 22 daune." },
  vampire: { name: "Vampirism", cost: 1, type: "vampire", value: 10, desc: "Furi 10 HP." },
  stun: { name: "Îngheț", cost: 2, type: "stun", value: 1, desc: "Îngheață 1 tură." },
  divine: { name: "Explozie Divină", cost: 3, type: "attack", value: 35, desc: "Provoacă 35 daune." },
  trap: { name: "Contra-Atac", cost: 1, type: "trap", value: 1, desc: "Reflectă 50% din prima lovitură." },
  bleed: { name: "Sângerare", cost: 1, type: "bleed", value: 5, desc: "Inamicul pierde HP progresiv." },
  thorns: { name: "Spini", cost: 1, type: "thorns", value: 4, desc: "Provoacă daune la atacul inamic." },
  quick_draw: { name: "Tragere Rapidă", cost: 0, type: "draw", value: 2, desc: "Tragi 2 cărți noi." },
  shield_bash: { name: "Lovitură Scut", cost: 1, type: "attack", value: 10, desc: "Face daune egale cu Scutul tău curent." },
  venom_strike: { name: "Lamă Veninoasă", cost: 2, type: "attack", value: 14, desc: "Face +10 DMG suplimentar dacă inamicul e otrăvit." }
};

const WEATHER_TYPES = [
  { name: "☀️ Normal", id: "normal", desc: "Fără efecte speciale." },
  { name: "🌋 Căldură Extremă", id: "heat", desc: "Atacurile provoacă +4 DMG." },
  { name: "🌧️ Furtună", id: "storm", desc: "Cost energie -1 la cărți." },
  { name: "🌫️ Ceață", id: "fog", desc: "Cărțile de Apărare oferă dublu Scut." }
];

const TALENTS_DB = {
  vitality: { name: "Vitalitate", maxLvl: 5, cost: 50, desc: "+10 HP Maxim permanent per nivel." },
  greed: { name: "Avere", maxLvl: 5, cost: 40, desc: "+15% mai multe Monede din lupte." },
  quick_hands: { name: "Mână Extinsă", maxLvl: 3, cost: 75, desc: "Tragi +1 carte suplimentară la tură." }
};

const RELICS_DB = {
  vamp_blade: { name: "Tăiș Vampiric", icon: "🗡️", cost: 70, desc: "Atacurile te vindecă cu +2 HP." },
  eternal_shield: { name: "Scut Etern", icon: "🛡️", cost: 80, desc: "+4 Scut la începutul turei." },
  alchemy_master: { name: "Alchimie", icon: "🧪", cost: 65, desc: "Inamicii încep cu +3 Otrăvire." }
};

const ENEMY_TYPES = [
  { name: "Goblin", icon: "👺", biome: "forest" },
  { name: "Orc", icon: "👹", biome: "forest" },
  { name: "Schelet", icon: "💀", biome: "dungeon" },
  { name: "Vampir", icon: "🧛", biome: "dungeon" },
  { name: "Demon", icon: "👿", biome: "volcano" },
  { name: "Dragon", icon: "🐉", biome: "volcano" },
  { name: "Lord Întunecat", icon: "👑", biome: "castle" }
];

const BOSS_SPECIALS = {
  50: { name: "Ignis, Gardianul Focului 👑", icon: "🔥", quote: "„Cenușa ta va hrăni flăcările mele!”" },
  100: { name: "Malakor, Regele Strigoi 👑", icon: "💀", quote: "„Nimand nu scapă din regatul morților!”" },
  150: { name: "Vespera, Regina Umbrielor 👑", icon: "🧛", quote: "„Întunericul te va înghiți cu totul...”" },
  200: { name: "Titanul de Obsidian 👑", icon: "🗿", quote: "„Puterea mea este la fel de eternă ca piatra!”" },
  250: { name: "Zarok, Lordul Apocalipsei 👑", icon: "👿", quote: "„Sfârșitul lumii tale începe acum!”" },
  300: { name: "Balerion, Furia Cerurilor 👑", icon: "🐉", quote: "„Răsuflarea mea va topi până și armura ta!”" },
  350: { name: "Kaelen, Vrăjitorul Timpului 👑", icon: "⏳", quote: "„Secundele tale sunt numărate, muritorule!”" },
  400: { name: "Abyssal Horror 👑", icon: "🦑", quote: "„Din adâncuri am sosit, spre pieirea ta!”" },
  450: { name: "Omega Machine 👑", icon: "🤖", quote: "„Eroarea ta fundamentală a fost să mă înfrunți.”" },
  500: { name: "Karma Supremă (Boss Final) 👑", icon: "🌌", quote: "„Eu sunt echilibrul final al universului!”" }
};

function generateStageData(lvl) {
  let ascMod = 1 + (ascensionLevel * 0.2);
  if (BOSS_SPECIALS[lvl]) {
    const b = BOSS_SPECIALS[lvl];
    return {
      name: b.name, icon: b.icon, biome: "castle",
      hp: Math.floor((120 + (lvl * 4)) * ascMod),
      baseDmg: Math.floor((8 + (lvl * 0.3)) * ascMod),
      maxDmg: Math.floor((15 + (lvl * 0.4)) * ascMod),
      healVal: 15, shieldVal: 15, isBoss: true, quote: b.quote
    };
  }

  const typeIndex = Math.min(Math.floor((lvl - 1) / 75), ENEMY_TYPES.length - 1);
  const baseType = ENEMY_TYPES[typeIndex];

  let hpBonus = lvl * 3.5;
  let dmgMultiplier = 0.25;
  if (lvl >= 430) { hpBonus += (lvl - 430) * 8; dmgMultiplier = 0.45; }

  let hp = Math.floor((40 + hpBonus) * ascMod);
  let baseDmg = Math.floor((4 + (lvl * dmgMultiplier)) * ascMod);
  let maxDmg = Math.floor((baseDmg + 4 + (lvl * 0.12)) * ascMod);

  return {
    name: `${baseType.name} (Lvl ${lvl} ${ascensionLevel > 0 ? '| A'+ascensionLevel : ''})`,
    icon: baseType.icon, biome: baseType.biome,
    hp, baseDmg, maxDmg,
    healVal: 5 + Math.floor(lvl * 0.1),
    shieldVal: 5 + Math.floor(lvl * 0.1),
    isBoss: lvl >= 430, quote: null
  };
}

let gameMode = null;
let multiSubMode = 'pvp';
let currentRoomId = null;
let playerRole = 'p1';
let playerName = "Erou";
let selectedAvatar = "🧙‍♂️";
let selectedClass = "mage";

let localHand = [];
let drawPile = [];
let discardPile = [];
let reservedCardKey = null;

let playerDeck = ["strike", "strike", "defend", "defend", "fireball", "heal", "trap"];
let playerRelics = [];
let playerTalents = { vitality: 0, greed: 0, quick_hands: 0 };
let playerXP = 0;
let playerUltCharge = 0;
let currentStageLevel = 1;
let playerCoins = 0;
let shopTabMode = 'buy';

let lastPlayedCardType = null;
let currentWeather = WEATHER_TYPES[0];
let turnTimerInterval = null;
let turnTimeLeft = 15;

let soloState = {
  turn: 'p1',
  lastAction: 'Tura ta! Joacă o carte.',
  p1: { hp: 100, maxHp: 100, shield: 0, energy: 3, maxEnergy: 3, stun: 0, trap: 0, name: "Erou", avatar: "🧙‍♂️" },
  p2: { hp: 45, maxHp: 45, shield: 0, energy: 3, poison: 0, bleed: 0, stun: 0, trap: 0, name: "Goblin", avatar: "👺" }
};

function saveSoloProgress() {
  const saveData = {
    level: currentStageLevel, coins: playerCoins, xp: playerXP,
    talents: playerTalents, deck: playerDeck, relics: playerRelics,
    name: playerName, avatar: selectedAvatar, heroClass: selectedClass,
    achievements: playerAchievements, ascension: ascensionLevel
  };
  localStorage.setItem('cardRPG_save', JSON.stringify(saveData));
}

function checkSaveFile() {
  const save = localStorage.getItem('cardRPG_save');
  if (save) {
    const data = JSON.parse(save);
    if (data.xp) playerXP = data.xp;
    if (data.talents) playerTalents = data.talents;
    if (data.achievements) playerAchievements = data.achievements;
    if (data.ascension) ascensionLevel = data.ascension;
    if(el('lobby-xp')) el('lobby-xp').textContent = playerXP;

    if (data.level > 1 && el('btn-continue-solo')) {
      el('btn-continue-solo').classList.remove('hidden');
      el('btn-continue-solo').textContent = `▶️ Continuă Solo (Lvl ${data.level})`;
    }
  }
}
checkSaveFile();

document.querySelectorAll('.avatar-option').forEach(opt => {
  opt.onclick = () => {
    document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedAvatar = opt.getAttribute('data-avatar');
    selectedClass = opt.getAttribute('data-class');
    if(el('class-desc-display')) el('class-desc-display').textContent = HERO_CLASSES[selectedClass].desc;
  };
});

function getAndValidatePlayerName() {
  const rawInput = el('player-name-input') ? el('player-name-input').value.trim() : "";
  if (!rawInput) { playerName = "Erou"; return true; }
  const regex = /^[a-zA-Z0-9ăîâșțĂÎÂȘȚ]{3,10}$/;
  if (!regex.test(rawInput)) {
    if(el('lobby-status')) el('lobby-status').textContent = "Numele 3-10 caractere!";
    return false;
  }
  playerName = rawInput;
  return true;
}

if(el('btn-open-talents')) {
  el('btn-open-talents').onclick = () => {
    if(el('talent-xp-count')) el('talent-xp-count').textContent = playerXP;
    renderTalents();
    el('talents-overlay').classList.remove('hidden');
    setTimeout(() => el('talents-overlay').classList.add('active'), 20);
  };
}

if(el('btn-close-talents')) {
  el('btn-close-talents').onclick = () => {
    el('talents-overlay').classList.remove('active');
    setTimeout(() => el('talents-overlay').classList.add('hidden'), 250);
  };
}

function renderTalents() {
  const container = el('talents-container');
  if(!container) return;
  container.innerHTML = "";
  Object.keys(TALENTS_DB).forEach(key => {
    const t = TALENTS_DB[key];
    const curLvl = playerTalents[key] || 0;
    const isMax = curLvl >= t.maxLvl;
    const div = document.createElement('div');
    div.className = "talent-item";
    div.innerHTML = `
      <div class="shop-card-info"><div class="shop-card-title">${t.name} (${curLvl}/${t.maxLvl})</div><div class="shop-card-desc">${t.desc}</div></div>
      <button class="btn-buy" ${(isMax || playerXP < t.cost) ? 'disabled' : ''}>${isMax ? 'MAX' : '⭐ ' + t.cost}</button>
    `;
    div.querySelector('.btn-buy').onclick = () => {
      if (!isMax && playerXP >= t.cost) {
        playerXP -= t.cost; playerTalents[key] = curLvl + 1;
        if(el('talent-xp-count')) el('talent-xp-count').textContent = playerXP;
        if(el('lobby-xp')) el('lobby-xp').textContent = playerXP;
        saveCloudProgress(); renderTalents();
      }
    };
    container.appendChild(div);
  });
}

if(el('btn-emotes')) {
  el('btn-emotes').onclick = () => {
    const pop = el('emotes-popover');
    if(pop) pop.classList.toggle('hidden');
  };
}

document.querySelectorAll('.emote-btn').forEach(btn => {
  btn.onclick = () => {
    const emoteStr = btn.textContent;
    const pop = el('emotes-popover');
    if(pop) pop.classList.add('hidden');
    if (gameMode === 'solo') triggerFloatText(el('player-avatar'), emoteStr, 'emote');
    else if(currentRoomId) {
      const updates = {};
      updates[`rooms/${currentRoomId}/lastEmote`] = { sender: playerRole, emote: emoteStr, time: Date.now() };
      update(ref(db), updates);
    }
  };
});

function startTurnTimer() {
  clearInterval(turnTimerInterval);
  turnTimeLeft = 15;
  if(el('turn-timer')) el('turn-timer').textContent = `⏳ ${turnTimeLeft}s`;

  turnTimerInterval = setInterval(() => {
    turnTimeLeft--;
    if(el('turn-timer')) el('turn-timer').textContent = `⏳ ${turnTimeLeft}s`;
    if (turnTimeLeft <= 0) {
      clearInterval(turnTimerInterval);
      if (gameMode === 'solo' && soloState.turn === playerRole) endTurn(soloState);
      else if (gameMode === 'multiplayer' && currentRoomId) {
        onValue(ref(db, `rooms/${currentRoomId}`), (snapshot) => {
          const data = snapshot.val();
          if (data && data.turn === playerRole) endTurn(data);
        }, { onlyOnce: true });
      }
    }
  }, 1000);
}

if(el('btn-play-solo')) {
  el('btn-play-solo').onclick = () => {
    if (!getAndValidatePlayerName()) return;
    startSoloGame(1, 0, ["strike", "strike", "defend", "defend", "fireball", "heal", "trap"], []);
  };
}

if(el('btn-continue-solo')) {
  el('btn-continue-solo').onclick = () => {
    if (currentFirebaseUser) loadCloudProgress(currentFirebaseUser.uid);
    else checkSaveFile();
    setTimeout(() => startSoloGame(currentStageLevel, playerCoins, playerDeck, playerRelics), 300);
  };
}

function startSoloGame(lvl, coins, deck, relics) {
  gameMode = 'solo'; playerRole = 'p1'; currentStageLevel = lvl;
  playerCoins = coins; playerDeck = [...deck]; playerRelics = [...relics];
  playerUltCharge = 0; reservedCardKey = null;

  soloState.p1.name = playerName; soloState.p1.avatar = selectedAvatar;
  if(el('p1-name')) el('p1-name').textContent = playerName;
  if(el('player-avatar')) el('player-avatar').textContent = selectedAvatar;
  if(el('p1-coins-wrap')) el('p1-coins-wrap').classList.remove('hidden');
  if(el('p1-coins')) el('p1-coins').textContent = playerCoins;

  initSoloStage(currentStageLevel);
  switchScreen('lobby-overlay', 'game-container');
  if(el('shop-overlay')) el('shop-overlay').classList.add('hidden');
  if(el('event-overlay')) el('event-overlay').classList.add('hidden');
  if(el('pause-overlay')) el('pause-overlay').classList.add('hidden');
  if(el('room-id-display')) el('room-id-display').textContent = ascensionLevel > 0 ? `ASC ${ascensionLevel}` : "SOLO";

  initLocalDeck(); updateUI(soloState); startTurnTimer();
}

function initSoloStage(lvl) {
  const enemyData = generateStageData(lvl);
  if(el('p2-name')) el('p2-name').textContent = enemyData.name;
  if(el('enemy-avatar')) el('enemy-avatar').textContent = enemyData.icon;
  if (el('stage-display')) {
    el('stage-display').textContent = `NIVEL ${lvl} din 500 ${enemyData.isBoss ? '🔥' : ''}`;
  }

  if (enemyData.quote) soloState.lastAction = `⚠️ ${enemyData.name}: ${enemyData.quote}`;

  currentWeather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
  if(el('weather-display')) el('weather-display').textContent = currentWeather.name;
  if(el('arena')) el('arena').className = `battle-arena biome-${enemyData.biome}`;

  const hClass = HERO_CLASSES[selectedClass];
  soloState.turn = 'p1';
  soloState.p1.maxHp = 100 + (playerTalents.vitality * 10) + hClass.hpBonus;
  soloState.p1.hp = soloState.p1.maxHp;
  soloState.p1.maxEnergy = 3 + hClass.energyBonus;
  soloState.p1.energy = soloState.p1.maxEnergy;
  soloState.p1.shield = (playerRelics.includes('eternal_shield') ? 4 : 0) + hClass.shieldBonus;
  soloState.p1.stun = 0; soloState.p1.trap = 0;

  soloState.p2.hp = enemyData.hp; soloState.p2.maxHp = enemyData.hp;
  soloState.p2.shield = 0;
  soloState.p2.poison = (playerRelics.includes('alchemy_master') ? 3 : 0) + (selectedClass === 'elf' ? 2 : 0);
  soloState.p2.bleed = 0; soloState.p2.stun = 0; soloState.p2.trap = 0; soloState.p2.avatar = enemyData.icon;
  
  if (!enemyData.quote) soloState.lastAction = `Nivelul ${lvl}: Lupta începe!`;
  saveCloudProgress();
}

function checkStageCompletion() {
  playerXP += 25 + Math.floor(currentStageLevel * 3);
  if (currentStageLevel >= 100) checkAchievement('century_club');
  saveCloudProgress();

  if (currentStageLevel === 500) {
    ascensionLevel++;
    checkAchievement('ascension_hero');
    soloState.lastAction = `🌟 AI TERMINAT CELE 500 DE NIVELURI! Ascensiune Nivel ${ascensionLevel} deblocată!`;
    soloState.turn = 'ended'; updateUI(soloState);
    saveCloudProgress();
    return;
  }

  if (currentStageLevel % 7 === 0) triggerRandomEvent();
  else if (currentStageLevel < 500) openShop();
}

function triggerRandomEvent() {
  const isHealEvent = Math.random() < 0.4;
  const container = el('event-choices-container');
  if(!container) return;
  container.innerHTML = "";

  if (isHealEvent) {
    if(el('event-title')) el('event-title').textContent = "⛲ Fântâna Stăveche";
    if(el('event-desc')) el('event-desc').textContent = "Ai găsit o fântână magică ascunsă în umbra pădurii.";
    container.appendChild(createEventBtn("🥤 Beu apa binecuvântată (+20 HP Max)", () => {
      soloState.p1.maxHp += 20; soloState.p1.hp += 20;
      if(el('event-overlay')) { el('event-overlay').classList.remove('active'); setTimeout(() => el('event-overlay').classList.add('hidden'), 250); }
      openShop();
    }));
    container.appendChild(createEventBtn("💰 Caută monede (+40 Monede)", () => {
      playerCoins += 40;
      if(el('event-overlay')) { el('event-overlay').classList.remove('active'); setTimeout(() => el('event-overlay').classList.add('hidden'), 250); }
      openShop();
    }));
  } else {
    if(el('event-title')) el('event-title').textContent = "🧙‍♂️ Negustorul Umbrelor";
    if(el('event-desc')) el('event-desc').textContent = "O figură misterioasă îți propune un târg...";
    container.appendChild(createEventBtn("⚔️ Obține o carte rară *Explozie Divină*", () => {
      playerDeck.push("divine");
      if(el('event-overlay')) { el('event-overlay').classList.remove('active'); setTimeout(() => el('event-overlay').classList.add('hidden'), 250); }
      openShop();
    }));
    container.appendChild(createEventBtn("🩸 Sacrifică 10 HP pentru 60 Monede", () => {
      soloState.p1.maxHp = Math.max(30, soloState.p1.maxHp - 10);
      soloState.p1.hp = Math.min(soloState.p1.hp, soloState.p1.maxHp);
      playerCoins += 60;
      if(el('event-overlay')) { el('event-overlay').classList.remove('active'); setTimeout(() => el('event-overlay').classList.add('hidden'), 250); }
      openShop();
    }));
  }
  if(el('event-overlay')) {
    el('event-overlay').classList.remove('hidden');
    setTimeout(() => el('event-overlay').classList.add('active'), 20);
  }
}

function createEventBtn(text, onClick) {
  const btn = document.createElement('div');
  btn.className = "event-choice-btn";
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

if(el('btn-create-room')) {
  el('btn-create-room').onclick = () => {
    if (!getAndValidatePlayerName()) return;
    gameMode = 'multiplayer';
    const multiRadio = document.querySelector('input[name="multi-type"]:checked');
    multiSubMode = multiRadio ? multiRadio.value : 'pvp';
    const roomId = Math.floor(1000 + Math.random() * 9000).toString();
    currentRoomId = roomId; playerRole = 'p1';
    if(el('p1-name')) el('p1-name').textContent = playerName;
    if(el('player-avatar')) el('player-avatar').textContent = selectedAvatar;
    if(el('p1-coins-wrap')) el('p1-coins-wrap').classList.add('hidden');

    const weather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
    const initialGameState = multiSubMode === 'coop' ? {
      status: 'waiting', mode: 'coop', turn: 'p1', weather,
      lastAction: 'Așteptare Jucător 2 pentru Boss Raid! 🐉',
      p1: { hp: 120, maxHp: 120, shield: 0, energy: 3, stun: 0, trap: 0, name: playerName, avatar: selectedAvatar },
      p2: { hp: 1000, maxHp: 1000, shield: 0, energy: 3, stun: 0, trap: 0, name: "🐉 Mega Boss", avatar: "🐉" }
    } : {
      status: 'waiting', mode: 'pvp', turn: 'p1', weather,
      lastAction: 'Așteptare Jucător 2...',
      p1: { hp: 100, maxHp: 100, shield: 0, energy: 3, stun: 0, trap: 0, name: playerName, avatar: selectedAvatar },
      p2: { hp: 100, maxHp: 100, shield: 0, energy: 3, stun: 0, trap: 0, name: "Adversar", avatar: "🥷" }
    };

    set(ref(db, `rooms/${roomId}`), initialGameState).then(() => {
      if(el('lobby-status')) {
        el('lobby-status').style.color = "#38bdf8";
        el('lobby-status').textContent = `Cameră creată! Cod: ${roomId}`;
      }
      listenToRoom(roomId);
    });
  };
}

if(el('btn-join-room')) {
  el('btn-join-room').onclick = () => {
    if (!getAndValidatePlayerName()) return;
    gameMode = 'multiplayer';
    const codeInput = el('room-code-input');
    const code = codeInput ? codeInput.value.trim() : "";
    if (code.length !== 4) { if(el('lobby-status')) el('lobby-status').textContent = "Introdu cod din 4 cifre!"; return; }
    currentRoomId = code; playerRole = 'p2';
    if(el('p1-coins-wrap')) el('p1-coins-wrap').classList.add('hidden');

    const updates = { status: 'in_game', lastAction: `${playerName} s-a conectat!` };
    updates[`rooms/${code}/p2/name`] = playerName;
    updates[`rooms/${code}/p2/avatar`] = selectedAvatar;

    update(ref(db), updates).then(() => listenToRoom(code)).catch(() => {
      if(el('lobby-status')) el('lobby-status').textContent = "Camera nu există!";
    });
  };
}

function listenToRoom(roomId) {
  onValue(ref(db, `rooms/${roomId}`), (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    if (data.status === 'in_game') {
      switchScreen('lobby-overlay', 'game-container');
      if(el('room-id-display')) el('room-id-display').textContent = roomId;
      if (el('stage-display')) el('stage-display').textContent = data.mode === 'coop' ? "CO-OP RAID" : "VS PLAYER";
      if (data.weather) { currentWeather = data.weather; if(el('weather-display')) el('weather-display').textContent = currentWeather.name; }
      if (localHand.length === 0 && drawPile.length === 0) initLocalDeck();
      if (data.turn === playerRole && data[playerRole].stun > 0) { handleMultiplayerStun(data); return; }
      updateUI(data); startTurnTimer();
    }
  });
}

function handleMultiplayerStun(data) {
  const opponentRole = playerRole === 'p1' ? 'p2' : 'p1';
  const updates = {};
  updates[`rooms/${currentRoomId}/${playerRole}/stun`] = Math.max(0, data[playerRole].stun - 1);
  updates[`rooms/${currentRoomId}/turn`] = opponentRole;
  updates[`rooms/${currentRoomId}/${opponentRole}/energy`] = 3;
  updates[`rooms/${currentRoomId}/${opponentRole}/shield`] = 0;
  updates[`rooms/${currentRoomId}/lastAction`] = `${data[playerRole].name} este ÎNGHEȚAT 🧊!`;
  triggerFloatText(el('player-avatar'), `Înghețat! 🧊`, 'stun');
  setTimeout(() => update(ref(db), updates), 1000);
}

function initLocalDeck() {
  drawPile = [...playerDeck]; shuffle(drawPile);
  localHand = []; discardPile = [];
  const drawAmount = 4 + (playerTalents.quick_hands || 0);
  drawCards(drawAmount);
}

function drawCards(n) {
  for (let i = 0; i < n; i++) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break;
      drawPile = [...discardPile]; discardPile = []; shuffle(drawPile);
    }
    const drawnKey = drawPile.pop();
    localHand.push(drawnKey);
    animateCardDraw(drawnKey);
  }
}

function animateCardDraw(key) {
  const handEl = el('hand-container');
  if(!handEl) return;
  const tempCard = document.createElement('div');
  const cardData = CARDS_DB[key];
  tempCard.className = `card ${cardData.type}-card card-dealing-anim`;
  tempCard.innerHTML = `<div class="card-header"><span class="card-title">${cardData.name}</span><span class="card-cost">${cardData.cost}</span></div><div class="card-desc">${cardData.desc}</div>`;
  handEl.appendChild(tempCard);
  setTimeout(() => tempCard.remove(), 400);
}

function addUltCharge(amount) {
  const mult = selectedClass === 'cyborg' ? 1.2 : 1.0;
  playerUltCharge = Math.min(100, playerUltCharge + Math.floor(amount * mult));
  if(el('ult-bar-fill')) el('ult-bar-fill').style.width = `${playerUltCharge}%`;
  if(el('btn-activate-ult')) el('btn-activate-ult').disabled = playerUltCharge < 100;
}

if(el('btn-activate-ult')) {
  el('btn-activate-ult').onclick = () => {
    if (playerUltCharge < 100) return;
    playerUltCharge = 0;
    if(el('ult-bar-fill')) el('ult-bar-fill').style.width = `0%`;
    if(el('btn-activate-ult')) el('btn-activate-ult').disabled = true;
    const enemyAvatarEl = el('enemy-avatar');
    if(enemyAvatarEl) {
      const rect = enemyAvatarEl.getBoundingClientRect();
      spawnFX(rect.left + rect.width / 2, rect.top + rect.height / 2, '#f59e0b');
    }

    if (gameMode === 'solo') {
      let dmg = 40;
      if (soloState.p2.shield > 0) {
        if (soloState.p2.shield >= dmg) { soloState.p2.shield -= dmg; dmg = 0; }
        else { dmg -= soloState.p2.shield; soloState.p2.shield = 0; }
      }
      soloState.p2.hp = Math.max(0, soloState.p2.hp - dmg);
      soloState.p1.shield += 15;
      soloState.lastAction = `${playerName} a activat ULTIMATA!`;
      
      triggerFloatText(el('enemy-avatar'), `-40 ⚡`, 'dmg');
      triggerFloatText(el('player-avatar'), `+15 🛡️`, 'shield');
      shakeAvatar(el('enemy-avatar'), true); playSound('attack');

      if (soloState.p2.hp <= 0) {
        playerCoins += 15 + Math.floor(currentStageLevel * 2);
        playSound('victory'); updateUI(soloState);
        setTimeout(checkStageCompletion, 1000);
        return;
      }
      updateUI(soloState);
    }
  };
}

function triggerFloatText(targetEl, text, type) {
  if(!targetEl) return;
  const rect = targetEl.getBoundingClientRect();
  const floatEl = document.createElement('div');
  floatEl.className = `float-num float-${type}`;
  floatEl.textContent = text;
  floatEl.style.left = `${rect.left + rect.width / 2 - 15}px`;
  floatEl.style.top = `${rect.top}px`;
  document.body.appendChild(floatEl);
  setTimeout(() => floatEl.remove(), 850);
}

function shakeAvatar(targetEl, isKnockback = false) {
  if(!targetEl) return;
  const animClass = isKnockback ? 'knockback' : 'shake';
  targetEl.classList.add(animClass);
  setTimeout(() => targetEl.classList.remove(animClass), isKnockback ? 500 : 320);
}

function playCard(index, currentData) {
  if (currentData.turn !== playerRole) return;

  const cardKey = localHand[index];
  const card = CARDS_DB[cardKey];
  const myState = currentData[playerRole];

  let finalCost = card.cost;
  if (currentWeather.id === 'storm') finalCost = Math.max(0, card.cost - 1);
  if (myState.energy < finalCost) return;

  const opponentRole = playerRole === 'p1' ? 'p2' : 'p1';
  const oppState = currentData[opponentRole];

  let newMyEnergy = myState.energy - finalCost;
  let newMyShield = myState.shield;
  let newMyHp = myState.hp;
  let newMyTrap = myState.trap || 0;
  let newOppHp = oppState.hp;
  let newOppShield = oppState.shield;
  let newOppPoison = oppState.poison || 0;
  let newOppBleed = oppState.bleed || 0;
  let newOppStun = oppState.stun || 0;
  let newOppTrap = oppState.trap || 0;

  let isCombo = (lastPlayedCardType === card.type);
  let comboMultiplier = isCombo ? 1.5 : 1.0;
  lastPlayedCardType = card.type;

  let isCrit = (selectedClass === 'ninja' && Math.random() < 0.20);
  if (isCrit) comboMultiplier *= 2.0;

  addUltCharge(15);
  const enemyAvatarEl = el('enemy-avatar');
  const rectTarget = enemyAvatarEl ? enemyAvatarEl.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };

  if (card.type === "attack") {
    let dmg = Math.floor(card.value * comboMultiplier);
    if (currentWeather.id === 'heat') dmg += 4;
    if (cardKey === 'shield_bash') dmg += newMyShield;
    if (cardKey === 'venom_strike' && newOppPoison > 0) dmg += 10;

    if (playerRelics.includes('vamp_blade') || selectedClass === 'vampire') newMyHp = Math.min(myState.maxHp, newMyHp + 2);

    if (newOppTrap > 0) {
      let reflectedDmg = Math.floor(dmg * 0.5);
      newMyHp = Math.max(0, newMyHp - reflectedDmg);
      newOppTrap = 0; triggerFloatText(el('player-avatar'), `-${reflectedDmg} 🪤`, 'dmg');
    }

    if (newOppShield > 0) {
      if (newOppShield >= dmg) { newOppShield -= dmg; dmg = 0; }
      else { dmg -= newOppShield; newOppShield = 0; }
    }
    newOppHp = Math.max(0, newOppHp - dmg);
    triggerFloatText(el('enemy-avatar'), `-${dmg}`, 'dmg');
    shakeAvatar(el('enemy-avatar'), true);
    spawnFX(rectTarget.left + rectTarget.width / 2, rectTarget.top + rectTarget.height / 2, '#ef4444');
    playSound('attack');

  } else if (card.type === "defense") {
    let shieldVal = Math.floor(card.value * comboMultiplier);
    if (currentWeather.id === 'fog') shieldVal *= 2;
    newMyShield += shieldVal;
    if (newMyShield >= 50) checkAchievement('shield_master');
    triggerFloatText(el('player-avatar'), `+${shieldVal} 🛡️`, 'shield');
    playSound('shield');

  } else if (card.type === "heal") {
    let healVal = Math.floor(card.value * comboMultiplier);
    newMyHp = Math.min(myState.maxHp || 100, myState.hp + healVal);
    triggerFloatText(el('player-avatar'), `+${healVal} HP`, 'heal');
    playSound('heal');

  } else if (card.type === "poison") {
    newOppPoison += Math.floor(card.value * comboMultiplier);
    triggerFloatText(el('enemy-avatar'), `+🧪`, 'poison');
    playSound('shield');

  } else if (card.type === "bleed") {
    newOppBleed += 5;
    triggerFloatText(el('enemy-avatar'), `+🩸`, 'dmg');
    playSound('attack');

  } else if (card.type === "draw") {
    drawCards(2);
    triggerFloatText(el('player-avatar'), `+2 🎴`, 'shield');

  } else if (card.type === "energy") {
    newMyEnergy += card.value;
    triggerFloatText(el('player-avatar'), `+⚡`, 'shield');
    playSound('heal');

  } else if (card.type === "trap") {
    newMyTrap = 1;
    triggerFloatText(el('player-avatar'), `🪤`, 'shield');
    playSound('shield');

  } else if (card.type === "vampire") {
    let dmg = card.value;
    if (newOppShield > 0) {
      if (newOppShield >= dmg) { newOppShield -= dmg; dmg = 0; }
      else { dmg -= newOppShield; newOppShield = 0; }
    }
    newOppHp = Math.max(0, newOppHp - dmg);
    newMyHp = Math.min(myState.maxHp || 100, myState.hp + card.value);
    triggerFloatText(el('enemy-avatar'), `-${card.value}`, 'dmg');
    triggerFloatText(el('player-avatar'), `+HP`, 'heal');
    shakeAvatar(el('enemy-avatar'), true); playSound('attack');

  } else if (card.type === "stun") {
    newOppStun += 1;
    triggerFloatText(el('enemy-avatar'), `🧊`, 'stun');
    playSound('shield');
  }

  discardPile.push(localHand.splice(index, 1)[0]);

  if (gameMode === 'solo') {
    soloState.p1.energy = newMyEnergy; soloState.p1.shield = newMyShield;
    soloState.p1.hp = newMyHp; soloState.p1.trap = newMyTrap;
    soloState.p2.hp = newOppHp; soloState.p2.shield = newOppShield;
    soloState.p2.poison = newOppPoison; soloState.p2.bleed = newOppBleed;
    soloState.p2.stun = newOppStun; soloState.p2.trap = newOppTrap;
    soloState.lastAction = `${playerName} a jucat ${card.name}!`;

    if (newMyHp > 0 && newMyHp < 15 && newOppHp <= 0) checkAchievement('vampire_lord');

    if (newOppHp <= 0) {
      const goldMult = 1 + (playerTalents.greed * 0.15);
      playerCoins += Math.floor((15 + Math.floor(currentStageLevel * 2)) * goldMult);
      soloState.lastAction = `Ai învins inamicul!`;
      playSound('victory'); updateUI(soloState);
      setTimeout(checkStageCompletion, 1000);
      return;
    }
    updateUI(soloState);
  } else if(currentRoomId) {
    const updates = {};
    updates[`rooms/${currentRoomId}/${playerRole}/energy`] = newMyEnergy;
    updates[`rooms/${currentRoomId}/${playerRole}/shield`] = newMyShield;
    updates[`rooms/${currentRoomId}/${playerRole}/hp`] = newMyHp;
    updates[`rooms/${currentRoomId}/${playerRole}/trap`] = newMyTrap;
    updates[`rooms/${currentRoomId}/${opponentRole}/hp`] = newOppHp;
    updates[`rooms/${currentRoomId}/${opponentRole}/shield`] = newOppShield;
    updates[`rooms/${currentRoomId}/${opponentRole}/stun`] = newOppStun;
    updates[`rooms/${currentRoomId}/${opponentRole}/trap`] = newOppTrap;
    updates[`rooms/${currentRoomId}/lastAction`] = `${myState.name || playerRole.toUpperCase()} a jucat ${card.name}!`;

    if (newOppHp <= 0) {
      updates[`rooms/${currentRoomId}/status`] = 'ended';
      updates[`rooms/${currentRoomId}/lastAction`] = `Joc Încheiat! Câștigător!`;
    }
    update(ref(db), updates);
  }
}

if(el('tab-buy')) el('tab-buy').onclick = () => { shopTabMode = 'buy'; setShopTabActive('tab-buy'); renderShop(); };
if(el('tab-relics')) el('tab-relics').onclick = () => { shopTabMode = 'relics'; setShopTabActive('tab-relics'); renderShop(); };
if(el('tab-remove')) el('tab-remove').onclick = () => { shopTabMode = 'remove'; setShopTabActive('tab-remove'); renderShop(); };

function setShopTabActive(tabId) {
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  const target = el(tabId);
  if(target) target.classList.add('active');
}

function openShop() {
  if(el('shop-coins')) el('shop-coins').textContent = playerCoins;
  shopTabMode = 'buy'; setShopTabActive('tab-buy'); renderShop();
  if(el('shop-overlay')) {
    el('shop-overlay').classList.remove('hidden');
    setTimeout(() => el('shop-overlay').classList.add('active'), 20);
  }
}

function renderShop() {
  const container = el('shop-items-container');
  if(!container) return;
  container.innerHTML = "";

  if (shopTabMode === 'buy') {
    const shopCards = [
      { key: 'shield_bash', cost: 45 }, { key: 'venom_strike', cost: 55 },
      { key: 'poison', cost: 30 }, { key: 'mantra', cost: 40 },
      { key: 'double_strike', cost: 50 }, { key: 'vampire', cost: 50 },
      { key: 'stun', cost: 60 }, { key: 'divine', cost: 75 }
    ];

    shopCards.forEach(item => {
      const c = CARDS_DB[item.key];
      const div = document.createElement('div');
      div.className = "shop-card-item";
      div.innerHTML = `
        <div class="shop-card-info"><div class="shop-card-title">${c.name} ⭐</div><div class="shop-card-desc">${c.desc}</div></div>
        <button class="btn-buy" ${playerCoins < item.cost ? 'disabled' : ''}>💰 ${item.cost}</button>
      `;
      div.querySelector('.btn-buy').onclick = () => {
        if (playerCoins >= item.cost) {
          playerCoins -= item.cost; playerDeck.push(item.key);
          if(el('shop-coins')) el('shop-coins').textContent = playerCoins;
          playSound('buy'); saveCloudProgress(); renderShop();
        }
      };
      container.appendChild(div);
    });
  } else if (shopTabMode === 'relics') {
    Object.keys(RELICS_DB).forEach(key => {
      const r = RELICS_DB[key];
      const owned = playerRelics.includes(key);
      const div = document.createElement('div');
      div.className = "shop-card-item";
      div.innerHTML = `
        <div class="shop-card-info"><div class="shop-card-title">${r.icon} ${r.name}</div><div class="shop-card-desc">${r.desc}</div></div>
        <button class="btn-buy" ${(owned || playerCoins < r.cost) ? 'disabled' : ''}>${owned ? 'Deținut' : '💰 ' + r.cost}</button>
      `;
      div.querySelector('.btn-buy').onclick = () => {
        if (!owned && playerCoins >= r.cost) {
          playerCoins -= r.cost; playerRelics.push(key);
          if(el('shop-coins')) el('shop-coins').textContent = playerCoins;
          playSound('buy'); saveCloudProgress(); renderShop();
        }
      };
      container.appendChild(div);
    });
  } else {
    playerDeck.forEach((cardKey, idx) => {
      const c = CARDS_DB[cardKey];
      const div = document.createElement('div');
      div.className = "shop-card-item";
      div.innerHTML = `
        <div class="shop-card-info"><div class="shop-card-title">${c.name}</div><div class="shop-card-desc">${c.desc}</div></div>
        <button class="btn-buy" style="background:#ef4444;" ${(playerCoins < 25 || playerDeck.length <= 4) ? 'disabled' : ''}>Elimină (25 💰)</button>
      `;
      div.querySelector('.btn-buy').onclick = () => {
        if (playerCoins >= 25 && playerDeck.length > 4) {
          playerCoins -= 25; playerDeck.splice(idx, 1);
          if(el('shop-coins')) el('shop-coins').textContent = playerCoins;
          playSound('buy'); saveCloudProgress(); renderShop();
        }
      };
      container.appendChild(div);
    });
  }
}

if(el('btn-next-stage')) {
  el('btn-next-stage').onclick = () => {
    if(el('shop-overlay')) {
      el('shop-overlay').classList.remove('active');
      setTimeout(() => el('shop-overlay').classList.add('hidden'), 250);
    }
    currentStageLevel++; initSoloStage(currentStageLevel);
    initLocalDeck(); updateUI(soloState); startTurnTimer();
  };
}

if(el('btn-pause-game')) {
  el('btn-pause-game').onclick = () => {
    if(el('pause-overlay')) {
      el('pause-overlay').classList.remove('hidden');
      setTimeout(() => el('pause-overlay').classList.add('active'), 20);
    }
  };
}

if(el('btn-resume')) {
  el('btn-resume').onclick = () => {
    if(el('pause-overlay')) {
      el('pause-overlay').classList.remove('active');
      setTimeout(() => el('pause-overlay').classList.add('hidden'), 250);
    }
  };
}

if(el('btn-exit-lobby')) {
  el('btn-exit-lobby').onclick = () => {
    clearInterval(turnTimerInterval);
    if(el('pause-overlay')) {
      el('pause-overlay').classList.remove('active');
      setTimeout(() => el('pause-overlay').classList.add('hidden'), 250);
    }
    switchScreen('game-container', 'lobby-overlay');
    checkSaveFile();
  };
}

function endTurn(currentData) {
  if (currentData.turn !== playerRole) return;
  lastPlayedCardType = null;

  if (reservedCardKey) {
    const resIdx = localHand.indexOf(reservedCardKey);
    if (resIdx > -1) localHand.splice(resIdx, 1);
  }

  discardPile.push(...localHand);
  localHand = reservedCardKey ? [reservedCardKey] : [];
  const drawAmount = 4 + (playerTalents.quick_hands || 0) - localHand.length;
  drawCards(drawAmount);

  if (gameMode === 'solo') {
    soloState.turn = 'p2';
    const stageInfo = generateStageData(currentStageLevel);

    if (soloState.p1.stun > 0) {
      soloState.p1.stun--;
      soloState.lastAction = `${playerName} este ÎNGHEȚAT 🧊!`;
      triggerFloatText(el('player-avatar'), `🧊`, 'stun');
      updateUI(soloState);
      setTimeout(() => runEnemyTurn(stageInfo), 1000);
    } else {
      runEnemyTurn(stageInfo);
    }
  } else if(currentRoomId) {
    const opponentRole = playerRole === 'p1' ? 'p2' : 'p1';
    const myState = currentData[playerRole];
    const updates = {};
    updates[`rooms/${currentRoomId}/turn`] = opponentRole;
    updates[`rooms/${currentRoomId}/${opponentRole}/energy`] = 3;
    updates[`rooms/${currentRoomId}/${opponentRole}/shield`] = 0;
    updates[`rooms/${currentRoomId}/lastAction`] = `${myState.name || playerRole.toUpperCase()} a încheiat tura.`;
    update(ref(db), updates);
  }
}

function runEnemyTurn(stageInfo) {
  let cardCount = currentStageLevel >= 450 ? 3 : 2;

  if (soloState.p2.stun > 0) {
    soloState.p2.stun--; cardCount = 0;
    triggerFloatText(el('enemy-avatar'), `🧊`, 'stun');
    soloState.lastAction = `${stageInfo.name} este ÎNGHEȚAT 🧊!`;
  } else {
    soloState.lastAction = `Tura inamicului ${stageInfo.name}...`;
  }
  updateUI(soloState);

  setTimeout(() => {
    soloState.p2.shield = 0;
    if (soloState.p2.poison > 0) {
      soloState.p2.hp = Math.max(0, soloState.p2.hp - soloState.p2.poison);
      triggerFloatText(el('enemy-avatar'), `-${soloState.p2.poison} 🧪`, 'poison');
    }
    if (soloState.p2.bleed > 0) {
      soloState.p2.hp = Math.max(0, soloState.p2.hp - soloState.p2.bleed);
      triggerFloatText(el('enemy-avatar'), `-${soloState.p2.bleed} 🩸`, 'dmg');
    }

    if (cardCount > 0) {
      const enemyActions = pickEnemyCards(stageInfo, cardCount);
      let actionLogs = [];
      for (let action of enemyActions) {
        if (soloState.p1.hp > 0 && soloState.p2.hp > 0) {
          executeEnemyAction(action, stageInfo);
          actionLogs.push(`${action.name} (${action.val})`);
        }
      }
      soloState.lastAction = `${stageInfo.name} a jucat: ${actionLogs.join(" + ")}!`;
    }

    if (soloState.p1.hp <= 0) {
      soloState.lastAction = `Ai fost înfrânt pe Nivelul ${currentStageLevel}! GAME OVER.`;
      soloState.turn = 'ended'; clearInterval(turnTimerInterval);
    } else {
      soloState.turn = 'p1';
      soloState.p1.energy = soloState.p1.maxEnergy;
      soloState.p1.shield = playerRelics.includes('eternal_shield') ? 4 : 0;
      startTurnTimer();
    }
    updateUI(soloState);
  }, 800);
}

function pickEnemyCards(stageInfo, count) {
  const actions = [];
  const hpPercent = (soloState.p2.hp / soloState.p2.maxHp) * 100;
  const isHardcore = currentStageLevel >= 430;

  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    if (currentStageLevel >= 20 && rand < 0.22 && !actions.some(a => a.type === 'stun')) {
      actions.push({ type: 'stun', val: 1, name: 'Îngheț' });
    } else if (hpPercent < 50 && soloState.p2.hp < soloState.p2.maxHp && rand < (isHardcore ? 0.65 : 0.45) && !actions.some(a => a.type === 'heal')) {
      actions.push({ type: 'heal', val: stageInfo.healVal, name: 'Regenerare' });
    } else if (rand < 0.40) {
      actions.push({ type: 'defense', val: stageInfo.shieldVal, name: 'Apărare' });
    } else {
      const range = stageInfo.maxDmg - stageInfo.baseDmg;
      const dmgVal = stageInfo.baseDmg + Math.floor(Math.random() * (range + 1));
      actions.push({ type: 'attack', val: dmgVal, name: 'Atac' });
    }
  }
  return actions;
}

function executeEnemyAction(action, stageInfo) {
  if (action.type === 'attack') {
    let dmg = action.val;
    if (currentWeather.id === 'heat') dmg += 4;

    if (soloState.p1.trap > 0) {
      let reflected = Math.floor(dmg * 0.5);
      soloState.p2.hp = Math.max(0, soloState.p2.hp - reflected);
      soloState.p1.trap = 0; triggerFloatText(el('enemy-avatar'), `-${reflected} 🪤`, 'dmg');
    }

    if (soloState.p1.shield > 0) {
      if (soloState.p1.shield >= dmg) { soloState.p1.shield -= dmg; dmg = 0; }
      else { dmg -= soloState.p1.shield; soloState.p1.shield = 0; }
    }
    soloState.p1.hp = Math.max(0, soloState.p1.hp - dmg);
    triggerFloatText(el('player-avatar'), `-${dmg}`, 'dmg');
    shakeAvatar(el('player-avatar'), true);
    addUltCharge(20); playSound('attack');

  } else if (action.type === 'defense') {
    soloState.p2.shield += action.val;
    triggerFloatText(el('enemy-avatar'), `+${action.val} 🛡️`, 'shield'); playSound('shield');
  } else if (action.type === 'heal') {
    soloState.p2.hp = Math.min(soloState.p2.maxHp, soloState.p2.hp + action.val);
    triggerFloatText(el('enemy-avatar'), `+HP`, 'heal'); playSound('heal');
  } else if (action.type === 'stun') {
    soloState.p1.stun = 1; triggerFloatText(el('player-avatar'), `🧊`, 'stun'); playSound('shield');
  }
}

function shuffle(arr) { arr.sort(() => Math.random() - 0.5); }

function updateUI(data) {
  const isMyTurn = data.turn === playerRole;
  const me = data[playerRole];
  const opponent = data[playerRole === 'p1' ? 'p2' : 'p1'];

  if(el('p1-name')) el('p1-name').textContent = me.name || (playerRole === 'p1' ? 'P1' : 'P2');
  if(el('p1-hp')) el('p1-hp').textContent = me.hp;
  if(el('p1-max-hp')) el('p1-max-hp').textContent = me.maxHp || 100;
  if(el('p1-shield')) el('p1-shield').textContent = me.shield;
  if(el('p1-energy')) el('p1-energy').textContent = me.energy;
  if(el('p1-max-energy')) el('p1-max-energy').textContent = me.maxEnergy || 3;
  if(el('player-avatar')) el('player-avatar').textContent = me.avatar || "🧙‍♂️";

  if (me.stun && Number(me.stun) > 0) { if(el('p1-stun-wrap')) el('p1-stun-wrap').classList.remove('hidden'); }
  else { if(el('p1-stun-wrap')) el('p1-stun-wrap').classList.add('hidden'); }

  if (me.trap && Number(me.trap) > 0) { if(el('p1-trap-wrap')) el('p1-trap-wrap').classList.remove('hidden'); }
  else { if(el('p1-trap-wrap')) el('p1-trap-wrap').classList.add('hidden'); }

  if (gameMode === 'solo') {
    if(el('p1-coins')) el('p1-coins').textContent = playerCoins;
    if(el('player-relics-bar')) el('player-relics-bar').innerHTML = playerRelics.map(rk => RELICS_DB[rk].icon).join(" ");
  }

  if(el('p2-name')) el('p2-name').textContent = opponent.name || (playerRole === 'p1' ? 'P2' : 'P1');
  if(el('p2-hp')) el('p2-hp').textContent = opponent.hp;
  if(el('p2-max-hp')) el('p2-max-hp').textContent = opponent.maxHp || 100;
  if(el('p2-shield')) el('p2-shield').textContent = opponent.shield;
  if(el('enemy-avatar')) el('enemy-avatar').textContent = opponent.avatar || "👺";

  if (opponent.poison && opponent.poison > 0) { if(el('p2-poison-wrap')) { el('p2-poison-wrap').classList.remove('hidden'); if(el('p2-poison')) el('p2-poison').textContent = opponent.poison; } } 
  else { if(el('p2-poison-wrap')) el('p2-poison-wrap').classList.add('hidden'); }

  if (opponent.bleed && opponent.bleed > 0) { if(el('p2-bleed-wrap')) { el('p2-bleed-wrap').classList.remove('hidden'); if(el('p2-bleed')) el('p2-bleed').textContent = opponent.bleed; } } 
  else { if(el('p2-bleed-wrap')) el('p2-bleed-wrap').classList.add('hidden'); }

  if (opponent.stun && Number(opponent.stun) > 0) { if(el('p2-stun-wrap')) el('p2-stun-wrap').classList.remove('hidden'); } 
  else { if(el('p2-stun-wrap')) el('p2-stun-wrap').classList.add('hidden'); }

  if (opponent.trap && Number(opponent.trap) > 0) { if(el('p2-trap-wrap')) el('p2-trap-wrap').classList.remove('hidden'); } 
  else { if(el('p2-trap-wrap')) el('p2-trap-wrap').classList.add('hidden'); }

  const reserveBox = el('reserve-slot-box');
  if(reserveBox) {
    reserveBox.textContent = reservedCardKey ? CARDS_DB[reservedCardKey].name.substring(0, 2) : "➕";
    reserveBox.onclick = () => {
      if (reservedCardKey) { localHand.push(reservedCardKey); reservedCardKey = null; updateUI(data); }
    };
  }

  if(el('combat-log')) el('combat-log').textContent = data.lastAction;
  if(el('end-turn-btn')) el('end-turn-btn').disabled = !isMyTurn;
  if(el('draw-count')) el('draw-count').textContent = drawPile.length;
  if(el('discard-count')) el('discard-count').textContent = discardPile.length;

  const handEl = el('hand-container');
  if(!handEl) return;
  handEl.innerHTML = "";
  
  localHand.forEach((key, i) => {
    const card = CARDS_DB[key];
    let finalCost = card.cost;
    if (currentWeather.id === 'storm') finalCost = Math.max(0, card.cost - 1);

    const c = document.createElement('div');
    c.className = `card ${card.type}-card ${(!isMyTurn || me.energy < finalCost) ? 'disabled' : ''}`;
    c.innerHTML = `
      <button class="btn-pin-card">📌</button>
      <div class="card-header"><span class="card-title">${card.name}</span><span class="card-cost">${finalCost}</span></div>
      <div class="card-desc">${card.desc}</div>
    `;
    
    c.querySelector('.btn-pin-card').onclick = (e) => {
      e.stopPropagation();
      if (!reservedCardKey) { reservedCardKey = localHand.splice(i, 1)[0]; updateUI(data); }
    };

    c.onclick = () => playCard(i, data);
    handEl.appendChild(c);
  });

  const endTurnBtn = el('end-turn-btn');
  if(endTurnBtn) endTurnBtn.onclick = () => endTurn(data);
}
