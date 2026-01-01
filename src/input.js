export class Input {
    constructor(canvas, getGridFromPoint, onRotate){
        this.canvas = canvas;
        this.getGridFromPoint = getGridFromPoint;
        this.onRotate = onRotate;

        this.handleMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            const cell = this.getGridFromPoint(x,y);
            this.hover = cell; // can be none
        };
        this.handleMouseLeave = () => { this.hover = null; };
        this.handleClick = (e) => {
            if(!this.hover) return;
            this.onRotate(this.hover.x, this.hover.y);
        };
        canvas.addEventListener('mousemove', this.handleMouseMove);
        canvas.addEventListener('mouseleave', this.handleMouseLeave);
        canvas.addEventListener('click', this.handleClick);
    }
    dispose(){
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.removeEventListener('click', this.handleClick);
    }
}