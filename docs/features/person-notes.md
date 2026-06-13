# Person Notes (Trello-Style)

## Purpose

Provides a compact, highly interactive notes list for person nodes inside the inspector sidebar panel, structured and styled like Trello list columns and cards. It allows users to write notes quickly with minimal screen space and useful keyboard shortcuts.

## Behavior

- **Notes List Column**: Grouped under a light gray `#f1f2f4` column header containing the title "Notes" and a rounded gray count badge showing the total number of cards.
- **Trello Cards**: Each note is rendered as a clean white card with rounded corners, a subtle drop shadow, and a dark slate text color. Hovering over a card reveals a small trash icon to delete the card.
- **Add Note Composer**:
  - Toggled by clicking `+ Add a card` at the bottom of the list.
  - Contains a borderless, shadowless textarea matching the card footprint.
  - Controls row at the bottom with a blue `Add card` button, a cancellation `✕` button, and a help `Tip` button.
- **Keyboard Shortcuts**:
  - `Enter` (without Shift) in the composer: immediately submits/adds the note, clears the text, and maintains input focus so the user can quickly type multiple notes in a row.
  - `Escape` in the composer: cancels card creation and closes the composer.
- **Inline Editing**: Clicking on any card body transforms the card directly into an inline textarea for quick updates. Pressing `Enter` (without Shift) or `Escape` saves or exits the editor.

## Design

- **Surfaces / elevation**: Cards use a light box shadow (`0px 1px 1px #091e4240, 0px 0px 1px #091e424f`) and flat white background. The list uses a solid light gray `#f1f2f4` container.
- **Components used**: Composer buttons (`.trello-list__composer-add-btn`, `.trello-list__composer-cancel-btn`, `.trello-list__composer-tip-btn`) matching Trello layout.
- **Color roles used**: Neutral surface container colors and Trello brand colors (#0c66e4 primary blue, #172b4d primary slate).

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

## Open questions / TODO

None.
