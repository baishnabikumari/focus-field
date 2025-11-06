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
        
    }
}