# PlantUML Local Studio

A local JavaScript PlantUML editor and renderer with PlantUML-aware autocomplete, live syntax diagnostics, semantic reference checks, and quick-fix suggestions. It runs the official PlantUML JavaScript engine in your browser, so rendering does **not** require a PlantUML server, Java, or a separate Graphviz installation.

## Features

- Side-by-side PlantUML source editor and SVG preview with a draggable divider
- Detachable live preview window that can be moved to a second monitor while the editor stays on the primary display
- Detached diagrams retain click-to-source navigation and object appearance quick editing
- Async sequence arrows such as `->>`, `-->>`, and `<<--` retain exact source navigation in embedded and detached previews
- Inline and multiline note text navigates back to its exact source line in embedded and detached previews
- Editor-only main layout while detached; closing the preview restores the split view with the embedded diagram fitted
- Resizable detached preview with Maximize/Restore button, header double-click, and `Ctrl/Cmd + Shift + M`
- OS-aware shortcut labels: macOS shows Cmd/Option while Windows and Linux show Ctrl/Alt
- Click rendered diagram elements to jump directly to their PlantUML source line
- Adjustable Problems panel height with a draggable horizontal divider
- Panel sizes are remembered locally between sessions
- Last-known-good preview: invalid edits never replace the most recent valid diagram
- PlantUML-aware autocomplete for directives, elements, arrows, control blocks, styles, and snippets
- PlantUML syntax highlighting for object types, references, arrows, strings, comments, colors, directives, and block keywords
- Inline color picker: click or move the caret onto a PlantUML color token to open a compact visual selector, reliable system picker, and swatch palette
- Type-based object colors: all objects of the same PlantUML type share the same color throughout the script
- Prose stays neutral: note bodies and relationship/message text after `:` are intentionally not syntax-colored
- Collapsible PlantUML blocks with gutter controls plus Fold all / Unfold all actions
- One-click PlantUML script formatting with nested block indentation
- Context suggestions for participant/class/component aliases declared in the current diagram
- Live syntax diagnostics with line-specific errors and warnings while you type
- English spell checking for displayed arrow labels and note text, excluding object names and aliases, with Ignore and per-diagram Ignore all actions
- Semantic reference warnings for duplicate declarations and references used without a definition
- PlantUML parser errors and browser rendering limits are identified separately in the Problems panel
- Expanded local renderer capacity supports diagrams up to 16,384 pixels in either dimension
- Development startup refreshes the PlantUML dependency bundle so renderer-limit patches cannot remain stale
- Suggested fixes for common mistakes, with one-click quick fixes when the correction is deterministic
- Error/warning markers beside affected line numbers and click-to-jump navigation
- Fully local rendering after dependencies are installed
- Live validation/rendering while typing (can be disabled); the visible preview updates only after a successful parse
- Open `.puml`, `.plantuml`, `.pu`, or text files
- Save PlantUML source
- Export SVG and PNG
- Copy rendered SVG to the clipboard
- Zoom, fit-to-view, and Ctrl/Cmd + mouse-wheel zoom
- Fully scrollable zoomed previews in both horizontal and vertical directions
- Light/dark UI and PlantUML render mode
- Built-in templates for sequence, class, component, activity, state, and deployment diagrams
- Compact top menu with every editor, diagram, file, export, view, and preference action
- Direct Save and Save As workflows, plus compact Save, Undo, Redo, and Render quick actions
- New-file Save and Save As open a destination picker with a safe filename suggested from the PlantUML `title`
- Help → About shows the installed tool version and rendering-engine version
- Keyboard access for every menu action, with a built-in categorized shortcut reference
- Local autosave in browser storage
- Caret/selection and editor scroll position are preserved while live diagnostics/rendering update in the background
- `Enter` keeps the current line indentation instead of resetting the caret to column 1
- Keyboard shortcuts:
  - `Ctrl/Cmd + Space`: open autocomplete
  - `Arrow Up/Down`: navigate autocomplete suggestions
  - `Enter` or `Tab`: insert the selected suggestion while autocomplete is open
  - `Enter`: otherwise create a new line and preserve the current indentation
  - `Esc`: close autocomplete
  - Drag the center divider: resize editor vs preview
  - Drag the Problems divider: resize editor vs Problems panel
  - Double-click either divider: reset its size
  - Click a problem: jump to the affected line
  - Click a diagram participant, class, component, state, member, activity, or relationship: jump to its source
  - `⚡ Quick fix`: apply a suggested deterministic correction
  - `Ctrl/Cmd + Shift + F`: format the complete PlantUML script
  - `Ctrl/Cmd + Enter`: render
  - `Ctrl/Cmd + S`: save `.puml`
  - `Ctrl/Cmd + Shift + S`: save to a new file
  - `Ctrl/Cmd + O`: open a source file
  - `Ctrl/Cmd + N`: start a new diagram
  - `Ctrl/Cmd + +` / `Ctrl/Cmd + -`: zoom the preview in or out
  - `Ctrl/Cmd + 0`: reset preview zoom to 100%
  - `Ctrl/Cmd + Alt + /`: open the complete keyboard shortcut reference

