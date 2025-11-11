import { Grid } from './grid.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { analyzeStability } from './wave.js';
import { FeelPresets } from './animations.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const undoBtn = document.getElementById('btn-undo');
const restartBtn = document.getElementById('btn-restart');
const levelSelect = document.getElementById('level-select');
const feelSel = document.getElementById('feel');
const muteBtn = document.getElementById('btn-mute');

let currentLevelIndex = 0;
let levels = [];
let grid = null;
let renderer = new Renderer(canvas);
let input = null;
let undoStack = [];
let audioCtx = null;
let muted = false;

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
        const res = await fetch(`../src/levels/${f}`);
        if(!res.ok) throw new Error('Failed to load '+f);
        return res.json();
    }));

    //populate level select
    levelSelect.innerHTML = '';
    levels.forEach((lvl, i)=>{
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i.toString().padStart(2,'0')} - ${lvl.name}`;
        levelSelect.appendChild(opt);
    });
}

function startLevel(i){
    currentLevelIndex = i;
    const level = levels[i];
    grid = Grid.fromLevel(level);
    undoStack = [];
    statusEl.textContent = level.name;

    //re create input with grid projection
    input = new Input(
        canvas,
        (px,py)=> pickCell(px,py,grid,renderer),
        (gx,gy)=> rotateAt(gx,gy)
    );

    sfxClick();
}
function rotateAt(x,y){
    const t = grid.get(x,y);
    if(!t) return;

    //push undo
    undoStack.push({ x, y, dir: t.direction });
    sfxRotate();
    const now = performance.now();
    t.rotate(FEEL, now);
}

function undo(){
    const last = undoStack.pop();
    if(!last) return;
    const t = grid.get(last.x, last.y);
    if(!t) return;
    t.direction = last.dir;
    t.targetAngle = t.dirToAngle(t.direction);
    t.animating = false;
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

    if(solved){
        statusEl.textContent = `Solved: ${levels[currentLevelIndex].name}`;
    } else {
        statusEl.textContent = `${levels[currentLevelIndex].name}`;
    }

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

//Ui wiring
undoBtn.addEventListener('click', ()=>{ undo(); });
restartBtn.addEventListener('click', ()=>{ restart(); });
feelSel.addEventListener('change', ()=>{ FEEL = FeelPresets[feelSel.value]; sfxClick(); });
levelSelect.addEventListener('change', ()=>{ startLevel(parseInt(levelSelect.value,10)); });
muteBtn.addEventListener('click', ()=>{ muted = !muted; muteBtn.textContent = muted? 'Unmute':'Mute'; sfxClick(); });

//Booting
(async function main() {
    await loadLevels();
    startLevel(0);
    requestAnimationFrame(loop);
})();