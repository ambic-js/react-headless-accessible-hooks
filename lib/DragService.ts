import without from "lodash/without"
import { assertHTMLTarget } from "~/helpers"

type Point = { x: number; y: number }

type DragServiceOptions = {
  onDragEnd: (newOrderedIds: string[]) => void
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
  placeholderElementIndex: number | undefined

  constructor(ids: string[], { onDragEnd }: DragServiceOptions) {
    this.orderedElementIds = ids
    this.onDragEnd = onDragEnd
  }

  onMouseDown(event: React.MouseEvent) {
    assertHTMLTarget(event)
    this.downAt = this.lastPoint = { x: event.clientX, y: event.clientY }
    this.lastDirection = undefined
    this.downElement = event.target
    this.downId = event.target.dataset.rhahOrderableListId
    this.downRect = event.target.getBoundingClientRect()
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

  getGap(direction: "up" | "down") {
    if (this.elements.length < 2) return 0

    const lastIndex = direction === "up" ? 0 : this.elements.length - 1
    const nextToLastIndex = direction === "up" ? 1 : this.elements.length - 1
    const last = this.elements[lastIndex]
    const nextToLast = this.elements[nextToLastIndex]

    return this.getRect(last).top - this.getRect(nextToLast).bottom
  }

  startTracking(
    id: string,
    event: Pick<MouseEvent, "clientX" | "clientY">,
    { onDragTo }: { onDragTo: (index: number) => void }
  ) {
    if (this.handleMove || this.handleUp) {
      throw new Error(
        "Trying to track drag, but move/up handlers already exist"
      )
    }

    this.isDragging = true
    this.draggingId = id

    assertDragging(this, "startTracking")

    // This handler is defined outside the class 1) because it's a pretty big
    // function, and 2) because we can then curry it and keep the reference to
    // the curry so it can be later removed from the window's event listeners
    // when the drag stops.
    this.handleMove = getMouseMoveHandler(this, onDragTo)

    // This would've been a mousemove event so we should handle that so we
    // report back the correct placeholderIndex to the hook... although I'm
    // thinking maybe we can skip this because we add a window mousemove handler
    // and then this event bubbles up to that? this.handleMove(event)

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

      if (
        this.placeholderItemIndex === undefined ||
        this.placeholderElementIndex === undefined
      ) {
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

      // First remove the id we're dragging:
      const orderedItemIds = without(this.orderedElementIds, droppedId)
      // Then find the placeholder:
      const placeholderItemIndex = orderedItemIds.findIndex((id) => {
        return isPlaceholderId(id)
      })
      // Then replace the placeholder with the dragged item:
      orderedItemIds[placeholderItemIndex] = droppedId

      this.onDragEnd(orderedItemIds)
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

export const isPlaceholderId = (id: string) => /^rhah-placeholder-/.test(id)

const withoutPlaceholderIds = (ids: string[]) => {
  return ids.filter((id) => !isPlaceholderId(id))
}

const getMouseMoveHandler = (
  // todo: rename to service
  list: DragService,
  onDragTo: (index: number) => void
) =>
  function handleMouseMove(event: Pick<MouseEvent, "clientX" | "clientY">) {
    assertDragging(list, "getMouseMoveHandler")

    const dy = event.clientY - list.downAt.y
    const dx = event.clientX - list.downAt.x
    const log = false // Math.random() < 0.025
    const dyFromLastPoint = event.clientY - list.lastPoint.y

    const direction =
      dyFromLastPoint > 0
        ? "down"
        : dyFromLastPoint < 0
        ? "up"
        : list.lastDirection || "down"

    list.lastDirection = direction
    list.lastPoint = { x: event.clientY, y: event.clientY }

    log && console.log(dy, direction)
    const position = list.getDragElementPosition(event)

    let newElementIndex = list.placeholderElementIndex || -2
    let newItemIndex = list.placeholderItemIndex || -2

    if (direction === "down") {
      let itemIndex = 0
      for (
        let elementIndex = 0;
        elementIndex <= list.maxElementIndex;
        elementIndex++
      ) {
        const element = list.elements[elementIndex]

        if (elementIndex !== list.placeholderElementIndex) {
          itemIndex++
        }

        const targetRect = list.getRect(element)
        const mightSwap = intrudesDown(dy, list.downRect, targetRect)

        if (
          elementIndex === list.maxElementIndex &&
          isBelow(dx, dy, list.downRect, targetRect)
        ) {
          newItemIndex = newElementIndex = -2
          break
        }

        intrudesDown(dy, list.downRect, targetRect)

        log &&
          console.log(
            elementIndex,
            element.innerHTML,
            mightSwap ? "might swap" : "too low"
          )

        if (mightSwap) {
          newItemIndex = newElementIndex = itemIndex
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

        const targetRect = list.getRect(element)
        const mightSwap = intrudesUp(dy, list.downRect, targetRect)

        /// clean up
        const isLastPossibleElement =
          (elementIndex === 1 &&
            list.elements[0].dataset.rhahOrderableListId === list.draggingId) ||
          elementIndex === 0

        if (
          isLastPossibleElement &&
          isAbove(dx, dy, list.downRect, targetRect)
        ) {
          newItemIndex = newElementIndex = -2
          break
        }

        log &&
          console.log(
            elementIndex,
            element.innerHTML,
            mightSwap ? "might swap" : "too high"
          )

        const getItemIndex = () => {
          if (!list.placeholderElementIndex) return elementIndex
          if (list.placeholderElementIndex > elementIndex) return elementIndex
          if (list.placeholderElementIndex < 0) return elementIndex
          return elementIndex - 1
        }

        if (mightSwap) {
          newItemIndex = newElementIndex = getItemIndex()
        } else {
          break
        }
      }
    }

    // In the initial placement of the placeholder, we want to leave the
    // dragElement in place, so that the lower elements don't jump up into an
    // empty space. So we need to wait to set this style.position value until
    // AFTER we calculate the intrusion. At least on the first mousemove. After
    // that the placeholder is in the list so it doesn't matter.
    list.downElement.style.position = "absolute"
    list.downElement.style.top = position.top
    list.downElement.style.left = position.left

    if (list.placeholderItemIndex !== newItemIndex) {
      list.placeholderItemIndex = newItemIndex
      list.placeholderElementIndex = newElementIndex
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
  if (
    draggingItemRect.top + dy <
    targetItemRect.bottom - draggingItemRect.height / 2
  ) {
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
