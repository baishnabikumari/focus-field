import { Tile } from './tile.js';

const canvas

export class Grid {
    constructor(cols, rows){
        this.cols = cols;
        this.rows = rows;
        this.tiles = new Array(cols * rows);
    }

    index(x,y){return y * this.cols + x;}
    inBounds(x,y){return x>=0 && x<this.cols && y>=0 && y<this.rows;}
}