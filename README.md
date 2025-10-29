# CMPM 121 D2 Project

1. **Step 1**: Added container including _app title_ and rounded _canvas_ with drop-shadow using CSS by ID access.
2. **Step 2**: Implemented observers for mouse events to allow the user to draw. Additonal button to clear the canvas.
3. **Step 3**: Dispatched a `drawing-changed` event on the canvas and utilized an observer to clear and redraw the user's stored strokes from given cursor positions.
4. **Step 4**: Added `undo` and `redo` buttons (system and updated css) which use pop() and push() to save the user's strokes.
5. **Step 5**: Refactored the app to store drawing strokes as objects with `display` and `drag` methods and allowed the canvas to redraw and manage undo/redo operations without changing the user experience.
6. **Step 6**: Introduced two marker tools (“thin” and “thick”) that lets users choose the line thickness for new strokes with visual feedback indicating the selected tool. Attempted to categorize `main.ts` functions and events with comments.
7. **Step 7**: Added a live tool preview that follows the cursor when not drawing by creating a preview object with a display method and dispatching a tool-moved event to render it on the canvas.
8. **Step 8**: Implemented multiple sticker tools (☕, 🍪, 🍩) with live previews that can be placed on the canvas using the command pattern, integrated with undo/redo and visual tool selection.
9. **Step 9**: Refactored the sticker system to use a data-driven design, where all available stickers are defined by a single array. Added a “Create custom sticker” button that uses `prompt()` to let users add new stickers dynamically with the same behaviors as existing stickers.
10. **Step 10**: Added a high-resolution `Export` feature that generates a temporary `1024×1024 canvas`, redraws all saved commands at 4× scale, and triggers a `PNG` download of the drawing. This enables users to export crisp, high-quality versions of their creations directly from the app Refactored thin and thick marker tools to use `deselectAll()` and `selectMarker()` to reduce redundancy and bulk.
11. **Step 11**: Added sticker emoji, changed marker thickness, and made a coffee theme.
12. **Step 12**: Implement hue slider for marker color and rotation slider for sticker orientation with real-time previews. Enhance tool state management to maintain color/rotation settings and synchronize UI controls. Refactored `StickerCmd` and `StickerPreview` to utilize `renderStickerOnCanvas` and altered interfaces to include stickers and their properties.
