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

// Defines the contract for any drawing command that knows how to render itself
interface DisplayCmd {
  display(ctx: CanvasRenderingContext2D): void;
}

// Factory function that creates a line command with both drawing and dragging behavior
function MarkerLine(
  x: number,
  y: number,
): DisplayCmd & { drag(x: number, y: number): void } {
  // Always defined, not optional
  const points: { x: number; y: number }[] = [{ x, y }];

  // Called as the user drags the mouse to add new points to the line
  function drag(x: number, y: number): void {
    points.push({ x, y });
  }

  // Draws the line on the given canvas context
  function display(ctx: CanvasRenderingContext2D): void {
    if (points.length < 2) return;

    const first = points[0];
    if (!first) return; // defensive guard for type safety

    ctx.beginPath();
    ctx.moveTo(first.x, first.y);

    // Use for...of to safely iterate without risking undefined array elements
    for (const point of points.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
  }

  // Return both draw and drag behavior
  return { display, drag };
}

// Store all drawing commands
const commands: DisplayCmd[] = [];
let currentCmd: ReturnType<typeof MarkerLine> | null = null;

// Store undone commands for redo functionality
const undoneCmd: DisplayCmd[] = [];

// Track cursor state
const cursor = { drawing: false, x: 0, y: 0 };

// Start drawing
canvas.addEventListener("mousedown", (e: MouseEvent) => {
  if (e.button !== 0) return; // Only respond to left mouse button
  cursor.drawing = true;
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;

  // Create a new MarkerLine and start tracking it
  currentCmd = MarkerLine(cursor.x, cursor.y);
  commands.push(currentCmd);

  // Once we start a new stroke, clear the redo stack
  undoneCmd.length = 0;

  // Notify that drawing has changed
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Draw while moving
canvas.addEventListener("mousemove", (e: MouseEvent) => {
  if (!cursor.drawing || !currentCmd) return; // null check

  // Add new point to the current line as the mouse moves
  currentCmd.drag(e.offsetX, e.offsetY);
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;

  // Notify that drawing has changed
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Stop drawing
globalThis.addEventListener("mouseup", () => {
  cursor.drawing = false;
  currentCmd = null;
});

// Clear button
document.getElementById("clear")?.addEventListener("click", () => {
  context.clearRect(0, 0, canvas.width, canvas.height);
  commands.length = 0; // remove all commands
  undoneCmd.length = 0; // clear redo stack
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Undo button
document.getElementById("undo")?.addEventListener("click", () => {
  if (commands.length > 0) {
    const undone = commands.pop(); // remove last command
    if (undone) {
      undoneCmd.push(undone); // add to redo stack
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
});

// Redo button
document.getElementById("redo")?.addEventListener("click", () => {
  if (undoneCmd.length > 0) {
    const redone = undoneCmd.pop(); // remove last undone command
    if (redone) {
      commands.push(redone); // add back to command list
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
});

// Redraw the entire canvas based on the current command list (triggered by events)
function redraw(ctx: CanvasRenderingContext2D) {
  if (!canvas) return; // null check

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "black";

  // Ask each command to draw itself
  for (const cmd of commands) {
    cmd.display(ctx);
  }
}

// Observer for "drawing-changed" event — only redraw when needed
canvas.addEventListener("drawing-changed", () => {
  redraw(context);
});
