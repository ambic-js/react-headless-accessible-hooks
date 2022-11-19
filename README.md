Hooks to power complex interactive components, leaving the DOM and styles to you.

### Todo

- [x] If no confgen command is present, add one
- [x] Get codedocs templates working OOB
- [x] Get vitest templates working OOB
- [x] Set up RTL
- [x] Add basic test for drag-n-drop
- [x] Implement drag-n-drop

Finish useOrderableList + cleanup:

- [x] Grab down
- [x] Don't allow drag away
- [x] Add to bottom of list when you're within gap + height below if placeholder is gone
- [x] Elevation
- [x] Hand doesn't let go on drop
- [x] Fix: cursor flashing when dragging on border
- [ ] Fix flashing when dragging quickly between slots
- [ ] Re-implement drag model separate from the DOM stuff
- [ ] Fix double dragging
- [ ] Move out `handleUp` into its own function
- [ ] Rename `list` to `service`
- [ ] Remove _all_ styling from hook that aren't dynamically written

Necessary for a V1 release:

- [ ] Keyboard control
- [ ] Accessibility announce & roles

Maybes:

- [ ] Support handles
- [ ] Try: Auto-center dragging element
- [ ] Rotation
- [ ] Fix: flicker when dragging slowly into last position
