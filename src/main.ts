/**
 * Waat.io - A minimal drawing app with stickers, color controls, and export.
 * Implements:
 * - Command pattern for undo/redo and replayable drawing commands
 * - Real-time preview for markers and stickers
 * - High-res export via offscreen canvas scaling
 * - Interactive UI with sliders and dynamic buttons
 */

import "./style.css";

// === HTML Structure ===
document.body.innerHTML = `
<div id="app">
  <div id="container">
    <h1 id="title">Waat.io</h1>
    <div id="main-content">
      <div id="canvas-container">
        <div id="left-panel">
          <div id="markers">
            <button id="thin">Thin</button>
            <button id="thick">Thick</button>
          </div>
          <canvas id="canvas" width="256" height="256"></canvas>
          <div id="actions">
            <button id="clear">Clear</button>
            <button id="undo">Undo</button>
            <button id="redo">Redo</button>
            <button id="export">Export</button>
          </div>
        </div>
      </div>
      <div id="controls-panel">
        <div class="control-group">
          <h3>Marker Color</h3>
          <div class="slider-container">
            <label for="hueSlider">Hue:</label>
            <input type="range" id="hueSlider" min="0" max="360" value="0">
            <span id="hueValue">0°</span>
          </div>
          <div class="color-preview" id="colorPreview"></div>
        </div>
        <div class="control-group">
          <h3>Sticker Rotation</h3>
          <div class="slider-container">
            <label for="rotationSlider">Angle:</label>
            <input type="range" id="rotationSlider" min="0" max="360" value="0">
            <span id="rotationValue">0°</span>
          </div>
          <div class="rotation-preview" id="rotationPreview">🎨</div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

/* ==========================================================================
   Domain Types
   ========================================================================== */

// Sticker represents the immutable metadata for a sticker type.
interface Sticker {
  readonly emoji: string;
  readonly name?: string;
  readonly defaultRotation?: number;
  readonly scale?: number;
}

// MarkerTool groups width and hue for the marker tool.
interface MarkerTool {
  readonly width: number;
  readonly hue: number;
}

// StickerTool groups the sticker object and the rotation that will be applied
interface StickerTool {
  readonly sticker: Sticker;
  readonly rotation: number;
}

type Tool =
  | { kind: "marker"; data: MarkerTool }
  | { kind: "sticker"; data: StickerTool };

/* ==========================================================================
   Stickers / Palette
   ========================================================================== */

/**
 * Sticker list stored as domain objects (not plain strings).
 * This replaces the primitive-obsessed array of emoji strings.
 */
const stickerList: Sticker[] = [
  { emoji: "☕", name: "Coffee" },
  { emoji: "🍪", name: "Cookie" },
  { emoji: "🍩", name: "Donut" },
  { emoji: "🤎", name: "Heart" },
];

/**
 * Utility to remove the selected class from a group of elements.
 * Preserves behavior from original file.
 */
function deselectAll(selector: string) {
  document.querySelectorAll(selector).forEach((b) =>
    b.classList.remove("selectedTool")
  );
}

/**
 * Builds and updates the sticker palette DOM.
 * - Renders each sticker as a button with data-sticker attribute containing the emoji.
 * - Adds an "add" button which allows creating a custom sticker (prompt).
 * - Re-attaches event listeners each time for simplicity (small palette).
 */
function updateStickerPalette() {
  const stickersDiv = document.getElementById("stickers");
  if (!stickersDiv) return; // defensive: if layout is changed, bail gracefully

  // Build innerHTML (small and simple palette)
  stickersDiv.innerHTML = `
    ${
    stickerList
      .map(
        (s) =>
          `<button data-sticker="${escapeHtmlAttr(s.emoji)}" title="${
            escapeHtmlAttr(
              s.name ?? s.emoji,
            )
          }">${s.emoji}</button>`,
      )
      .join("")
  }
    <button id="addSticker" title="Create custom sticker">➕</button>
  `;

  // Query the buttons we just created
  const stickerButtons = stickersDiv.querySelectorAll<HTMLButtonElement>(
    "[data-sticker]",
  );

  // Add click handlers for each sticker button
  stickerButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const emoji = btn.dataset.sticker ?? "";
      // Find the Sticker object (should exist)
      const sticker = stickerList.find((s) => s.emoji === emoji) ?? {
        emoji,
      } as Sticker;

      // Set current tool to sticker with currentRotation
      currentTool = {
        kind: "sticker",
        data: { sticker, rotation: currentRotation },
      };

      // UI selection states
      deselectAll("#stickers button");
      stickerButtons.forEach((b) => b.classList.remove("selectedTool"));
      btn.classList.add("selectedTool");

      // Deselect marker buttons visually
      thinBtn?.classList.remove("selectedTool");
      thickBtn?.classList.remove("selectedTool");

      // Update preview and redraw
      updateRotationPreview();
      canvas?.dispatchEvent(new Event("tool-moved"));
    });
  });

  const addBtn = document.getElementById("addSticker");
  addBtn?.addEventListener("click", () => {
    const newSticker = prompt("Enter custom sticker text:", "🧽");
    if (newSticker && newSticker.trim() !== "") {
      // Push a domain Sticker, then refresh palette (preserves custom stickers)
      stickerList.push({ emoji: newSticker.trim() });
      updateStickerPalette();
    }
  });
}

/* Small helper to escape attribute content so the generated innerHTML is safer. */
function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/* Create the stickers container next to markers (as in your original file) */
const markersDiv = document.getElementById("markers");
markersDiv?.insertAdjacentHTML("afterend", `<div id="stickers"></div>`);
updateStickerPalette();

/* ==========================================================================
   Tool & State Variables
   ========================================================================== */

/**
 * Global state:
 * - currentTool: unified tool state (marker or sticker)
 * - currentHue/currentRotation remain for slider-backed immediate values (mirrors original)
 * Keep both to maintain UI parity while removing primitive trap for tool.
 */
let currentHue = 0;
let currentRotation = 0;

// Default starting tool is a marker tool with width 2 and hue 0
let currentTool: Tool = {
  kind: "marker",
  data: { width: 2, hue: 0 },
};

/* ==========================================================================
   Utility functions
   ========================================================================== */

function getColorFromHue(hue: number): string {
  return `hsl(${hue}, 70%, 50%)`;
}

/** Update the color preview UI element (defensive null-checks). */
function updateColorPreview() {
  const colorPreview = document.getElementById("colorPreview");
  const hueValue = document.getElementById("hueValue");

  if (colorPreview) {
    colorPreview.style.backgroundColor = getColorFromHue(currentHue);
  }
  if (hueValue) hueValue.textContent = `${currentHue}°`;
}

/** Update the rotation preview UI element (defensive null-checks). */
function updateRotationPreview() {
  const rotationPreview = document.getElementById("rotationPreview");
  const rotationValue = document.getElementById("rotationValue");

  if (rotationPreview) {
    rotationPreview.style.transform = `rotate(${currentRotation}deg)`;
  }
  if (rotationValue) rotationValue.textContent = `${currentRotation}°`;
}

/* ==========================================================================
   Canvas Setup (with null-safety)
   ========================================================================== */

const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Canvas not found");

// Ensure we set explicit pixel size as before
canvas.width = 256;
canvas.height = 256;

const rawContext = canvas.getContext("2d");
if (!rawContext) throw new Error("Canvas or context not found");
const context: CanvasRenderingContext2D = rawContext;

// Grab marker button references
const thinBtn = document.getElementById("thin");
const thickBtn = document.getElementById("thick");

/* ==========================================================================
   Command System
   ========================================================================== */

interface DisplayCmd {
  display(ctx: CanvasRenderingContext2D): void;
}

// MarkerLine command factory — returns a command that accumulates points as the user drags,
// and displays them using the supplied MarkerTool.
function MarkerLine(
  x: number,
  y: number,
  tool: MarkerTool,
): DisplayCmd & { drag(nx: number, ny: number): void } {
  // Points are basic value objects; we keep them as primitives because they are simple.
  const points: { x: number; y: number }[] = [{ x, y }];

  function drag(nx: number, ny: number) {
    points.push({ x: nx, y: ny });
  }

  function display(ctx: CanvasRenderingContext2D) {
    // Defensive: if not enough points, nothing to draw
    if (points.length < 2) return;

    ctx.lineWidth = tool.width;
    ctx.strokeStyle = getColorFromHue(tool.hue);

    const first = points[0];
    if (!first) return;

    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const p of points.slice(1)) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  return { display, drag };
}

// MarkerPreview draws a circular preview of the marker at the current pointer.
function MarkerPreview(
  x: number,
  y: number,
  tool: MarkerTool,
): DisplayCmd {
  return {
    display(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = getColorFromHue(tool.hue);
      ctx.arc(x, y, tool.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };
}

/**
 * renderStickerOnCanvas: central place to draw a sticker using a StickerTool.
 * Encapsulates font, alignment, rotation, and potential scaling.
 */
function renderStickerOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sticker: Sticker,
  rotation: number,
) {
  ctx.save();
  ctx.font = "20px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.fillText(sticker.emoji, 0, 0);
  ctx.restore();
}

/**
 * StickerPreview and StickerCmd are thin wrappers that call renderStickerOnCanvas.
 * They accept the StickerTool instead of primitive args.
 */
function StickerPreview(
  x: number,
  y: number,
  tool: StickerTool,
): DisplayCmd {
  return {
    display: (ctx) =>
      renderStickerOnCanvas(ctx, x, y, tool.sticker, tool.rotation),
  };
}

function StickerCmd(
  x: number,
  y: number,
  tool: StickerTool,
): DisplayCmd {
  return {
    display: (ctx) =>
      renderStickerOnCanvas(ctx, x, y, tool.sticker, tool.rotation),
  };
}

/* ==========================================================================
   Command Storage & Input State
   ========================================================================== */

const commands: DisplayCmd[] = [];
const undoneCmd: DisplayCmd[] = [];
let currentCmd: ReturnType<typeof MarkerLine> | null = null;
let toolPreview: DisplayCmd | null = null;
const inputState = { isDrawing: false };

/* ==========================================================================
   Tool Selection (with null-safety)
   ========================================================================== */

/**
 * selectMarker: switches current tool to a marker with the specified width.
 * Also updates UI selected classes and dispatches tool-moved for preview update.
 */
function selectMarker(width: number, btn: HTMLElement, other: HTMLElement) {
  // Keep hue from current global slider state
  currentTool = { kind: "marker", data: { width, hue: currentHue } };

  btn.classList.add("selectedTool");
  other.classList.remove("selectedTool");

  deselectAll("#stickers button");

  updateColorPreview();
  canvas?.dispatchEvent(new Event("tool-moved"));
}

thinBtn?.addEventListener("click", () => {
  if (!thinBtn || !thickBtn) return;
  selectMarker(2, thinBtn, thickBtn);
});
thickBtn?.addEventListener("click", () => {
  if (!thinBtn || !thickBtn) return;
  selectMarker(12, thickBtn, thinBtn);
});

/* ==========================================================================
   Sliders
   ========================================================================== */

/** Hue and Rotation sliders — keep original DOM wiring and update global + tool state. */
const hueSlider = document.getElementById("hueSlider") as
  | HTMLInputElement
  | null;
const rotationSlider = document.getElementById(
  "rotationSlider",
) as HTMLInputElement | null;

if (hueSlider) {
  hueSlider.addEventListener("input", (e) => {
    const v = (e.target as HTMLInputElement).value;
    currentHue = parseInt(v, 10) || 0;

    // If the current tool is a marker, update its hue as well so previews are accurate
    if (currentTool.kind === "marker") {
      currentTool = {
        kind: "marker",
        data: { ...currentTool.data, hue: currentHue },
      };
    }

    updateColorPreview();
    canvas?.dispatchEvent(new Event("tool-moved"));
  });
}

if (rotationSlider) {
  rotationSlider.addEventListener("input", (e) => {
    const v = (e.target as HTMLInputElement).value;
    currentRotation = parseInt(v, 10) || 0;

    // If the current tool is sticker, update tool's rotation to reflect the slider
    if (currentTool.kind === "sticker") {
      currentTool = {
        kind: "sticker",
        data: { ...currentTool.data, rotation: currentRotation },
      };
    }

    updateRotationPreview();
    canvas?.dispatchEvent(new Event("tool-moved"));
  });
}

/* ==========================================================================
   Previews
   ========================================================================== */

/**
 * makePreview: returns a temporary DisplayCmd representing the pointer preview,
 * using the currentTool (either MarkerPreview or StickerPreview).
 */
function makePreview(x: number, y: number): DisplayCmd {
  if (currentTool.kind === "sticker") {
    // Defensive: currentTool.data should exist for discriminated union
    return StickerPreview(x, y, currentTool.data);
  }
  // marker
  return MarkerPreview(x, y, currentTool.data);
}

/* ==========================================================================
   Mouse Events (drawing & preview logic)
   ========================================================================== */

/* mousedown: start new command or place sticker immediately */
canvas.addEventListener("mousedown", (e) => {
  // Only respond to primary mouse button like the original
  if (e.button !== 0) return;

  // If sticker tool is active, push a sticker command immediately
  if (currentTool.kind === "sticker") {
    commands.push(StickerCmd(e.offsetX, e.offsetY, currentTool.data));
    undoneCmd.length = 0;
    toolPreview = null;
    canvas.dispatchEvent(new Event("drawing-changed"));
    return;
  }

  // Otherwise begin a marker line
  inputState.isDrawing = true;
  currentCmd = MarkerLine(e.offsetX, e.offsetY, currentTool.data);
  commands.push(currentCmd);
  undoneCmd.length = 0;
  toolPreview = null;
  canvas.dispatchEvent(new Event("drawing-changed"));
});

/* mousemove: either update preview (not drawing) or push drag points (drawing) */
canvas.addEventListener("mousemove", (e) => {
  if (!inputState.isDrawing) {
    // Create a fresh preview each move (cheap)
    toolPreview = makePreview(e.offsetX, e.offsetY);
    canvas.dispatchEvent(new Event("tool-moved"));
  } else if (currentCmd) {
    currentCmd.drag(e.offsetX, e.offsetY);
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
});

/* mouseleave: clear preview (keeps original UX) */
canvas.addEventListener("mouseleave", () => {
  toolPreview = null;
  canvas.dispatchEvent(new Event("tool-moved"));
});

/* global mouseup: stop drawing regardless of where the pointer is */
globalThis.addEventListener("mouseup", () => {
  inputState.isDrawing = false;
  currentCmd = null;
});

/* ==========================================================================
   Buttons: clear, undo, redo
   ========================================================================== */

const clearBtn = document.getElementById("clear");
clearBtn?.addEventListener("click", () => {
  // Clear the visible canvas immediately and reset command stacks.
  context.clearRect(0, 0, canvas.width, canvas.height);
  commands.length = 0;
  undoneCmd.length = 0;
  canvas.dispatchEvent(new Event("drawing-changed"));
});

const undoBtn = document.getElementById("undo");
undoBtn?.addEventListener("click", () => {
  if (commands.length > 0) {
    const undone = commands.pop();
    if (undone) undoneCmd.push(undone);
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
});

const redoBtn = document.getElementById("redo");
redoBtn?.addEventListener("click", () => {
  if (undoneCmd.length > 0) {
    const redone = undoneCmd.pop();
    if (redone) commands.push(redone);
    canvas.dispatchEvent(new Event("drawing-changed"));
  }
});

/* ==========================================================================
   Export (4x high-res export via offscreen canvas scaling)
   ========================================================================== */

/**
 * exportHighRes creates an offscreen canvas at 4x resolution and replays all
 * commands scaled to produce a crisp PNG.
 */
function exportHighRes() {
  // Create a new canvas element (not attached to DOM)
  const exportCanvas = document.createElement("canvas");
  // 4x the source pixel dimensions (256 * 4 = 1024)
  exportCanvas.width = 1024;
  exportCanvas.height = 1024;

  const exportCtx = exportCanvas.getContext("2d");
  if (!exportCtx) return; // defensive guard

  // Scale down drawing coordinates by 4 so our commands (which are in 256-space)
  // end up crisp on the 1024 canvas.
  exportCtx.scale(4, 4);

  for (const cmd of commands) {
    cmd.display(exportCtx);
  }

  // Create and click an anchor to download PNG
  const anchor = document.createElement("a");
  anchor.href = exportCanvas.toDataURL("image/png");
  anchor.download = "sketchpad.png";
  anchor.click();
}

const exportBtn = document.getElementById("export");
exportBtn?.addEventListener("click", exportHighRes);

/* ==========================================================================
   Rendering / Redraw
   ========================================================================== */

/**
 * redraw: clears the canvas and replays all commands, plus draws the current preview
 * if not actively drawing (so the preview doesn't stomp on the current stroke).
 */
function redraw(ctx: CanvasRenderingContext2D) {
  if (!canvas) return; // if canvas removed from DOM, nothing to do
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Replay recorded commands
  for (const cmd of commands) cmd.display(ctx);

  // Draw preview only when not currently drawing
  if (!inputState.isDrawing && toolPreview) toolPreview.display(ctx);
}

/* Hook rendering events */
canvas.addEventListener("drawing-changed", () => redraw(context));
canvas.addEventListener("tool-moved", () => redraw(context));

/* ==========================================================================
   Initialization (restore previews to initial state)
   ========================================================================== */

updateColorPreview();
updateRotationPreview();
