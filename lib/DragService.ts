import without from "lodash/without"
import { assertHTMLTarget, moveItemTo } from "~/helpers"

type Point = { x: number; y: number }

type DragServiceOptions = {
  onDragEnd: (newOrderedIds: string[]) => void
  dragOutIsAllowed: boolean
}

/**
 * The DragService keeps track of all of the data that doesn't need to directly
 * affect React state.
 *
 * The `useOrderableList` hook only keeps state for the couple of things that
 * need to trigger re-renders of the consuming component. I.e. the things that
 * change when a placeholder moves:
 *  - `placeholderItemIndex`
 *  - `draggingId`
 *
 * However, we don't want mousemoves to trigger re-renders (most of the time) so
 * the DragService is mostly for handling mousemoves.
 *
 * ### Note on placeholder indexes:
 *
 * There are two different ways of indexing the items, which is a bit confusing:
 *
 *  - an "item index" is the index of an item, ignoring the placeholder. We use
 *    this to splice the placeholder into the actual items
 *
 *  - an "element index" is the index of an item within the DOM elements,
 *    INCLUDING the placeholder. We use this to iterate over those elements
 */
export class DragService {
  downId: string | undefined
  downAt: Point | undefined
  lastPoint: Point | undefined
  lastDirection: "up" | "down" | undefined
  isDragging = false
  draggingId: string | undefined
  downElement: HTMLElement | undefined
  downRect: DOMRect | undefined
  itemRectCache: Record<string, DOMRect> = {}
  elements: HTMLElement[] = []
  maxElementIndex = 0
  handleMove:
    | ((event: Pick<MouseEvent, "clientX" | "clientY">) => void)
    | undefined
  handleUp: (() => void) | undefined
  onDragEnd: (newOrderedIds: string[]) => void
  orderedElementIds: string[]
  placeholderItemIndex: number | undefined
  originalItemIndex: number | undefined
  didMountPlaceholder = false
  dragOutIsAllowed: boolean

  constructor(
    ids: string[],
    { onDragEnd, dragOutIsAllowed }: DragServiceOptions
  ) {
    this.orderedElementIds = ids
    this.dragOutIsAllowed = dragOutIsAllowed
    this.onDragEnd = onDragEnd
  }

  onMouseDown(event: React.MouseEvent) {
    assertHTMLTarget(event)
    this.downAt = this.lastPoint = { x: event.clientX, y: event.clientY }
    this.lastDirection = undefined
    this.downElement = event.target
    this.downId = event.target.dataset.rhahOrderableListId
    this.originalItemIndex = this.elements.findIndex(
      (element) => element.dataset.rhahOrderableListId === this.downId
    )
    if (this.originalItemIndex < 0) {
      throw new Error("what is original index?")
    }
    this.downRect = event.target.getBoundingClientRect()
    this.didMountPlaceholder = false
  }

  /**
   * Each time the `useOrderableList` hook re-renders we rebuild a list of DOM
   * Elements stored here in the DragService. The way that works is the hook
   * calls this `resetElementList` function, which empties out the list, and
   * then when the `getItemProps(i)` function is called for each item in the
   * list, that provides the element with a callback ref, and as that callback
   * is called, we repopulate the element list by calling `pushElement` (below).
   *
   * This guarantees the element list is always up-to-date with the most recent
   * elements and placeholder position, even if those things are changing
   * mid-drag.
   */
  resetElementList(ids: string[]) {
    this.orderedElementIds = ids
    this.maxElementIndex = ids.length - 1
  }

  /**
   * Updates the index of an item element in the element list.
   *
   * See `resetElementList` above for details.
   */
  pushElement(element: HTMLElement, index: number) {
    if (!this.didMountPlaceholder && isPlaceholderId(getItemId(element))) {
      this.didMountPlaceholder = true
    }
    if (index > this.maxElementIndex) {
      throw new Error(
        `Adding an element at index ${index} which is beyond the max expected index of ${this.maxElementIndex}`
      )
    }
    this.elements[index] = element
  }

  dragDidStartAt(id: string, x: number, y: number) {
    // If we didn't mouse down on a draggable element, this is definitely not a drag
    if (!this.downId || !this.downAt) return false
    // If we moused down on a different draggable element, that's weird. Not a drag.
    if (id !== this.downId) return false
    // If we came up at the same pixel we went down, also not a drag.
    if (x === this.downAt.x && y === this.downAt.y) return false
    // Otherwise, yes it is a drag!
    return true
  }

