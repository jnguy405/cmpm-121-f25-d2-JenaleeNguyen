# CMPM 121 D2 Project

1. **Step 1**: Added container including _app title_ and rounded _canvas_ with drop-shadow using CSS by ID access.
2. **Step 2**: Implemented observers for mouse events to allow the user to draw. Additonal button to clear the canvas.
3. **Step 3**: Dispatched a `drawing-changed` event on the canvas and utilized an observer to clear and redraw the user's stored strokes from given cursor positions.
4. **Step 4**: Added `undo` and `redo` buttons (system and updated css) which use pop() and push() to save the user's strokes.
5. **Step 5**: Refactored the app to store drawing strokes as objects with `display` and `drag` methods and allowed the canvas to redraw and manage undo/redo operations without changing the user experience.
