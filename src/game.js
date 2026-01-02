import { Grid } from './grid.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { analyzeStability } from './wave.js';
import { FeelPresets } from './animations.js';

const canvas = document.getElementById('game');
const redoBtn = document.getElementById('btn-redo');
const undoBtn = document.getElementById('btn-undo');
const restartBtn = document.getElementById('btn-restart');
const levelBtn = document.getElementById('level-btn');
const levelOptions = document.getElementById('level-options');
const feelBtn = document.getElementById('feel-btn');
const feelOptions = document.getElementById('feel-options');
const feelItems = document.querySelectorAll('.dropdown-item')
const muteBtn = document.getElementById('btn-mute');
const snowBtn = document.getElementById('btn-snow');
const snowContainer = document.getElementById('snow-container');
const moveCounterEl = document.getElementById('move-counter');
const toast = document.getElementById('toast'); //toast for restart button

let currentLevelIndex = 0;
let maxUnlockedLevel = 0;
let levels = [];
let grid = null;
let renderer = new Renderer(canvas);
let input = null;

let undoStack = [];
let redoStack = [];

let audioCtx = null;
let muted = false;
let isSnowing = false;
const STORAGE_KEY = 'focus_field_save_v1';

//feel selection 
let FEEL = FeelPresets['B'];
let currentFeelKey = 'B';
let moves = 0;

const bgmTracks = {
    A: new Audio('assets/SOFT.mp3'),
    B: new Audio('assets/snappy.mp3'),
    C: new Audio('assets/crisp.mp3')
};
Object.values(bgmTracks).forEach(track => track.loop = true);

function sfxClick() { if (muted) return; tone(220, 0.03, 0.001); }
function sfxRotate() { if (muted) return; tone(340, 0.06, 0.002); }
function sfxSolved() { if (muted) return; chord([392, 494, 587], 0.35); }

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

let audioInitialized = false;
function tryResumeAudioOnGesture() {
    // Ensure audio context exists, then resume it if suspended.
    try {
        if (!audioCtx) ensureAudio();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => { });
        }

        const track = bgmTracks[currentFeelKey];
        if (!muted && track.pause) {
            track.play().catch(e => console.log("Music start attempt:", e));
        }
    } catch (e) { }
}

function tone(freq, dur, attack) {
    ensureAudio();
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.15, t0 + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
}
function chord(freqs, dur) { freqs.forEach((f, i) => setTimeout(() => tone(f, dur, 0.005), i * 12)); }

async function loadLevels() {
    const files = ['tutorial.json', 'level1.json', 'level2.json', 'level3.json', 'level4.json', 'level5.json'];
    levels = await Promise.all(files.map(async f => {
        const res = await fetch(`./levels/${f}`);
        if (!res.ok) throw new Error('Failed to load ' + f);
        const lvl = await res.json();

        if (!Array.isArray(lvl.tiles)) lvl.tiles = [];
        if (typeof lvl.rows !== 'number') lvl.rows = lvl.tiles.length;
        if (typeof lvl.cols !== 'number') lvl.cols = Math.max(...lvl.tiles.map(r => Array.isArray(r) ? r.length : 0), 0);

        for (let y = 0; y < lvl.rows; y++) {
            if (!Array.isArray(lvl.tiles[y])) lvl.tiles[y] = [];
            for (let x = 0; x < lvl.cols; x++) {
                let v = lvl.tiles[y][x];

                let isLocked = false;

                if(typeof v === 'string' && v.endsWith('!')){
                    isLocked = true;
                    v = v.slice(0, -1);
                }
                if (typeof v === 'string') {
                    v = v.trim().toLowerCase();
                    if (!['up', 'right', 'down', 'left'].includes(v)) v = null;
                    lvl.tiles[y][x] = {dir: v, locked: isLocked};
                } else {
                    lvl.tiles[y][x] = null;
                }
            }
        }
        return lvl;
    }));
    renderLevelList();

    //populate level select
    levelOptions.innerHTML = '';
    levels.forEach((lvl, i) => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.textContent = i === 0 ? "TUTORIAL" : `LEVEL ${i}`;

        div.addEventListener('click', (e) => {
            e.stopPropagation();
            startLevel(i);
            levelOptions.classList.remove('show-dropdown');
        });
        levelOptions.appendChild(div);
    });
}

