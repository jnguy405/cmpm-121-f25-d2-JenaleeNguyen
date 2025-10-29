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

// Custom stickers (data-driven design) ===
// The available set of stickers is defined by this single array
const stickerList: string[] = ["☕", "🍪", "🍩", "🤎"];

// Helper function to deselect any set of buttons ===
function deselectAll(selector: string) {
  document.querySelectorAll(selector).forEach((b) =>
    b.classList.remove("selectedTool")
  );
}

// Function that renders all sticker buttons, including the "Add custom sticker" button
function renderStickers() {
  const stickersDiv = document.getElementById("stickers");
  if (!stickersDiv) return;

  // Build sticker buttons dynamically from stickerList
  stickersDiv.innerHTML = `
    ${
    stickerList
      .map((s) => `<button data-sticker="${s}">${s}</button>`)
      .join("")
  }
    <button id="addSticker" title="Create custom sticker">➕</button>
  `;

  // Re-bind all sticker button listeners after rendering
  const stickerButtons = stickersDiv.querySelectorAll<HTMLButtonElement>(
    "[data-sticker]",
  );

  stickerButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentSticker = btn.dataset.sticker || null;

      // Update selected styling
      stickerButtons.forEach((b) => b.classList.remove("selectedTool"));
      btn.classList.add("selectedTool");

      // Deselect thin/thick marker buttons when a sticker is chosen
      thinBtn?.classList.remove("selectedTool");
      thickBtn?.classList.remove("selectedTool");

      // Fire tool-moved event to refresh the preview
      canvas?.dispatchEvent(new Event("tool-moved"));
    });
  });

  // Custom sticker creation button ===
  const addBtn = document.getElementById("addSticker");
  addBtn?.addEventListener("click", () => {
    const newSticker = prompt("Enter custom sticker text:", "🧽");
    if (newSticker && newSticker.trim() !== "") {
      stickerList.push(newSticker.trim());
      renderStickers(); // Re-render to include the new sticker
    }
  });
}

// Insert sticker container directly under the markers
const markersDiv = document.getElementById("markers");
const stickersHTML = `<div id="stickers"></div>`;
markersDiv?.insertAdjacentHTML("afterend", stickersHTML);

// Initial sticker render
renderStickers();

let currentLineWidth = 2; // default to "thin"
let currentSticker: string | null = null;

