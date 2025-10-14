import "./style.css";

// Create the HTML structure
document.body.innerHTML = `
<div id="container">
  <h1 id="title">Waat.io</h1>
  <canvas id="canvas" width="256" height="256"></canvas>
  <button id="clear">Clear</button>
</div>
`;

const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
const context = canvas?.getContext("2d");

// Null checks for TypeScript
if (!canvas || !context) {
  throw new Error("Canvas or context not found");
}

let drawing = false;
let x = 0;
let y = 0;

// Start drawing
canvas.addEventListener("mousedown", (e: MouseEvent) => {
  if (e.button !== 0) return; // Only respond to left mouse button
  x = e.offsetX;
  y = e.offsetY;
  drawing = true;
});

// Draw while moving
canvas.addEventListener("mousemove", (e: MouseEvent) => {
  if (!drawing) return;
  drawLine(context, x, y, e.offsetX, e.offsetY);
  x = e.offsetX;
  y = e.offsetY;
});

// Stop drawing
globalThis.addEventListener("mouseup", () => {
  drawing = false;
});

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  ctx.beginPath();
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.closePath();
}

// Clear button
document.getElementById("clear")?.addEventListener("click", () => {
  context.clearRect(0, 0, canvas.width, canvas.height);
});
