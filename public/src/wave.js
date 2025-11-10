import { OPP, OPP } from './tile.js';

export function analyzeStability(grid){
    const links = new Map();   //key: "x,y" -> partnerkey
    const cols = grid.cols, rows = grid.rows;

    function key(x,y){ return `${x},${y}`; }

    grid.forEach((tile, x, y)=>{
        if(!tile) return;
        const k = key(x,y);
        if(links.has(k)) return;

        let tx = x, ty = y;
        let dx=0, dy=0;
        switch(tile.direction){
            case 'up': dy = -1; break;
            case 'down': dy = 1; break;
            case 'left': dx = -1; break;
            case 'right': dx = 1; break;
        }

        // March unit we can see another tile or leave bound
        let found = null;
        while(true){
            tx += dx; ty += dy;
            if(tx<0 || tx>=cols || ty<0 || ty>=rows){ break; }
            const hit = grid.get(tx,ty);
            if(hit){ found = { hit, hx: tx, hy: ty }; break; }
        }

        if(!found){
            return;
        }

        const { hit, hx, hy } = found;
        const opp = OPP[tile.direction];
        if(hit.direction === opp){

            // candidate stable
            const hk = key(hx,hy);
            if(links.has(hk)){
                //already paired elsewhere -> invaild all
                links.set(k, '__conflict__');
            } else {
                links.set(k, hk);
                links.set(hk, k);
            }
        }
    });

    //valid if every tile is paired exactly once and no conflicts
    let total = 0, paired = 0;
    let conflict = false;
    grid.forEach((t,x,y)=>{
        if(!t) return;
        total++;
        const k = `${x},${y}`;
        if(links.get(k) === '__conflict__') conflict = true;
        if(links.has(k)) paired++;
    });

    const solved = !conflict && paired === total && total>0;
    return { solved, links };
}