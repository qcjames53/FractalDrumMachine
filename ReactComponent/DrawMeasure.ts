const boxColors = [
    `rgba(204, 51, 51, 0.1)`, // Bass
    `rgba(51, 204, 51, 0.1)`, // Snare
    `rgba(51, 51, 204, 0.1)`, // Hi-hat
    `rgba(255, 123, 0, 0.1)`, // Rest
]
const lineColors = [
    `rgba(204, 51, 51, 1.0)`,   // Bass
    `rgba(51, 204, 51, 1.0)`,   // Snare
    `rgba(51, 51, 204, 1.0)`,   // Hi-hat
    `rgba(255, 123, 0, 1.0)`,   // Rest
]

export function DrawMeasure(ctx: CanvasRenderingContext2D | null, zoom: number, fractalSize: number, measureNotes: number[]) {
    if (!ctx) return;

    // Draw all drawn notes from first (largest visible) to last (smallest visible)
    ctx.lineWidth = 2.0 / zoom;
    let x0 = 0;
    let y0 = 0;
    for (let i = 0; i < measureNotes.length; i++) {
        const note = measureNotes[i];
        // Determine location, and size
        // (self.canvas_size / 4) // (4 ** (i // 2))
        // (self.canvas_size / 4) // (4 ** ((i - 1) // 2))
        const noteWidth = Math.floor((fractalSize / 4) / (4 ** Math.floor(i / 2)));
        const noteHeight = Math.floor((fractalSize / 4) / (4 ** Math.floor((i - 1) / 2)));
        if (i % 2 === 0) {
            x0 += Math.floor(note * noteWidth);
        } else {
            y0 += Math.floor(note * noteHeight);
        }

        // Draw the note box fill at 25% opacity
        ctx.fillStyle = boxColors[note];
        ctx.fillRect(x0, y0, noteWidth, noteHeight);

        // Draw the note box outline at 100% opacity
        ctx.strokeStyle = lineColors[note];
        ctx.strokeRect(x0, y0, noteWidth, noteHeight);
    }
}