function renderLevelList() {
    levelOptions.innerHTML = '';
    levels.forEach((lvl, i) => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';

        const isLocked = i > maxUnlockedLevel;
        if(isLocked){
            div.textContent = `LEVEL ${i} 🔒`;
            div.style.opacity = "0.5";
        } else {
            div.textContent = i === 0 ? "TUTORIAL" : `LEVEL ${i}`;
            div.style.opacity = "1";
        }
        div.addEventListener('click', (e) => {
            e.stopPropagation();

            if(isLocked){
                showToast("LEVEL LOCKED 🔒");
            } else {
                startLevel(i);
                levelOptions.classList.remove('show-dropdown');
            }
        });
        levelOptions.appendChild(div);
    });
}

function saveProgress() {
    const data = {
        levelIndex: currentLevelIndex,
        maxUnlocked: maxUnlockedLevel
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadProgress() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function startLevel(i) {
    currentLevelIndex = i;
    const level = levels[i];
    grid = Grid.fromLevel(level);

    undoStack = [];
    redoStack = [];
    moves = 0;
    if(moveCounterEl) moveCounterEl.textContent = "MOVES: 0";

    if (input) {
        input.dispose();
    }
    //re create input with grid projection
    input = new Input(
        canvas,
        (px, py) => pickCell(px, py, grid, renderer),
        (gx, gy) => rotateAt(gx, gy)
    );

    sfxClick();
    levelBtn.textContent = i === 0 ? "TUTORIAL" : `LEVEL ${i}`;
    saveProgress();
}

levelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    feelOptions.classList.remove('show-dropdown');
    levelOptions.classList.toggle('show-dropdown');
    sfxClick();
});
window.addEventListener('click', () => {
    feelOptions.classList.remove('show-dropdown');
    levelOptions.classList.remove('show-dropdown');
});

function rotateAt(x, y) {
    tryResumeAudioOnGesture();
    const t = grid.get(x, y);

    if (!t || t.locked) return;

    //push undo
    undoStack.push({ x, y, dir: t.direction });
    redoStack = [];
    sfxRotate();
    const now = performance.now();
    t.rotate(FEEL, now);

    moves++;
    if(moveCounterEl) moveCounterEl.textContent = `MOVES: ${moves}`;
}

function undo() {
    const last = undoStack.pop();
    if (!last) return;
    const t = grid.get(last.x, last.y);
    if (!t) return;

    redoStack.push({ x: last.x, y: last.y, dir: t.direction })

    t.direction = last.dir;
    t.targetAngle = t.dirToAngle(t.direction);
    t.animating = false;
    sfxClick();
}

function redo() {
    const next = redoStack.pop();
    if (!next) return;

    const t = grid.get(next.x, next.y);
    if (!t) return;
    undoStack.push({ x: next.x, y: next.y, dir: t.direction });

    t.direction = next.dir;
    t.targetAngle = t.dirToAngle(t.direction);
    t.animating = false;
    sfxClick();
}

function restart() { startLevel(currentLevelIndex); }

function pickCell(px, py, grid, renderer) {

    //reverse of renderer layout
    const layout = renderer.layoutFor(grid);
    const s = layout.s;
    const offsetX = (canvas.width - (renderer.padding * 2 + grid.cols * renderer.cell) * s) / 2;
    const offsetY = (canvas.height - (renderer.padding * 2 + grid.rows * renderer.cell) * s) / 2;

    const x = (px - offsetX) / s - renderer.padding;
    const y = (py - offsetY) / s - renderer.padding;
    if (x < 0 || y < 0) return null;
    const gx = Math.floor(x / renderer.cell);
    const gy = Math.floor(y / renderer.cell);
    if (gx < 0 || gx >= grid.cols || gy < 0 || gy >= grid.rows) return null;
    return { x: gx, y: gy };
}

function loop(now) {
    if (!grid) return requestAnimationFrame(loop);

    const { solved } = analyzeStability(grid);
    renderer.hover = input?.hover || null;

    renderer.drawGrid(grid, now, FEEL);
    if (solved && !loop._solvedFired) {
        loop._solvedFired = true;
        sfxSolved();

        renderer.explode(); //explode(confetti)

        if(currentLevelIndex === maxUnlockedLevel && currentLevelIndex + 1 < levels.length){
            maxUnlockedLevel++;
            saveProgress();
            renderLevelList();
        }

        setTimeout(() => {
            const next = (currentLevelIndex + 1) % levels.length;
            startLevel(next);
            loop._solvedFired = false;
        }, 700);
    }
    requestAnimationFrame(loop);
}

