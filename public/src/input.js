export class Input {
    constructor(canvas, getGridFromPoint, onRotate){
        this.canvas = canvas;
        this.getGridFromPoint = getGridFromPoint;
        this.onRotate = onRotate;

        this.hover = null; //{x,y}
        canvas.addEventListener('mousemove', (e)=>{
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const cell = this.getGridFromPoint(x,y);
            this.hover = cell; // can be none
        });

        canvas.addEventListener('mouseleave', ()=>{ this.hover = null; });

        canvas.addEventListener('click', (e)=>{
            if(!this.hover) return;
            this.onRotate(this.hover.x, this.hover.y);
        });
    }
}