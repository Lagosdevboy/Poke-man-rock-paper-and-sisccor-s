let animationFrameId;
let startTime;
let isRunning = false;
let splashTimeout;
const SOLDIER_SIZE = 32;
const COLLISION_THRESHOLD_SQ = (SOLDIER_SIZE * 0.8) ** 2;
let soldiers = { rock: [], paper: [], scissors: [] };
const emojis = { rock: "🪨", paper: "📜", scissors: "✂️" };
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let lastSoundTime = 0;

const i18n = {
	en: {
		title: "Roshambo Battle",
		choose: "Pick your army:",
		start: "START BATTLE",
		team: "Army:",
		speed: "Speed",
		fx: "FX",
		victory: "VICTORY!",
		defeat: "DEFEAT...",
		back: "TRY AGAIN",
		armies: { rock: "Rocks", paper: "Papers", scissors: "Scissors" },
		rules: (emoji, name) => `The ${emoji} (${name}) army ruled the battle.`
	},
	fr: {
		title: "Bataille Chifoumi !",
		choose: "Choisissez votre armée :",
		start: "LANCER LA BATAILLE",
		team: "Armée:",
		speed: "Vitesse",
		fx: "FX",
		victory: "VICTOIRE !",
		defeat: "DÉFAITE...",
		back: "RECOMMENCER",
		armies: { rock: "Pierres", paper: "Feuilles", scissors: "Ciseaux" },
		rules: (emoji, name) => `L'armée ${emoji} (${name}) a dominé la bataille.`
	}
};

const dom = {
	gameArea: document.getElementById("gameArea"),
	speed: document.getElementById("speedSlider"),
	speedOut: document.getElementById("speedValue"),
	fx: document.getElementById("fxToggle"),
	timer: document.getElementById("timeValue"),
	userChoice: document.getElementById("user-choice"),
	betArmy: document.getElementById("betArmy"),
	langSelect: document.getElementById("langSelect"),
	labelTeam: document.querySelector(".control-group span"),
	labelSpeed: document.querySelector("label[for='speedSlider']"),
	counts: {
		rock: document.getElementById("count-rock"),
		paper: document.getElementById("count-paper"),
		scissors: document.getElementById("count-scissors")
	},
	gauges: {
		rock: document.querySelector(".rock .fill"),
		paper: document.querySelector(".paper .fill"),
		scissors: document.querySelector(".scissors .fill")
	}
};

const modals = {
	splash: document.getElementById("splash"),
	start: document.getElementById("start"),
	gameOver: document.getElementById("gameOver"),
	winStatus: document.getElementById("winStatus"),
	winType: document.getElementById("winType"),
	tTitle: document.getElementById("t-title"),
	tChoose: document.getElementById("t-choose"),
	btnStart: document.getElementById("startButton"),
	btnBack: document.getElementById("toStart")
};

function setLanguage(lang) {
	localStorage.setItem("gameLang", lang);
	const t = i18n[lang];
	modals.tTitle.textContent = t.title;
	modals.tChoose.textContent = t.choose;
	modals.btnStart.textContent = t.start;
	modals.btnBack.textContent = t.back;
	dom.labelTeam.firstChild.textContent = t.team + " ";
	dom.labelSpeed.textContent = t.speed;
	dom.fx.previousElementSibling.textContent = t.fx;

	Array.from(dom.betArmy.options).forEach((opt) => {
		opt.textContent = `${emojis[opt.value]} ${t.armies[opt.value]}`;
	});

	if (isRunning || dom.userChoice.textContent !== "-") {
		const val = dom.betArmy.value;
		dom.userChoice.textContent = `${emojis[val]} ${t.armies[val].toUpperCase()}`;
	}
}

function initGame() {
	isRunning = false;
	if (animationFrameId) cancelAnimationFrame(animationFrameId);
	dom.gameArea.innerHTML = "";
	soldiers = { rock: [], paper: [], scissors: [] };
	["rock", "paper", "scissors"].forEach((type) => {
		for (let i = 0; i < 10; i++) {
			const el = document.createElement("div");
			el.className = `soldier ${type}`;
			el.textContent = emojis[type];
			const x = Math.random() * (dom.gameArea.clientWidth - SOLDIER_SIZE);
			const y = Math.random() * (dom.gameArea.clientHeight - SOLDIER_SIZE);
			el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
			dom.gameArea.appendChild(el);
			soldiers[type].push({ el, type, x, y });
		}
	});
	updateUI();
}

function updateUI() {
	const totals = {
		rock: soldiers.rock.length,
		paper: soldiers.paper.length,
		scissors: soldiers.scissors.length
	};
	const max = totals.rock + totals.paper + totals.scissors;
	for (let type in totals) {
		dom.counts[type].value = totals[type];
		dom.gauges[type].style.width =
			max > 0 ? `${(totals[type] / max) * 100}%` : "0%";
	}
}

function gameLoop(timestamp) {
	if (!isRunning) return;
	if (!startTime) startTime = timestamp;
	dom.timer.value = Math.floor((timestamp - startTime) / 1000);
	const velocity = parseFloat(dom.speed.value) * 0.5;
	const all = [...soldiers.rock, ...soldiers.paper, ...soldiers.scissors];

	all.forEach((s) => {
		s.x += (Math.random() - 0.5) * velocity * 10;
		s.y += (Math.random() - 0.5) * velocity * 10;
		s.x = Math.max(0, Math.min(dom.gameArea.clientWidth - SOLDIER_SIZE, s.x));
		s.y = Math.max(0, Math.min(dom.gameArea.clientHeight - SOLDIER_SIZE, s.y));
	});

	handleCollisions(all);

	soldiers = { rock: [], paper: [], scissors: [] };
	all.forEach((s) => {
		soldiers[s.type].push(s);
		s.el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
	});

	updateUI();
	if (checkEnd()) endGame();
	else animationFrameId = requestAnimationFrame(gameLoop);
}