function toggleSnow() {
    isSnowing = !isSnowing;
    saveProgress();
    if (isSnowing) {
        snowContainer.style.display = 'block';
        startSnow();
    } else {
        const flakes = document.querySelectorAll('.snowflake');
        flakes.forEach(flake => {
            flake.style.animationIterationCount = '1';
        });

        setTimeout(() => {
            if (!isSnowing) {
                snowContainer.innerHTML = '';
                snowContainer.style.display = 'none';
            }
        }, 6000);
    }
    sfxClick();
}

function showToast(message){
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');

    if(toast.timeoutId) clearTimeout(toast.timeoutId);

    toast.timeoutId = setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}

function startSnow() {
    const count = 50;
    for (let i = 0; i < count; i++) {
        createSnowflake();
    }
}
function createSnowflake() {
    if (!isSnowing) return;
    const flake = document.createElement('div');
    flake.classList.add('snowflake');
    flake.textContent = '❄';

    const startX = Math.random() * window.innerWidth;
    const dur = Math.random() * 3 + 2;
    const size = Math.random() * 10 + 10 + 'px';

    flake.style.left = startX + 'px';
    flake.style.fontSize = size;
    flake.style.animation = `fall ${dur}s linear infinite`;
    snowContainer.appendChild(flake);

    if (!document.getElementById('snow-style')) {
        const style = document.createElement('style');
        style.id = 'snow-style';
        style.textContent = `
            @keyframes fall {
                0% { transform: translateY(-10vh) rotate(0deg); opacity: 0.8; }
                100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

//Ui wiring
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
restartBtn.addEventListener('click', (e) => {
    restart();
    sfxClick();

    toast.textContent = 'GAME RESTARTED';
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 1500);
});

muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? 'UNMUTE' : 'MUTE';
    sfxClick();

    const currentTrack = bgmTracks[currentFeelKey];
    if (muted) {
        currentTrack.pause();
    } else {
        currentTrack.play().catch(() => { });
    }
});
snowBtn.addEventListener('click', toggleSnow);

//dropdown
feelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    feelOptions.classList.toggle('show-dropdown');
    sfxClick();
});

feelItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = item.getAttribute('data-value');

        FEEL = FeelPresets[val];
        currentFeelKey = val;

        feelBtn.textContent = item.textContent;
        feelOptions.classList.remove('show-dropdown');
        sfxClick();
        saveProgress();

        playBackgroundMusic(currentFeelKey);
    });
});
window.addEventListener('click', () => {
    if (feelOptions.classList.contains('show-dropdown')) {
        feelOptions.classList.remove('show-dropdown');
    }
});

function playBackgroundMusic(key) {
    Object.keys(bgmTracks).forEach(k => {
        if (k !== key) {
            bgmTracks[k].pause();
            bgmTracks[k].currentTime = 0;
        }
    });
    if (!muted) {
        const track = bgmTracks[key];
        track.play().catch(e => console.log("Waiting for user interaction to play music."));
    }
}

//Booting
(async function main() {
    await loadLevels();
    const saved = loadProgress();
    let startIdx = 0;

    if (saved){
        if(typeof saved.maxUnlocked === 'number' ){
            maxUnlockedLevel = saved.maxUnlocked;
            renderLevelList();
        }
        if(typeof saved.levelIndex === 'number' && saved.levelIndex < levels.length){
            if(saved.levelIndex <= maxUnlockedLevel){
                startIdx = saved.levelIndex;
            }
        }
    }
    //     if (saved.muted) {
    //         muted = true;
    //         muteBtn.textContent = 'UNMUTE';
    //     }
    //     if (saved.isSnowing) {
    //         isSnowing = true;
    //         snowContainer.style.display = 'block';
    //         startSnow();
    //     }
    //     if (saved.feelKey && FeelPresets[saved.feelKey]) {
    //         currentFeelKey = saved.feelKey;
    //         FEEL = FeelPresets[saved.feelKey];

    //         if (currentFeelKey === 'A') feelBtn.textContent = "SOFT 🎧";
    //         if (currentFeelKey === 'B') feelBtn.textContent = "SNAPPY 🎧";
    //         if (currentFeelKey === 'C') feelBtn.textContent = "CRISP 🎧";
    //     }
    // }
    playBackgroundMusic(currentFeelKey);
    startLevel(0);
    requestAnimationFrame(loop);
})();