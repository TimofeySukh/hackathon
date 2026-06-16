# Person Notes

## Purpose

Provides a compact, Material 3 notes list for person nodes inside the inspector side
sheet. It allows users to write notes quickly with minimal screen space and useful
keyboard shortcuts. Profile links and social handles live in the separate Person
Connections feature, not in notes.

## Behavior

- **Notes list**: Grouped under a compact Material 3 neutral container header containing the title "Notes".
- **Note cards**: Each note is rendered as a filled M3 card on a tonal surface. Cards
  animate in with a short fade/translate, lift slightly on hover/focus, and scale down
  subtly on press. Hovering or focusing a card reveals a small trash icon to delete it.
- **Add Note Composer**:
  - Toggled by clicking `+ Add note` at the bottom of the list.
  - Contains a borderless textarea in the same filled-card footprint.
  - Controls row at the bottom with a blue `Save note` button and a discard `✕` button (cancellation cross icon).
- **Keyboard Shortcuts**:
  - `Enter` (without Shift) in the composer: immediately saves the note, clears the text, and maintains input focus so the user can quickly type multiple notes in a row.
  - `Escape` in the composer: cancels card creation and closes the composer.
- **Inline Editing**: Clicking on any card body transforms the card directly into an
  inline textarea for quick updates. Text changes stay in a local draft while typing so
  the board graph is not rewritten per keystroke. Pressing `Enter` (without Shift) or
  blurring the field saves the draft; `Escape` cancels it.
- **Save note button**: Clicking the "Save note" button does the same as pressing Enter (saves and keeps the composer open and focused).

## Design

- **Surfaces / elevation**: The list uses `--md-surface-container-high`; cards use
  `--md-surface-container-low` with `--md-elev-1` and lift to `--md-elev-2` on hover/focus.
- **Components used**: Filled note cards, filled text field behavior, filled button,
  icon button, and Material state layers.
- **Color roles used**: Neutral surface container colors plus `--md-primary` and
  `--md-error` roles for actions.
- **Motion**: New cards and editors enter with a short fade/translate or fade/scale.
  Card hover/press, delete buttons, and composer buttons use the shared M3 motion tokens.

## Code

- **Main files**:
  - [App.tsx](file:///Users/velizard/Projects/hackathon/src/App.tsx) (inline rendering under `.trello-list` container)
  - [index.css](file:///Users/velizard/Projects/hackathon/src/index.css) (Trello-style CSS layouts)
- **Key functions / components**:
  - `addPersonNote`
  - `updatePersonNote`
  - `deletePersonNote`
- **Related state**:
  - `newNoteBody` (current input content)
  - `isAddingNote` (composer toggle)
  - `editingNoteId` (active inline editor tracking)
  - `editingNoteBody` (local inline-edit draft)

## Open questions / TODO

None.
