# Multi-selection delete design

## Goal

Add a destructive action to the existing multi-selection panel so a user can delete all
selected circles and people in one operation, alongside the existing **Merge into subset**
and **Cancel** actions.

## Interaction

- Show a Material 3 error-colored **Delete selected** button whenever the multi-selection
  panel is visible.
- Clicking the button deletes the selected circles and selected people immediately, without
  a confirmation dialog.
- The protected root circle (`you`) is never deleted, even if it is present in the selection.
- Clear the multi-selection after the operation.
- Record one history snapshot before changing the graph so one Ctrl/Cmd+Z restores the whole
  deletion.

## Graph behavior

- Delete every selected person and every selected non-root circle.
- Remove authored connections whose endpoint is a deleted person or circle.
- Keep unselected people that belong to a deleted circle, preserving their world position and
  detaching them from circle membership.
- Keep unselected child circles of deleted circles and promote each one to the nearest retained
  ancestor. If no retained ancestor exists, use the protected root circle as the parent.
- Clear `connectedTo` when its target circle is deleted.
- Run the normal post-interaction graph settling once after the combined mutation.

## UI placement

Keep the existing compact panel and action order:

1. **Merge into subset**
2. **Delete selected**
3. **Cancel**

The delete action uses the existing Material 3 error-container colors so it reads as destructive
without introducing a new component or dialog.

## Verification

- Select multiple circles and delete them.
- Select a mixture of circles and people and delete them.
- Verify the root circle remains when selected with other items.
- Verify unselected people and nested circles survive with repaired membership/parent links.
- Verify connections to deleted nodes are removed.
- Verify one Ctrl/Cmd+Z restores the full pre-delete graph and selection-independent graph data.
- Run the repository's local lint/type/build checks and restart the local server.
