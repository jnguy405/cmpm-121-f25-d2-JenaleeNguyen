import "./style.css";

// Create the HTML structure
document.body.innerHTML = `
<div id="container">
  <h1 id="title">Waat.io</h1>
  <canvas id="canvas" width="256" height="256"></canvas>
  <div id="buttons">
    <button id="clear">Clear</button>
    <button id="undo">Undo</button>
    <button id="redo">Redo</button>
  </div>
</div>
`;

// Get canvas and context
const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
if (canvas) {
  canvas.width = 256;
  canvas.height = 256;
}
const context = canvas?.getContext("2d");

// Null checks for TypeScript
if (!canvas || !context) throw new Error("Canvas or context not found");

// Store all strokes (each stroke is an array of points)
const strokes: { x: number; y: number }[][] = [];
let currentStroke: { x: number; y: number }[] | null = null;

// Store undone strokes for redo functionality
const undoneStrokes: { x: number; y: number }[][] = [];

// Track cursor state
const cursor = { drawing: false, x: 0, y: 0 };

// Start drawing
canvas.addEventListener("mousedown", (e: MouseEvent) => {
  if (e.button !== 0) return; // Only respond to left mouse button
  cursor.drawing = true;
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;

  currentStroke = [{ x: cursor.x, y: cursor.y }];
  strokes.push(currentStroke);

  // Once we start a new stroke, clear the redo stack
  undoneStrokes.length = 0;

  // Notify that drawing has changed
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Draw while moving
canvas.addEventListener("mousemove", (e: MouseEvent) => {
  if (!cursor.drawing || !currentStroke) return; // null check

  // Save the new point to the current stroke
  const point = { x: e.offsetX, y: e.offsetY };
  currentStroke.push(point);
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;

  // Notify that drawing has changed
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Stop drawing
globalThis.addEventListener("mouseup", () => {
  cursor.drawing = false;
  currentStroke = null;
});

// Clear button
document.getElementById("clear")?.addEventListener("click", () => {
  context.clearRect(0, 0, canvas.width, canvas.height);
  strokes.length = 0; // remove all strokes
  undoneStrokes.length = 0; // clear redo stack
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Undo button
document.getElementById("undo")?.addEventListener("click", () => {
  if (strokes.length > 0) {
    const undone = strokes.pop(); // remove last stroke (pop most recent element)
    if (undone) {
      undoneStrokes.push(undone); // add to redo stack
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
});

// Redo button
document.getElementById("redo")?.addEventListener("click", () => {
  if (undoneStrokes.length > 0) {
    const redone = undoneStrokes.pop(); // remove last undone stroke
    if (redone) {
      strokes.push(redone); // add back to strokes
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
});

// Redraw everything from the strokes list
function redraw(ctx: CanvasRenderingContext2D) {
  if (!canvas) return; // null check

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "black";

  for (const stroke of strokes) {
    if (stroke.length < 2 || !stroke[0]) continue; // null check

    // Draw the stroke
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      const point = stroke[i];
      if (point) {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
  }
}

// Observer for "drawing-changed" event — only redraw when needed
canvas.addEventListener("drawing-changed", () => {
  redraw(context);
});