## Syntax highlighting, color editing, and folding (v1.5.7)

The source editor uses a synchronized syntax-color layer while the normal textarea continues to own typing, selection, caret position, autocomplete, and keyboard behavior. Highlighting is visual only; it never changes the PlantUML source.

Colorization is now **type-based** instead of alias-based. Every object declared with the same PlantUML type gets the same reference color throughout the script. For example, all `participant` aliases share one color, all `actor` references share another, and `database`, `class`, `component`, `node`, `state`, and other types receive their type color.

The highlighter intentionally leaves prose neutral. Text inside multi-line `note ... end note` bodies is not token-colored, and relationship/message information after `:` is left as normal editor text. This avoids making words that merely look like aliases or PlantUML keywords appear as executable syntax.

Color values are now directly editable with a small popup. Click a real PlantUML color token such as `#32BCBB`, `#E9FAFA`, or a named token such as `#LightBlue` and the editor opens a compact selector beside the caret. You can use the operating system color picker or choose a common swatch; the selected value replaces only that color token. The popup uses the same syntax awareness as highlighting, so `#...` text inside note bodies or after a relationship/message `:` does **not** trigger the picker.

The editor also detects foldable PlantUML structures. A triangle appears in the line-number gutter beside supported block openers. Click it to collapse or expand that block. The toolbar includes **Fold all** and **Unfold all** for larger diagrams. Supported structures include sequence groups (`alt`, `opt`, `loop`, `par`, `group`, etc.), `box`, notes, `ref`, activity/control blocks, preprocessor blocks, and common `{ ... }` bodies such as classes, components, packages, nodes, partitions, and `skinparam` blocks.

Collapsing a block hides only its body while keeping the opening and closing statements visible. Diagnostics and rendering continue to use the complete PlantUML source, and jumping to a hidden error or clicking a diagram element automatically expands the containing block before selecting its source. If you begin editing while blocks are folded, the editor expands the folded view first so hidden PlantUML lines cannot be accidentally overwritten.


## Diagram-to-source navigation

The rendered SVG is interactive. Click a diagram element and the editor focuses and selects the PlantUML statement that produced it. Navigation supports common elements such as participants, actors, classes, components, nodes, databases, states, activities, class members, and labelled relationships/messages.

The mapper uses multiple signals so it can work across PlantUML diagram types:

1. Native source-line metadata from the generated SVG is used when the PlantUML engine provides it.
2. SVG entity/participant/link metadata is matched against PlantUML aliases and references.
3. Rendered labels and message text are matched against declarations, class members, activities, and relationship statements.
4. Implicit elements, such as states introduced only by a transition, jump to their first relevant relationship line.

If you edit the source after a successful render and the visible diagram is the **last-known-good** version, clicking an element first tries to relocate the same reference or relationship in the current editor. This means inserted or removed lines do not break navigation. If the element was renamed or deleted in the invalid current source, the status bar identifies the location as the **last rendered line** rather than presenting it as a current exact match.