  getRect(element: HTMLElement) {
    // const id = element.dataset.rhahOrderableListId as string

    // FIXME: If the element changes size ever, this cache will be stale. So
    // we'll need to add ResizeObservers at some point to invalidate the cache.
    // if (this.itemRectCache[id]) return this.itemRectCache[id]

    const rect = element.getBoundingClientRect()
    if (rect.bottom === 0 && process.env.NODE_ENV === "test") {
      throw new Error("Very suspicious")
    }
    // this.itemRectCache[id] = rect

    return rect
  }

  getLastRect() {
    if (this.maxElementIndex < 0) return
    const element = this.elements[this.maxElementIndex]
    if (element.dataset.rhahOrderableListId !== this.draggingId) {
      return this.getRect(element)
    }
    if (this.maxElementIndex < 1) return
    return this.getRect(this.elements[this.maxElementIndex - 1])
  }

  getDragElementPosition(event: Pick<MouseEvent, "clientX" | "clientY">): {
    top: string
    left: string
  } {
    assertDragging(this, "getDragElementPosition")

    const top = `${this.downRect.top + event.clientY - this.downAt.y}px`
    const left = `${this.downRect.left + event.clientX - this.downAt.x}px`

    return {
      top,
      left,
    }
  }

  /**
   * Returns the "item index" which is usually the same as the "element
   * index" but not always
   */
  getItemIndex(elementIndex: number) {
    const element = this.elements[elementIndex]
    // If this is the placeholder, they are the same:
    if (isPlaceholderId(element.dataset.rhahOrderableListId || "")) {
      return elementIndex
    }
    // If we didn't place the placeholder yet, they are the same:
    if (!this.placeholderItemIndex) return elementIndex
    // If the placeholder is below the element in the list, they are the same:
    if (this.placeholderItemIndex > elementIndex) return elementIndex
    // If there is no placeholder, they are the same:
    if (this.placeholderItemIndex < 0) return elementIndex
    // Otherwise the placeholder is before the element and the item index
    // is one less than the element index:
    return elementIndex - 1
  }

  startTracking(
    id: string,
    event: Pick<MouseEvent, "clientX" | "clientY" | "stopPropagation">,
    { onDragTo }: { onDragTo: (index: number) => void }
  ) {
    if (this.handleMove || this.handleUp) {
      throw new Error(
        "Trying to track drag, but move/up handlers already exist"
      )
    }

    // In the initial drag, we're in a bit of a weird state because the
    // placeholder will not be added to the list yet, and yet the element
    // bounding rects are going to appear as if they are, since we're just about
    // to pop the dragging element out of the list. So we need to manually
    // position the placeholder for this first drag event, and after this we'll
    // let the window.mousemove handler take care of placeholder positioning.
    // But for this first time we stop propagation because that window mousemove
    // handler will do the wrong thing in this initial state:
    event.stopPropagation()

    this.isDragging = true
    this.draggingId = id

    assertDragging(this, "startTracking")

    // This handler is defined outside the class 1) because it's a pretty big
    // function, and 2) because we can then curry it and keep the reference to
    // the curry so it can be later removed from the window's event listeners
    // when the drag stops.
    this.handleMove = getMouseMoveHandler(this, onDragTo)

    const startIndex = this.orderedElementIds.indexOf(id)
    this.placeholderItemIndex = startIndex
    const position = this.getDragElementPosition(event)
    this.downElement.style.top = position.top
    this.downElement.style.left = position.left
    onDragTo(startIndex)

    this.handleUp = () => {
      if (!this.handleMove) {
        throw new Error(
          "Tried to unsubscribe from mousemove and mouseup but handleMove is missing"
        )
      }

      if (!this.handleUp) {
        throw new Error(
          "Tried to unsubscribe from mousemove and mouseup but handleUp is missing"
        )
      }

      if (!this.downElement) {
        throw new Error("Got mouseUp event but downElement is undefined?")
      }

      if (!this.draggingId) {
        throw new Error("Got mouseUp event but draggingId is undefined?")
      }

      if (this.placeholderItemIndex === undefined) {
        throw new Error("Got mouseUp event but placeholderIndex is undefined?")
      }

      window.removeEventListener("mousemove", this.handleMove)
      window.removeEventListener("mouseup", this.handleUp)

      const droppedId = this.draggingId

      this.downElement.style.position = ""
      this.downElement.style.top = ""
      this.downElement.style.left = ""

      this.handleMove = undefined
      this.handleUp = undefined
      this.downId = undefined
      this.downAt = undefined
      this.lastPoint = undefined
      this.isDragging = false
      this.draggingId = undefined
      this.downElement = undefined
      this.downRect = undefined

      if (this.placeholderItemIndex === -2) {
        this.onDragEnd(withoutPlaceholderIds(this.orderedElementIds))
        return
      }

      const oldItemIds = this.orderedElementIds.filter(
        (id) => !isPlaceholderId(id)
      )
      const newItemIds = moveItemTo(
        oldItemIds,
        (id) => id === droppedId,
        this.placeholderItemIndex // this is wrong because it's "might swap" on the placeholder but by definition, placeholder items shouldn't be included in item indexes
      )

      debugger
      this.onDragEnd(newItemIds)
    }

    window.addEventListener("mousemove", this.handleMove)
    window.addEventListener("mouseup", this.handleUp)
  }

