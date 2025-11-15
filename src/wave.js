import { OPP } from './tile.js';

export function analyzeStability(grid){
    const links = new Map();
    const cols = grid.cols, rows = grid.rows;

    function key(x,y){ return `${x},${y}`; }

    grid.forEach((tile, x, y) => {
        if(!tile) return;
        const k = key(x,y);
        if(links.has(k)) return;

        let tx = x, ty = y;
        let dx = 0, dy = 0;
        switch(tile.direction){
            case 'up': dy = -1; break;
            case 'down': dy = 1; break;
            case 'left': dx = -1; break;
            case 'right': dx = 1; break;
            default: return;
        }

        let found = null;
        while(true){
            tx += dx; ty += dy;
            if(tx < 0 || tx >= cols || ty < 0 || ty >= rows) break;
            const hit = grid.get(tx, ty);
            if(hit){
                found = { hit, hx: tx, hy: ty };
                break;
            }
        }

        if(!found) return;

        const { hit, hx, hy } = found;
        const hk = key(hx, hy);

        const expectedOpp = OPP[tile.direction];
        if(hit.direction !== expectedOpp) return;

        if(links.has(hk) && links.get(hk) !== k){
            links.set(k, '__conflict__');
            const existing = links.get(hk);
            if(existing && existing !== '__conflict__') {
                links.set(existing, '__conflict__');
                links.set(hk, '__conflict__');
            } else {
                links.set(hk, '__conflict__');
            }
        } else {
            links.set(k, hk);
            links.set(hk, k);
        }
    });

    let total = 0, paired = 0;
    let conflict = false;
    grid.forEach((t,x,y)=>{
        if(!t) return;
        total++;
        const k = `${x},${y}`;
        if(links.get(k) === '__conflict__') conflict = true;
        if(links.has(k) && links.get(k) !== '__conflict__') paired++;
    });

    const solved = !conflict && paired === total && total > 0;
    return { solved, links };
}