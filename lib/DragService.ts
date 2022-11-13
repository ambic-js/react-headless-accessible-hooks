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
 *  - placeholderIndex
 *  - draggingId
 *
 * However, we don't want mousemoves to trigger re-renders (most of the time) so
 * the DragService is mostly for handling mousemoves.
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
  placeholderIndex: number | undefined
  orderedIds: string[]

  constructor(ids: string[], { onDragEnd }: DragServiceOptions) {
    this.orderedIds = ids
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
    this.orderedIds = ids
    this.maxElementIndex = ids.length - 1
  }

  /**
   * Updates the index of an item element in the element list.
   *
   * See `resetElementList` above for details.
   */
  pushElement(element: HTMLElement, index: number) {
    if (element.dataset.rhahPlaceholder) return
    if (this.elements[index] === element) return

    this.elements[index] = element
    this.maxElementIndex = Math.max(this.maxElementIndex, index)
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
    const id = element.dataset.rhahOrderableListId as string

    // FIXME: If the element changes size ever, this cache will be stale. So
    // we'll need to add ResizeObservers at some point to invalidate the cache.
    // if (this.itemRectCache[id]) return this.itemRectCache[id]

    const rect = element.getBoundingClientRect()
    this.itemRectCache[id] = rect

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
    // report back the correct placeholderIndex to the hook
    this.handleMove(event)

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

      if (this.placeholderIndex === undefined) {
        throw new Error("Got mouseUp event but placeholderIndex is undefined?")
      }

      window.removeEventListener("mousemove", this.handleMove)
      window.removeEventListener("mouseup", this.handleUp)

      console.log("moving item to", this.placeholderIndex)
      const droppedId = this.draggingId
      const index = this.placeholderIndex

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

      const before = without(this.orderedIds.slice(0, index), droppedId)
      const after = without(this.orderedIds.slice(index), droppedId)
      const newIds = [...before, droppedId, ...after]

      this.onDragEnd(newIds)
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

const getMouseMoveHandler = (
  list: DragService,
  onDragTo: (index: number) => void
) =>
  function handleMouseMove(event: Pick<MouseEvent, "clientX" | "clientY">) {
    assertDragging(list, "getMouseMoveHandler")

    const dy = event.clientY - list.downAt.y
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

    let placeholderIndex = -1

    if (direction === "down") {
      for (let i = 0; i <= list.maxElementIndex; i++) {
        const element = list.elements[i]

        if (element.dataset.rhahPlaceholder) continue

        const targetRect = list.getRect(element)

        const mightSwap = intrudesDown(dy, list.downRect, targetRect)

        // if (dy < 50 && i === 2 && mightSwap) {
        //   debugger
        // }

        intrudesDown(dy, list.downRect, targetRect)

        log &&
          console.log(
            i,
            element.innerText,
            mightSwap ? "might swap" : "too low"
          )

        if (mightSwap) {
          placeholderIndex = i + 1
        } else {
          break
        }
      }
    } else {
      for (let i = list.maxElementIndex; i >= 0; i--) {
        const element = list.elements[i]
        if (!element) {
          throw new Error(`No element at index ${i}`)
        }
        if (element.dataset.rhahPlaceholder) continue
        const targetRect = list.getRect(element)
        const mightSwap = intrudesUp(dy, list.downRect, targetRect)

        log &&
          console.log(
            i,
            element.innerText,
            mightSwap ? "might swap" : "too high"
          )

        if (mightSwap) {
          placeholderIndex = i
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

    if (list.placeholderIndex !== placeholderIndex) {
      list.placeholderIndex = placeholderIndex
      log && console.log("moving placeholder to", placeholderIndex)
      onDragTo(placeholderIndex)
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
