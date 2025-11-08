export const DIRS = ['up','right','down','left'];
export const OPP = {up:'down', right:'left', down:'up', left:'right'};

export class Tile{
    constructor(ix,iy,direction){
        this.ix = ix;
        this.iy = iy;
        this.direction = direction;

        this.targetAngle = this.dirToAngle(direction);
        this.currentAngle = this.targetAngle;
        this.animating = false;
        this.animating = 0;
        this.animStart = 0;
        this.animDuration = 120;
        this.seed = (ix * 73856093) ^ (iy * 19349663);
    }
    dirToAngle(d){
        switch(d){
            case 'up': return -Math.PI/2;
            case 'right': return 0;
            case 'down': return Math.PI/2;
            case 'left': return Math.PI;
        }
    }

    rotate(fee1, nowMs){
        const idx = DIRS.indexOf(this.direction);
        this.direction = DIRS[(idx + 1) % 4];
        this.animDuration = fee1.rotateDuration;
        this.targetAngle = this.dirToAngle(this.direction);
        this.animating = true;
        this.animStart = nowMs;

    }

    jitter(n){
        let x = (this.seed + n) | 0;
        x ^= x << 13; x^= x >> 17; x^= x << 5; x >>>=0;
        return ((x % 1000) / 1000 - 0.5) * 0.6;
    }
}