Hovering a navigable element changes the pointer and the preview status bar shows the target line before you click. For diagram families with less structured SVG metadata, such as WBS or mind maps, the editor falls back to matching the rendered label text against the source.

### Source-line accuracy fix (v1.5.1)

PlantUML embeds source positions in generated SVG using zero-based line indexes. The editor uses normal one-based line numbers. v1.5.1 converts that metadata at the SVG boundary before resolving the source record, fixing the previous behavior where clicking a rendered element selected the line immediately above its PlantUML statement. Synthetic `@startuml` wrapper lines are also accounted for when a script is rendered without explicit start/end directives.

## Syntax diagnostics

The editor performs fast local checks before rendering and combines them with errors reported by the PlantUML engine. Current checks include:

- Missing or mismatched `@start...` / `@end...` directives
- Unterminated quoted labels
- Unbalanced `{ ... }` blocks
- Unclosed sequence blocks such as `alt`, `opt`, `loop`, `par`, `break`, `critical`, and `group`
- Unclosed activity `if` / `while` blocks and preprocessor conditions
- Unclosed `note`, `legend`, and `ref` blocks
- Missing aliases after `as`
- Missing activity action semicolons
- Common PlantUML keyword typos such as `particpant` → `participant`
- Relationship arrows with a missing source or target
- Duplicate references/aliases declared more than once
- Relationship or lifecycle references that are used but never declared anywhere in the script

Reference checks are reported as **warnings**, so they do not block rendering. A definition may appear before or after its use; the checker scans the complete script before deciding that a reference is undefined.

For safe corrections, the Problems panel displays a **Quick fix** button. Parser errors that cannot be corrected safely are still shown with the PlantUML message and a suggested place to investigate.

## Reference conflict checks

The semantic checker builds a reference table from declarations such as `participant`, `actor`, `component`, `class`, `database`, `node`, `state`, and similar PlantUML elements. It recognizes explicit aliases such as `participant "Web Portal" as Portal` and direct names such as `class Application`.

It warns when:

- The same reference or alias is declared more than once. The warning points to the duplicate line and the expanded details show the first declaration.
- A relationship uses a source or target that is not declared anywhere in the current script.
- Lifecycle statements such as `activate`, `deactivate`, `destroy`, and common `note/ref over` usages point to an undefined reference.

These are intentionally warnings rather than syntax errors because PlantUML can implicitly create some elements. The diagram continues to render while the warning remains visible.

## Last-known-good rendering

The editor never replaces a valid diagram with a PlantUML error image. The update flow is:

1. Fast local syntax checks run while you type.
2. If a blocking local error exists, rendering is skipped and the current preview is preserved.
3. If local checks pass, PlantUML renders to an in-memory candidate SVG.
4. If PlantUML reports a parser/syntax error, that candidate is discarded and the last valid SVG remains visible.
5. Only a successful candidate replaces the preview and becomes the SVG/PNG export source.

The status bar indicates when the preview is showing the last valid diagram while the current source contains errors.

## Adjustable panels

- Drag the vertical divider between the editor and preview to change their widths.
- Drag the horizontal divider above **Problems** to change the diagnostics height.
- Keyboard users can focus a divider and use arrow keys to resize it.
- Double-click a divider to restore its default size.
- The selected sizes are saved in browser local storage.

## Requirements

- Node.js 20+ recommended
- npm
- Internet access only for the first `npm install`

The project uses `@plantuml/core` 1.2026.6, the official PlantUML JavaScript/TeaVM renderer.

## Run locally

### Windows PowerShell

```powershell
cd plantuml-local-studio
npm install
npm run dev
```

Open the local address printed by Vite, normally:

```text
http://127.0.0.1:5173
```

### macOS / Linux

```bash
cd plantuml-local-studio
npm install
npm run dev
```

Then open the local address printed by Vite.

## Build a local production copy

```bash
npm install
npm run build
npm run preview
```

Vite creates the production files under `dist/`.

## Offline usage

After `npm install`, the renderer itself does not call an external PlantUML server. The PlantUML engine and Viz.js/Graphviz JavaScript assets are served from your local project.