// Get canvas and context ===
const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
if (canvas) {
  // important for TypeScript: null checks and explicit sizing
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

// Tool preview implementation ===
// Factory function that creates a circular preview marker for the current tool
function MarkerPreview(
  x: number,
  y: number,
  lineWidth: number,
): DisplayCmd {
  return {
    display(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = "rgba(0, 0, 0, 1)"; // filled circle
      ctx.arc(x, y, lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };
}

// Sticker preview command ===
function StickerPreview(x: number, y: number, sticker: string): DisplayCmd {
  return {
    display(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.font = "20px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sticker, x, y);
      ctx.restore();
    },
  };
}

// Sticker placement command ===
function StickerCmd(
  x: number,
  y: number,
  sticker: string,
): DisplayCmd & { drag(x: number, y: number): void } {
  let pos = { x, y };

  function drag(newX: number, newY: number) {
    pos = { x: newX, y: newY };
  }

  function display(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = "20px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sticker, pos.x, pos.y);
    ctx.restore();
  }

  return { display, drag };
}

// Store all drawing commands ===
const commands: DisplayCmd[] = [];
let currentCmd: ReturnType<typeof MarkerLine> | null = null;
const undoneCmd: DisplayCmd[] = [];
let toolPreview: DisplayCmd | null = null; // holds the live preview for the tool

// Track cursor state ===
const inputState = { isDrawing: false };

// Unified tool selection helper ===
function selectMarker(width: number, btn: HTMLElement, otherBtn: HTMLElement) {
  currentLineWidth = width;
  btn.classList.add("selectedTool");
  otherBtn.classList.remove("selectedTool");
  currentSticker = null; // deselect sticker
  deselectAll("#stickers button");
}

// Tool button event listeners ===
// thin tool selected by default (2px)
thinBtn?.addEventListener("click", () => selectMarker(2, thinBtn, thickBtn!));

// thick tool (6px)
thickBtn?.addEventListener("click", () => selectMarker(12, thickBtn, thinBtn!));

// Unified preview factory ===
function makePreview(x: number, y: number): DisplayCmd {
  return currentSticker
    ? StickerPreview(x, y, currentSticker)
    : MarkerPreview(x, y, currentLineWidth);
}

// Mouse event listeners ===
// Start drawing / place sticker
canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;

  // Sticker placement ===
  if (currentSticker) {
    const stickerCommand = StickerCmd(e.offsetX, e.offsetY, currentSticker);
    commands.push(stickerCommand);
    undoneCmd.length = 0;
    toolPreview = null;
    canvas.dispatchEvent(new Event("drawing-changed"));
    return;
  }

  // Marker drawing ===
  inputState.isDrawing = true;
  currentCmd = MarkerLine(e.offsetX, e.offsetY, currentLineWidth);
  commands.push(currentCmd);
  undoneCmd.length = 0;
  toolPreview = null;
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Draw while moving ===
canvas.addEventListener("mousemove", (e) => {
  if (!inputState.isDrawing) {
    toolPreview = makePreview(e.offsetX, e.offsetY);
    canvas.dispatchEvent(new Event("tool-moved"));
  } else if (currentCmd) {
    currentCmd.drag(e.offsetX, e.offsetY);
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
});

// Hide preview when cursor leaves the canvas ===
canvas.addEventListener("mouseleave", () => {
  toolPreview = null;
  canvas.dispatchEvent(new Event("tool-moved"));
});

// Stop drawing ===
globalThis.addEventListener("mouseup", () => {
  inputState.isDrawing = false;
  currentCmd = null;
});

// Button event listeners ===
// Clear button ===
document.getElementById("clear")?.addEventListener("click", () => {
  context.clearRect(0, 0, canvas.width, canvas.height);
  commands.length = 0;
  undoneCmd.length = 0;
  canvas.dispatchEvent(new Event("drawing-changed"));
});

// Undo button ===
document.getElementById("undo")?.addEventListener("click", () => {
  if (commands.length > 0) {
    const undone = commands.pop();
    if (undone) {
      undoneCmd.push(undone);
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
});

// Redo button ===
document.getElementById("redo")?.addEventListener("click", () => {
  if (undoneCmd.length > 0) {
    const redone = undoneCmd.pop();
    if (redone) {
      commands.push(redone);
      canvas.dispatchEvent(new Event("drawing-changed"));
    }
  }
});

// High resolution export ===
// Add an "Export" button below the existing actions
const actionsDiv = document.getElementById("actions");
actionsDiv?.insertAdjacentHTML(
  "beforeend",
  `<button id="export">Export</button>`,
);

// High-resolution export function ===
function exportHighRes() {
  // Create a temporary high-resolution canvas (4x scale)
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = 1024;
  exportCanvas.height = 1024;

  const exportCtx = exportCanvas.getContext("2d");
  if (!exportCtx) return;

  // Scale context so that the 256x256 coordinate system maps to 1024x1024
  exportCtx.scale(4, 4);

  // Redraw all stored commands (no tool preview)
  for (const cmd of commands) {
    cmd.display(exportCtx);
  }

  // Trigger PNG download
  const anchor = document.createElement("a");
  anchor.href = exportCanvas.toDataURL("image/png");
  anchor.download = "sketchpad.png";
  anchor.click();
}

// Export button event listener ===
document.getElementById("export")?.addEventListener("click", exportHighRes);

// Rendering logic ===
// Redraw function ===
function redraw(ctx: CanvasRenderingContext2D) {
  if (!canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw all stored commands ===
  for (const cmd of commands) {
    cmd.display(ctx);
  }

  // Draw tool preview (only when not drawing)
  if (!inputState.isDrawing && toolPreview) {
    toolPreview.display(ctx);
  }
}

// Observers for drawing and tool movement events ===
canvas.addEventListener("drawing-changed", () => {
  redraw(context);
});

canvas.addEventListener("tool-moved", () => {
  redraw(context);
});
