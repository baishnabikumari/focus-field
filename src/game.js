import { Grid } from './grid.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { analyzeStability } from './wave.js';
import { FeelPresets } from './animations.js';

const canvas = document.getElementById('game');
const redoBtn = document.getElementById('btn-redo');
const undoBtn = document.getElementById('btn-undo');
const restartBtn = document.getElementById('btn-restart');
const levelSelect = document.getElementById('level-select');
const feelBtn = document.getElementById('feel-btn');
const feelOptions = document.getElementById('feel-options');
const feelItems = document.querySelectorAll('.dropdown-item')
const muteBtn = document.getElementById('btn-mute');
const snowBtn = document.getElementById('btn-snow');
const snowContainer = document.getElementById('snow-container');

let currentLevelIndex = 0;
let levels = [];
let grid = null;
let renderer = new Renderer(canvas);
let input = null;

let undoStack = [];
let redoStack = [];

let audioCtx = null;
let muted = false;
let isSnowing = false;

//feel selection 
let FEEL = FeelPresets['B'];

function sfxClick(){ if(muted) return; tone(220, 0.03, 0.001); }
function sfxRotate(){ if(muted) return; tone(340, 0.06, 0.002); }
function sfxSolved(){ if(muted) return; chord([392,494,587], 0.35); }

function ensureAudio(){
    if(!audioCtx){
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

let audioInitialized = false;
function tryResumeAudioOnGesture(){
    // Ensure audio context exists, then resume it if suspended.
    try{
        if(!audioCtx) ensureAudio();
        if(audioCtx && audioCtx.state === 'suspended'){
            audioCtx.resume().catch(()=>{});
        }
    }catch(e){}
}

function tone(freq, dur, attack){
    ensureAudio();
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.15, t0 + (attack||0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
}
function chord(freqs, dur){ freqs.forEach((f,i)=> setTimeout(()=>tone(f, dur, 0.005), i*12)); }

async function loadLevels() {
    const files = ['tutorial.json','level1.json','level2.json','level3.json','level4.json'];
    levels = await Promise.all(files.map(async f=>{
        const res = await fetch(`./levels/${f}`);
        if(!res.ok) throw new Error('Failed to load '+f);
        const lvl = await res.json();

        if(!Array.isArray(lvl.tiles)) lvl.tiles = [];
        if(typeof lvl.rows !== 'number') lvl.rows = lvl.tiles.length;
        if(typeof lvl.cols !== 'number') lvl.cols = Math.max(...lvl.tiles.map(r => Array.isArray(r) ? r.length : 0), 0);

        for(let y = 0; y < lvl.rows; y++){
            if(!Array.isArray(lvl.tiles[y])) lvl.tiles[y] = [];
            for(let x = 0; x < lvl.cols; x++){
                let v = lvl.tiles[y][x];
                if(typeof v === 'string'){
                    v = v.trim().toLowerCase();
                    if(!['up','right','down','left'].includes(v)) v = null;
                    lvl.tiles[y][x] = v;
                } else {
                    lvl.tiles[y][x] = null;
                }
            }
        }
        return lvl;
    }));

    //populate level select
    levelSelect.innerHTML = '';
    levels.forEach((lvl, i)=>{
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i === 0 ? "TUTORIAL" : `LEVEL ${i}`;
        levelSelect.appendChild(opt);
    });
}

function startLevel(i){
    currentLevelIndex = i;
    const level = levels[i];
    grid = Grid.fromLevel(level);

    undoStack = [];
    redoStack = [];

    if(input){
        input.dispose();
    }
    //re create input with grid projection
    input = new Input(
        canvas,
        (px,py)=> pickCell(px,py,grid,renderer),
        (gx,gy)=> rotateAt(gx,gy)
    );

    sfxClick();
}
function rotateAt(x,y){
    tryResumeAudioOnGesture();
    const t = grid.get(x,y);
    if(!t) return;

    //push undo
    undoStack.push({ x, y, dir: t.direction });
    redoStack = [];
    sfxRotate();
    const now = performance.now();
    t.rotate(FEEL, now);
}

function undo(){
    const last = undoStack.pop();
    if(!last) return;
    const t = grid.get(last.x, last.y);
    if(!t) return;

    redoStack.push({ x: last.x, y: last.y, dir: t.direction })

    t.direction = last.dir;
    t.targetAngle = t.dirToAngle(t.direction);
    t.animating = false;
    sfxClick();
}

function redo(){
    const next = redoStack.pop();
    if(!next) return;

    const t = grid.get(next.x, next.y);
    if(!t) return;
    undoStack.push({x: next.x, y: next.y, dir: t.direction });

    t.direction = next.dir;
    t.targetAngle = t.dirToAngle(t.direction);
    t.animating = false;
    sfxClick();
}

function restart(){ startLevel(currentLevelIndex); }

function pickCell(px, py, grid, renderer){

    //reverse of renderer layout
    const layout = renderer.layoutFor(grid);
    const s = layout.s;
    const offsetX = (canvas.width - (renderer.padding*2 + grid.cols*renderer.cell)*s)/2;
    const offsetY = (canvas.height - (renderer.padding*2 + grid.rows*renderer.cell)*s)/2;

    const x = (px - offsetX)/s - renderer.padding;
    const y = (py - offsetY)/s - renderer.padding;
    if(x<0||y<0) return null;
    const gx = Math.floor(x / renderer.cell);
    const gy = Math.floor(y / renderer.cell);
    if(gx<0||gx>=grid.cols||gy<0||gy>=grid.rows) return null;
    return { x: gx, y: gy };
}

function loop(now){
    if(!grid) return requestAnimationFrame(loop);

    const { solved } = analyzeStability(grid);
    renderer.hover = input?.hover || null;

    renderer.drawGrid(grid, now, FEEL);
    if(solved && !loop._solvedFired){
        loop._solvedFired = true;
        sfxSolved();
        setTimeout(()=>{
            const next = (currentLevelIndex + 1) % levels.length;
            startLevel(next);
            loop._solvedFired = false;
        }, 700);
    }
    requestAnimationFrame(loop);
}

function toggleSnow(){
    isSnowing = !isSnowing;
    if(isSnowing){
        snowContainer.style.display = 'block';
        startSnow();
    } else {
        snowContainer.style.display = 'none';
        snowContainer.innerHTML = '';
    }
    sfxClick();
}
function startSnow(){
    const count = 50;
    for(let i = 0; i<count; i++){
        createSnowflake();
    }
}
function createSnowflake(){
    if(!isSnowing) return;
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

    if(!document.getElementById('snow-style')){
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
restartBtn.addEventListener('click', restart);
muteBtn.addEventListener('click', ()=>{
    muted = !muted;
    muteBtn.textContent = muted? 'UNMUTE':'MUTE';
    sfxClick();
});
snowBtn.addEventListener('click', toggleSnow);

levelSelect.addEventListener('change', () => {
    startLevel(parseInt(levelSelect.value,10));
});

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
        feelBtn.textContent = item.textContent;

        feelOptions.classList.remove('show-dropdown');
        sfxClick();
    });
});
window.addEventListener('click', () => {
    if(feelOptions.classList.contains('show-dropdown')){
        feelOptions.classList.remove('show-dropdown');
    }
});

//Booting
(async function main() {
    await loadLevels();
    startLevel(0);
    requestAnimationFrame(loop);
})();