For a completely disconnected machine, run `npm install` once on a connected machine, then copy the whole project **including `node_modules`** to the disconnected machine. Alternatively, build the project and copy `dist/`, then serve `dist/` with any local static HTTP server.

## How it works

```text
PlantUML text
     |
     v
Browser JavaScript UI
     |
     v
@plantuml/core (TeaVM PlantUML engine)
     |
     +--> Viz.js layout for Graphviz-dependent diagrams
     |
     v
SVG string
     |
     +--> Preview
     +--> SVG export
     +--> Canvas --> PNG export
```

## Notes

- PlantUML standard-library sprite bundles are intentionally not added by this app itself. Basic PlantUML/UML diagram types work through the core package. If your diagrams depend on optional external includes, you may need to vendor those resources locally.
- Source files stay in the browser unless you explicitly save/export them.

### Readable, expandable error messages

The **Problems** panel keeps each issue concise by default so you can quickly scan errors and warnings. Each problem shows its severity, source, line number, a readable explanation, and a suggested action when available.

Use **Show details** on any issue to expand the full diagnostic information, including the source line and the complete PlantUML parser message. Long parser output wraps and scrolls inside the expanded section instead of overwhelming the panel.

The preview error banner follows the same approach: it shows a short status while preserving the last valid diagram, with the raw PlantUML error available under **Show PlantUML error details**.

### Invalid-preview protection fix (v1.5.2)

v1.5.2 strengthens the last-known-good rendering rule. An unmatched standalone `end` is now a blocking local syntax error instead of a warning, so live rendering does not call PlantUML for that invalid source. The renderer also detects PlantUML error SVGs such as `Cannot create group (Assumed diagram type: sequence)` in addition to classic `Syntax Error` output. Error SVGs are validation results only: they are shown in Problems/details and never replace the last successfully rendered diagram or its export state.


### Editor caret stability fix (v1.5.3)

v1.5.3 keeps the editor caret, active selection, horizontal scroll, and vertical scroll stable while local diagnostics and live-render updates refresh other parts of the interface. Pressing **Enter** now inserts a new line using the indentation of the current PlantUML line, so editing inside nested blocks no longer jumps back to column 1. Autocomplete behavior is unchanged: when the suggestion list is open, Enter/Tab accepts the selected suggestion; otherwise Enter performs the indentation-preserving newline.

### PlantUML script formatter (v1.5.4)

v1.5.4 adds a **Format** command for making nested PlantUML blocks easier to scan. Use the toolbar **Format** button or press **Ctrl/Cmd + Shift + F**. The formatter applies consistent two-space indentation while keeping statement order, comments, blank lines, and diagram semantics intact.

It understands common PlantUML structures including sequence blocks (`alt`, `else`, `opt`, `loop`, `par`, `critical`, `group`, `box`), activity blocks (`if/else/endif`, `while/endwhile`, `repeat`, `fork`, `switch`), multiline notes, braces used by classes/components/skinparams/packages/nodes, and common preprocessor blocks. Formatting preserves the caret on the same logical source content and keeps the editor scroll position stable.


### File workflow and diagram quick edit (v1.6.0)

- The editor status bar shows the active file name and whether the source is **Saved**, **Modified • Save required**, or **New • Save required**. The browser tab also displays a leading status dot while changes are unsaved.
- In browsers that support the File System Access API, **Open** keeps a writable handle to the selected source file. **Save** then writes directly back to that file without asking for a location again.
- A new diagram, template, or browser-restored draft has no file handle. Its first **Save** opens the browser save picker for the location and file name; later saves write directly to that selected file.
- Browsers without writable file handles fall back to normal file upload/download behavior. They cannot overwrite a local file silently, so a downloaded copy is used instead.
- Hover over a navigable rendered object for a compact **Quick edit** card. The card can add, replace, or clear the object's PlantUML color token and stereotype/style marker. Applying the edit updates the source, participates in Undo/Redo, refreshes validation, and live-renders the diagram.
- The page warns before closing or reloading when the current source requires saving.