  destroy() {
    if (this.handleMove) {
      window.removeEventListener("mousemove", this.handleMove)
    }
    if (this.handleUp) {
      window.removeEventListener("mouseup", this.handleUp)
    }
  }
}

const getItemId = (element: HTMLElement) => {
  return element.dataset.rhahOrderableListId as string
}

export const isPlaceholderId = (id: string) => /^rhah-placeholder-/.test(id)

const withoutPlaceholderIds = (ids: string[]) => {
  return ids.filter((id) => !isPlaceholderId(id))
}

const getMouseMoveHandler = (
  list: DragService,
  onDragTo: (index: number) => void
) =>
  function handleMouseMove(event: Pick<MouseEvent, "clientX" | "clientY">) {
    console.log("handlemousemove")
    assertDragging(list, "getMouseMoveHandler")

    const dy = event.clientY - list.downAt.y
    const dx = event.clientX - list.downAt.x
    const log = true //Math.random() < 0.025
    const dyFromLastPoint = event.clientY - list.lastPoint.y

    const rawDirection =
      dyFromLastPoint > 0 ? "down" : dyFromLastPoint < 0 ? "up" : undefined

    const direction = rawDirection ? rawDirection : list.lastDirection || "down"

    list.lastDirection = direction
    list.lastPoint = { x: event.clientY, y: event.clientY }

    log && console.log(dy, direction)
    const position = list.getDragElementPosition(event)

    list.downElement.style.top = position.top
    list.downElement.style.left = position.left

    // if (!list.didMountPlaceholder) {
    //   return
    // }

    let newItemIndex = list.placeholderItemIndex || -2

    if (direction === "down") {
      for (
        let elementIndex = 0;
        elementIndex <= list.maxElementIndex;
        elementIndex++
      ) {
        const element = list.elements[elementIndex]

        if (element.dataset.rhahOrderableListId === list.draggingId) {
          continue
        }

        const targetRect = list.getRect(element)
        const mightSwap = intrudesDown(dy, list.downRect, targetRect)

        const isLastElement = elementIndex === list.maxElementIndex
        const isSecondToLast = elementIndex === list.maxElementIndex - 1
        const lastElementIsDetached =
          list.elements[list.maxElementIndex].dataset.rhahOrderableListId ===
          list.draggingId

        const isLastPossibleElement =
          isLastElement || (isSecondToLast && lastElementIsDetached)

        if (
          isLastPossibleElement &&
          isBelow(dx, dy, list.downRect, targetRect)
        ) {
          console.log("break")
          newItemIndex = -2
          break
        }

        intrudesDown(dy, list.downRect, targetRect)

        log &&
          console.log(
            `${element.innerHTML || "placeholder"} (${elementIndex}) ${
              mightSwap ? "might swap" : "too low"
            }`
          )

        if (mightSwap) {
          newItemIndex = elementIndex
        } else {
          break
        }
      }
    } else {
      for (
        let elementIndex = list.maxElementIndex;
        elementIndex >= 0;
        elementIndex--
      ) {
        const element = list.elements[elementIndex]

        if (element.dataset.rhahOrderableListId === list.draggingId) {
          continue
        }

        const targetRect = list.getRect(element)

        const firstElementIsDetached =
          list.elements[0].dataset.rhahOrderableListId === list.draggingId

        const isLastPossibleElement =
          (elementIndex === 1 && firstElementIsDetached) || elementIndex === 0

        const mightSwap = intrudesUp(dy, list.downRect, targetRect)

        if (
          isLastPossibleElement &&
          isAbove(dx, dy, list.downRect, targetRect)
        ) {
          newItemIndex = -2
          break
        }

        log &&
          console.log(
            `${
              element.innerHTML || "placeholder"
            } (${elementIndex}/${list.getItemIndex(elementIndex)}) ${
              mightSwap ? "might swap" : "too high"
            }`
          )

        if (mightSwap) {
          newItemIndex = list.getItemIndex(elementIndex)
        } else {
          break
        }
      }
    }

    const lastRect = list.getLastRect()
    const overlaps =
      lastRect && wouldOverlapBottom(dx, dy, list.downRect, lastRect)
    if (
      rawDirection !== "down" &&
      newItemIndex < 0 &&
      list.placeholderItemIndex !== undefined &&
      list.placeholderItemIndex < 0 &&
      overlaps
    ) {
      newItemIndex = list.maxElementIndex + 1
    }

    log &&
      console.log(
        "newItemIndex",
        newItemIndex,
        "existing",
        list.placeholderItemIndex
      )

    if (newItemIndex < 0 && !list.dragOutIsAllowed) return

    if (list.placeholderItemIndex !== newItemIndex) {
      list.placeholderItemIndex = newItemIndex
      onDragTo(newItemIndex)
    }
  }

