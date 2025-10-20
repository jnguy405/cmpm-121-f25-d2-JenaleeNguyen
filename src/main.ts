import "./style.css";

// Create the HTML structure ===
// Individual Button IDs are kept for independent styling
document.body.innerHTML = `
<div id="container">
  <h1 id="title">Waat.io</h1>
  <div id="markers">
    <button id="thin">Thin</button>
    <button id="thick">Thick</button>
  </div>
  <canvas id="canvas" width="256" height="256"></canvas>
  <div id="actions">
    <button id="clear">Clear</button>
    <button id="undo">Undo</button>
    <button id="redo">Redo</button>
  </div>
</div>
`;

let currentLineWidth = 2; // default to "thin"

// Get canvas and context
const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
if (canvas) {
  canvas.width = 256;
  canvas.height = 256;
}

const thinBtn = document.getElementById("thin");
const thickBtn = document.getElementById("thick");
const rawContext = canvas?.getContext("2d");

if (!canvas || !rawContext) throw new Error("Canvas or context not found");
const context: CanvasRenderingContext2D = rawContext;

// Data models and interfaces ===
// Defines the contract for any drawing command that knows how to render itself
interface DisplayCmd {
  display(ctx: CanvasRenderingContext2D): void;
}

// Drawing command implementations ===
// Factory function that creates a line command with both drawing and dragging behavior
function MarkerLine(
  x: number,
  y: number,
  lineWidth: number,
): DisplayCmd & { drag(x: number, y: number): void } {
  const points: { x: number; y: number }[] = [{ x, y }];

  function drag(x: number, y: number): void {
    points.push({ x, y });
  }

  function display(ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = "black";
    if (points.length < 2) return;

    const first = points[0];
    if (!first) return;

    ctx.beginPath();
    ctx.moveTo(first.x, first.y);

    for (const point of points.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
  }

  return { display, drag };
}

// Store all drawing commands ===
const commands: DisplayCmd[] = [];
let currentCmd: ReturnType<typeof MarkerLine> | null = null;
const undoneCmd: DisplayCmd[] = [];

// Track cursor state
const cursor = { drawing: false, x: 0, y: 0 };

// Tool button event listeners ===
// thin tool selected by default (2px)
thinBtn?.addEventListener("click", () => {
  currentLineWidth = 2;
  thinBtn.classList.add("selectedTool");
  thickBtn?.classList.remove("selectedTool");
});

// thick tool (6px)
thickBtn?.addEventListener("click", () => {
  currentLineWidth = 6;
  thickBtn.classList.add("selectedTool");
  thinBtn?.classList.remove("selectedTool");
});

// Mouse event listeners ===
// Start drawing
canvas.addEventListener("mousedown", (e: MouseEvent) => {
  if (e.button !== 0) return;
  cursor.drawing = true;
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;

  // Create a new MarkerLine and start tracking it
  currentCmd = MarkerLine(cursor.x, cursor.y, currentLineWidth);
  commands.push(currentCmd);

  // Once we start a new stroke, clear the redo stack
  undoneCmd.length = 0;

  // Notify that drawing has changed
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Draw while moving
canvas.addEventListener("mousemove", (e: MouseEvent) => {
  if (!cursor.drawing || !currentCmd) return;

  // Add new point to the current line as the mouse moves
  currentCmd.drag(e.offsetX, e.offsetY);
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Stop drawing
globalThis.addEventListener("mouseup", () => {
  cursor.drawing = false;
  currentCmd = null;
});

// Button event listeners ===
// Clear button
document.getElementById("clear")?.addEventListener("click", () => {
  context.clearRect(0, 0, canvas.width, canvas.height);
  commands.length = 0;
  undoneCmd.length = 0;
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Undo button
document.getElementById("undo")?.addEventListener("click", () => {
  if (commands.length > 0) {
    const undone = commands.pop();
    if (undone) {
      undoneCmd.push(undone);
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
});

// Redo button
document.getElementById("redo")?.addEventListener("click", () => {
  if (undoneCmd.length > 0) {
    const redone = undoneCmd.pop();
    if (redone) {
      commands.push(redone);
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
});

// Rendering logic ===
// Redraw function
function redraw(ctx: CanvasRenderingContext2D) {
  if (!canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const cmd of commands) {
    cmd.display(ctx);
  }
}

// Observer for "drawing-changed" event
canvas.addEventListener("drawing-changed", () => {
  redraw(context);
});
