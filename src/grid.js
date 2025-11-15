import { Tile } from './tile.js';

export class Grid {
    constructor(cols, rows){
        this.cols = cols;
        this.rows = rows;
        this.tiles = new Array(cols * rows);
    }

    index(x,y){return y * this.cols + x;}
    inBounds(x,y){return x>=0 && x<this.cols && y>=0 && y<this.rows;}

    get(x,y){return this.tiles[this.index(x,y)];}
    set(x,y,tile){ this.tiles[this.index(x,y)] = tile;}

    forEach(cb){
        for(let y=0;y<this.rows;y++){
            for(let x=0;x<this.cols;x++){
                cb(this.get(x,y), x,y);
            }
        }
    }

    static fromLevel(level){
        const g = new Grid(level.cols, level.rows);
        for(let y=0;y<level.rows;y++){
            const row = level.tiles[y] || [];
            for(let x=0;x<level.cols;x++){
                const d = row[x] ?? null;
                g.set(x, y, d ? new Tile(x, y, d) : null);
            }
        }
        return g;
    }
}