function handleCollisions(all) {
	const grid = new Map();
	const rules = { rock: "scissors", paper: "rock", scissors: "paper" };

	all.forEach((s) => {
		const k = `${Math.floor(s.x / SOLDIER_SIZE)}_${Math.floor(
			s.y / SOLDIER_SIZE
		)}`;
		if (!grid.has(k)) grid.set(k, []);
		grid.get(k).push(s);
	});

	all.forEach((a) => {
		const gx = Math.floor(a.x / SOLDIER_SIZE);
		const gy = Math.floor(a.y / SOLDIER_SIZE);

		for (let x = gx - 1; x <= gx + 1; x++) {
			for (let y = gy - 1; y <= gy + 1; y++) {
				const cell = grid.get(`${x}_${y}`);
				if (!cell) continue;
				cell.forEach((b) => {
					if (a === b) return;
					const dx = a.x - b.x;
					const dy = a.y - b.y;
					if (dx * dx + dy * dy < COLLISION_THRESHOLD_SQ) {
						if (rules[a.type] === b.type) convert(b, a.type);
						else if (rules[b.type] === a.type) convert(a, b.type);
					}
				});
			}
		}
	});
}

function collideFx() {
	if (!dom.fx.checked) return;
	const now = audioCtx.currentTime;
	if (now - lastSoundTime < 0.05) return;
	lastSoundTime = now;
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();
	osc.type = "sine";
	osc.frequency.setValueAtTime(150 + Math.random() * 100, now);
	osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.1);
	gain.gain.setValueAtTime(0.1, now);
	gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
	osc.connect(gain);
	gain.connect(audioCtx.destination);
	osc.start();
	osc.stop(now + 0.1);
	if ("vibrate" in navigator) {
		navigator.vibrate(15);
	}
}

function convert(soldier, newType) {
	if (soldier.type === newType) return;
	soldier.type = newType;
	soldier.el.className = `soldier ${newType} collision`;
	soldier.el.textContent = emojis[newType];
	collideFx();
	setTimeout(() => {
		soldier.el.classList.remove("collision");
	}, 150);
}

modals.btnStart.addEventListener(
	"click",
	() => {
		if (audioCtx.state === "suspended") {
			audioCtx.resume();
		}
	},
	{ once: true }
);

function checkEnd() {
	return (
		[soldiers.rock, soldiers.paper, soldiers.scissors].filter((a) => a.length > 0)
			.length <= 1
	);
}

function endGame() {
	isRunning = false;
	const lang = dom.langSelect.value;
	const t = i18n[lang];
	const winner = Object.keys(soldiers).find((type) => soldiers[type].length > 0);
	const userBet = dom.betArmy.value;
	const isWin = winner === userBet;
	modals.gameOver.className = isWin ? "victory" : "defeat";
	modals.winStatus.textContent = isWin ? t.victory : t.defeat;
	modals.winType.textContent = t.rules(emojis[winner], t.armies[winner]);
	modals.gameOver.showModal();
}

function removeSplash() {
	if (!modals.splash || modals.splash.classList.contains("fade-out")) return;
	clearTimeout(splashTimeout);
	modals.splash.addEventListener(
		"transitionend",
		() => {
			modals.splash.remove();
			modals.splash = null;
			modals.start.showModal();
			dom.betArmy.focus();
		},
		{ once: true }
	);
	modals.splash.classList.add("fade-out");
}

dom.langSelect.onchange = (e) => setLanguage(e.target.value);
dom.speed.oninput = (e) => (dom.speedOut.value = e.target.value);
modals.splash.onclick = removeSplash;

modals.btnStart.onclick = () => {
	const lang = dom.langSelect.value;
	const selected = dom.betArmy.value;
	dom.userChoice.textContent = `${emojis[selected]} ${i18n[lang].armies[
		selected
	].toUpperCase()}`;
	modals.start.close();
	initGame();
	isRunning = true;
	startTime = null;
	animationFrameId = requestAnimationFrame(gameLoop);
};

modals.btnBack.onclick = () => {
	modals.gameOver.close();
	modals.start.showModal();
	dom.betArmy.focus();
};

const savedLang =
	localStorage.getItem("gameLang") ||
	((l) => (i18n[l] ? l : (i18n.en && "en") || Object.keys(i18n)[0]))(
		navigator.language.split("-")[0]
	);
dom.langSelect.value = savedLang;
setLanguage(savedLang);
splashTimeout = setTimeout(removeSplash, 5000);

dom.gameArea.onclick = (e) => {
	if (!isRunning) return;
	const rect = dom.gameArea.getBoundingClientRect();
	const x = e.clientX - rect.left - SOLDIER_SIZE / 2;
	const y = e.clientY - rect.top - SOLDIER_SIZE / 2;
	const types = ["rock", "paper", "scissors"];
	const type = types[Math.floor(Math.random() * types.length)];
	const el = document.createElement("div");
	el.className = `soldier ${type}`;
	el.textContent = emojis[type];
	el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
	dom.gameArea.appendChild(el);
	soldiers[type].push({ el, type, x, y });
	updateUI();
};
