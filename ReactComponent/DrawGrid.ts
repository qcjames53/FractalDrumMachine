export function DrawGrid(ctx: CanvasRenderingContext2D | null, offset: {x: number, y: number}, zoom: number, fractalSize: number, notesPerMeasure: number) {
    if (!ctx) return;

    const darkestGridline: number = 0.1;
    const lightestGridline: number = 0.9;
    const background: number = 1.0;

    // Draw the gridlines
    ctx.lineWidth = 1 / zoom; // 1 viewport pixel wide
    let grid_size: number = 1;
    let max_grid_size: number = fractalSize;
    let grid_levels: number[] = [];
    let canvasWidth: number = ctx.canvas.width;
    let canvasHeight: number = ctx.canvas.height;

    while (grid_size <= max_grid_size) {
        grid_levels.push(grid_size);
        grid_size *= 4;
    }
    let n: number = grid_levels.length;
    for (let i = 0; i < n; i++) {
        grid_size = grid_levels[i];
        let grid_spacing: number = grid_size * zoom;
        if (grid_spacing >= 5) {
            let color: number = darkestGridline;

            // Interpolate color: finest grid (i=0) is lightest, coarsest (i=n-1) is darkest
            let t: number = n > 1 ? i / (n - 1) : 0;
            color = lightestGridline * (1 - t) + darkestGridline * t;

            // Only the most minor visible gridlines (smallest i with grid_spacing >= 5) fade in
            if (grid_spacing < 15) {
                let fade_perc: number = (grid_spacing - 5) / 10;
                color = color * fade_perc + background * (1 - fade_perc);
            }

            ctx.strokeStyle = `rgb(${color * 255}, ${color * 255}, ${color * 255})`;

            // Get the world coordinates for the x and y visible section of the viewport
            // Snap left/top to nearest grid line outside the visible area or the edge of the fractal (world coord 0,0)
            // Integer align panning and line draws
            let panX: number = Math.round(offset.x);
            let panY: number = Math.round(offset.y);
            let left: number = Math.floor(Math.max(0, -panX / zoom / grid_size)) * grid_size;
            let right: number = Math.min(fractalSize, -panX / zoom + canvasWidth / zoom);
            let top: number = Math.floor(Math.max(0, -panY / zoom / grid_size)) * grid_size;
            let bottom: number = Math.min(fractalSize, -panY / zoom + canvasHeight / zoom);

            // Integer align all line draws
            ctx.beginPath();
            for (let x = left; x <= right; x += grid_size) {
                let xi: number = Math.round(x);
                ctx.moveTo(xi, Math.round(top));
                ctx.lineTo(xi, Math.round(bottom));
            }
            if (notesPerMeasure % 2 === 0 || i !== 0) {
                for (let y = top; y <= bottom; y += grid_size) {
                    let yi: number = Math.round(y);
                    ctx.moveTo(Math.round(left), yi);
                    ctx.lineTo(Math.round(right), yi);
                }
            }
            ctx.stroke();
        }

    }

    // Draw the border
    ctx.lineWidth = 2 / zoom; // 2 viewport pixels wide
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(fractalSize, 0);
    ctx.lineTo(fractalSize, fractalSize);
    ctx.lineTo(0, fractalSize);
    ctx.lineTo(0, 0);
    ctx.stroke();
}
