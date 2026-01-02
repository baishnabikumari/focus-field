import { Easing } from "./animations.js";

export class Renderer {
    constructor(canvas){
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.padding = 50;
        this.cell = 80;
        this.hover = null;
        this.hoverPulse = 0;
        this.lastTime = 0;
    }

    layoutFor(grid){
        const w = this.padding*2 + grid.cols*this.cell;
        const h = this.padding*2 + grid.rows*this.cell;
        const scaleX = (this.canvas.width - 40)/w;
        const scaleY = (this.canvas.height - 40)/h;
        const s = Math.min(scaleX, scaleY);
        return { w, h, s};
    }

    drawBackground(){
        const { ctx, canvas } = this;
        ctx.clearRect(0,0,canvas.width,canvas.height);

        const g = ctx.createRadialGradient(canvas.width*0.5, canvas.height*0.4, 80, canvas.width*0.5, canvas.height*0.4, Math.max(canvas.width,canvas.height)*0.7);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.06)');
        ctx.fillStyle = g;
        ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    drawGrid(grid, now, feel){
        const { ctx } = this;
        const layout = this.layoutFor(grid);
        const s = layout.s;

        this.drawBackground();

        ctx.save();
        ctx.translate((this.canvas.width - (this.padding*2 + grid.cols*this.cell)*s)/2, (this.canvas.height - (this.padding*2 + grid.rows*this.cell)*s)/2);
        ctx.scale(s,s);

        //panel
        ctx.fillStyle = '#f8f3ea';
        ctx.strokeStyle = 'rgba(79,62,45,0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(20,20, this.padding*2 + grid.cols*this.cell - 40, this.padding*2 + grid.rows*this.cell - 40, 14);
        } else {
            //fallback
            const x=20,y=20,w=this.padding*2 + grid.cols*this.cell - 40,h=this.padding*2 + grid.rows*this.cell - 40,r=14;
            ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
            ctx.quadraticCurveTo(x+w,y,x+w,y+r);
            ctx.lineTo(x+w,y+h-r);
            ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
            ctx.lineTo(x+r,y+h);
            ctx.quadraticCurveTo(x,y+h,x,y+h-r);
            ctx.lineTo(x,y+r);
            ctx.quadraticCurveTo(x,y,x+r,y);
        }

        ctx.fill();
        ctx.stroke();

        //cells for bg subtle
        for(let y=0;y<grid.rows;y++){
            for(let x=0;x<grid.cols;x++){
                const cx = this.padding + x*this.cell;
                const cy = this.padding + y*this.cell;
                ctx.fillStyle = 'rgba(79,62,45,0.04)';
                ctx.fillRect(cx, cy, this.cell-1, this.cell-1);
            }
        }

        //tiles
        grid.forEach((tile,x,y)=>{
            if(!tile) return;
            const cx = this.padding + x*this.cell + this.cell/2;
            const cy = this.padding + y*this.cell + this.cell/2;

            //animate rotation
            if (tile.animating){
                const t = Math.min(1, (now - tile.animStart)/tile.animDuration);
                const eased = feel.moveEase(t);
                const a0 = tile.currentAngle; // angle on target
                const a1 = tile.targetAngle;

                //small angular dist.
                let da  = ((a1 - a0 + Math.PI*3) % (Math.PI*2)) - Math.PI;
                tile.currentAngle = a0 + da * eased;
                if(t>=1){ tile.currentAngle = tile.targetAngle; tile.animating=false; }
            } else {
                tile.currentAngle = tile.targetAngle;
            }

            const half = this.cell*0.36;
            const r = 10;
            const jx = tile.jitter(1), jy = tile.jitter(2);

            ctx.save();
            ctx.translate(cx + jx, cy + jy);

            if(tile.locked){
                ctx.fillStyle = '#8a7f70';
                ctx.strokeStyle = '#3e3025';
            } else {
                ctx.fillStyle = 'rgba(255,196,174,0.92)';
                ctx.strokeStyle = 'rgba(79,62,45,0.6)';
            }

            let glow = 0;//hover glow
            if(this.hover && this.hover.x===x && this.hover.y===y){
                const t = (Math.sin(now/600) + 1)/2;
                glow = t * 0.5 + 0.2;
            }
            
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            this.roundRectWobble(ctx, -half, -half, half*2, half*2, r, tile);
            ctx.fill();
            ctx.stroke();

            //direction(arrow)
            ctx.save();
            ctx.rotate(tile.currentAngle);
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(79,62,45,0.85)';
            ctx.fillStyle = 'rgba(226,143,100,0.9)';

            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(18, 0);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(6, -8);
            ctx.lineTo(6, 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.restore();

            //hover aura...
            if(glow>0){
                ctx.globalAlpha = 0.25 * glow;
                ctx.fillStyle = '#E28F64';
                ctx.beginPath();
                ctx.arc(0,0, half+10, 0, Math.PI*2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            ctx.restore();
        });
        ctx.restore();
    }

    roundRectWobble(ctx, x, y, w, h, r, tile){
        //drwing a round rect with tiny wobble offsets
        const j = (n) => tile.jitter(n);
        ctx.moveTo(x + r + j(10), y + j(11));
        ctx.lineTo(x + w - r + j(12), y + j(13));
        ctx.quadraticCurveTo(x + w + j(14), y + j(15), x + w + j(16), y + r +j(17));
        ctx.lineTo(x + w + j(18), y + h - r + j(19));
        ctx.quadraticCurveTo(x + w + j(20), y + h + j(21), x + w - r + j(22), y + h + j(23));
        ctx.lineTo(x + r +j(24), y + h + j(25));
        ctx.quadraticCurveTo(x + j(26), y + h + j(27), x + j(28), y + h - r + j(29));
        ctx.lineTo(x + j(30), y + r + j(31));
        ctx.quadraticCurveTo(x + j(32), y + j(33), x + r + j(34), y + j(35));
    }
}