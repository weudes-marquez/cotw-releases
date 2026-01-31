# Window Management Rules

## Positioning Logic
All auxiliary windows (Settings, Stats, Need Zones, etc.) MUST follow these positioning rules:

1. **Relative Positioning**: Windows must be opened adjacent to the main application window.
2. **Space Detection**:
   - Check the available space on the **RIGHT** side of the main window first.
   - If there is enough space (window width + margin), open it on the right.
   - If not, check the **LEFT** side.
   - If neither side has enough space, center it on the current display or stack it with a slight offset.
3. **Alignment**: The top of the new window should be aligned with the top of the main window (`y` coordinate) whenever possible, respecting screen boundaries.
4. **Always on Top**: Auxiliary windows should generally inherit the `alwaysOnTop` property of the main window to ensure they remain visible during gameplay.

## Implementation Reference (Electron)
```typescript
const mainBounds = win.getBounds();
const display = screen.getDisplayMatching(mainBounds);
const workArea = display.workArea;

const winWidth = 450;
const winHeight = 650;

let x = mainBounds.x + mainBounds.width + 10; // Try right
if (x + winWidth > workArea.x + workArea.width) {
    x = mainBounds.x - winWidth - 10; // Try left
}
// Ensure it doesn't go off-screen
x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - winWidth));
let y = Math.max(workArea.y, Math.min(mainBounds.y, workArea.y + workArea.height - winHeight));
```