/**
 * The algorithm we use to determine whether an item should move out of the way
 * for the placeholder is:
 *
 *  - when moving downward (dy > 0)...
 *    - an element should be moved above the placeholder if...
 *      - the element being dragged extends one half of its height into that
 *        element
 *  - when moving upward (dy <= 0)...
 *    - an element should be moved below the placeholder if...
 *      - the element being dragged extends one half of its height into that
 *        element
 *
 * These two functions, `intrudesDown` and `intrudesUp` calculate whether an
 * element should slide past the placeholder in each of those scenarios.
 */
const intrudesDown = (
  dy: number,
  draggingItemRect: DOMRect,
  targetItemRect: DOMRect
) => {
  if (
    draggingItemRect.bottom + dy >
    targetItemRect.top + draggingItemRect.height / 2
  ) {
    return true
  }
  return false
}

const intrudesUp = (
  dy: number,
  draggingItemRect: DOMRect,
  targetItemRect: DOMRect
) => {
  const threshold = targetItemRect.bottom - draggingItemRect.height / 2

  if (draggingItemRect.top + dy < threshold) {
    return true
  }
  return false
}

/**
 * These aren't strictly above/below checks, they also return false if the
 * dragging item is fully to the left or right of the target item, so they serve
 * to check if the dragging item has left the list (in a certain direction)
 */
const isBelow = (
  dx: number,
  dy: number,
  draggingItemRect: DOMRect,
  targetItemRect: DOMRect
) => {
  if (draggingItemRect.top + dy > targetItemRect.bottom) return true
  if (draggingItemRect.right + dx < targetItemRect.left) return true
  if (draggingItemRect.left + dx > targetItemRect.right) return true
  return false
}

const isAbove = (
  dx: number,
  dy: number,
  draggingItemRect: DOMRect,
  targetItemRect: DOMRect
) => {
  if (draggingItemRect.bottom + dy < targetItemRect.top) return true
  if (draggingItemRect.right + dx < targetItemRect.left) return true
  if (draggingItemRect.left + dx > targetItemRect.right) return true
  return false
}

const wouldOverlapBottom = (
  dx: number,
  dy: number,
  draggingItemRect: DOMRect,
  lastItemRect: DOMRect
) => {
  if (draggingItemRect.right + dx < lastItemRect.left) return false
  if (draggingItemRect.left + dx > lastItemRect.right) return false

  if (
    draggingItemRect.top + dy <
    lastItemRect.bottom - draggingItemRect.height / 2
  ) {
    return false
  }

  if (
    draggingItemRect.top + dy <
    lastItemRect.bottom + draggingItemRect.height
  ) {
    return true
  }

  return false
}

type DraggingDragService = DragService & {
  downAt: Exclude<DragService["downAt"], undefined>
  downElement: Exclude<DragService["downElement"], undefined>
  downRect: Exclude<DragService["downRect"], undefined>
  isDragging: true
  lastPoint: Exclude<DragService["lastPoint"], undefined>
}

/**
 * Type guard that lets code know whether the DragService is in a dragging state
 * or not. Makes for fewer null checks.
 */
function assertDragging(
  list: DragService,
  functionName: string
): asserts list is DraggingDragService {
  if (
    !list.downAt ||
    !list.downElement ||
    !list.downRect ||
    !list.isDragging ||
    !list.lastPoint
  ) {
    throw new Error(
      `Cannot evaluate ${functionName} unless DragService is in dragging state`
    )
  }
}
