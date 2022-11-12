import { assertHTMLTarget } from "~/helpers"

type Point = { x: number; y: number }

export class DragService {
  downId: string | undefined
  downAt: Point | undefined
  lastPoint: Point | undefined
  isDragging = false
  draggingId: string | undefined
  downElement: HTMLElement | undefined
  downRect: DOMRect | undefined
  itemRectCache: Record<string, DOMRect> = {}
  elements: HTMLElement[] = []
  maxElementIndex = 0

  onMouseDown(event: React.MouseEvent) {
    this.downAt = this.lastPoint = { x: event.clientX, y: event.clientY }
    assertHTMLTarget(event)
    this.downElement = event.target
    this.downId = event.target.dataset.rhahOrderableListId
    this.downRect = event.target.getBoundingClientRect()
  }

  resetElementList(length: number) {
    console.log("resetting to length", length)
    this.maxElementIndex = length - 1
  }

  pushElement(element: HTMLElement, index: number) {
    if (this.elements[index] === element) {
      console.log("element already present 👍")
    } else {
      console.log(
        "setting",
        index,
        "=",
        element.dataset.rhahPlaceholder
          ? "[placeholder]"
          : element.dataset.rhahOrderableListId
      )
      this.elements[index] = element
      this.maxElementIndex = Math.max(this.maxElementIndex, index)
    }
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

    if (this.itemRectCache[id]) return this.itemRectCache[id]

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

  trackDrag(setPlaceholderIndex: (index: number) => void) {
    this.isDragging = true
    console.log("listen")
    assertDragging(this, "trackDrag")

    const handleMove = getMouseMoveHandler(this, setPlaceholderIndex)

    const handleUp = () => {
      console.log("up!")
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)

      this.downId = undefined
      this.downAt = undefined
      this.lastPoint = undefined
      this.isDragging = false
      this.draggingId = undefined
      this.downElement = undefined
      this.downRect = undefined
    }

    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
  }
}

const getMouseMoveHandler =
  (list: DragService, setPlaceholderIndex: (index: number) => void) =>
  (event: MouseEvent) => {
    console.log("window mouse move handler")
    assertDragging(list, "getMouseMoveHandler")

    const dy = event.clientY - list.downAt.y

    const position = list.getDragElementPosition(event)

    list.downElement.style.top = position.top
    list.downElement.style.left = position.left

    const direction = event.clientY - list.lastPoint.y > 0 ? "down" : "up"
    console.log("moving", direction)
    list.lastPoint = { x: event.clientY, y: event.clientY }

    let swappableElementIndex = -1

    if (direction === "down") {
      for (let i = 0; i <= list.maxElementIndex; i++) {
        const element = list.elements[i]
        if (element.dataset.rhahPlaceholder) continue
        const targetRect = list.getRect(element)

        // if (i > 1 && intrudesDown(dy, list.downRect, targetRect)) {
        //   debugger
        // }

        const mightSwap = intrudesDown(
          dy,
          list.getRect(list.downElement),
          targetRect
        )

        if (mightSwap) {
          swappableElementIndex = i
        } else {
          break
        }
      }
    } else {
      for (let i = list.maxElementIndex; i >= 0; i--) {
        const element = list.elements[i]
        if (element.dataset.rhahPlaceholder) continue
        const targetRect = list.getRect(element)
        const mightSwap = intrudesUp(dy, list.downRect, targetRect)

        if (mightSwap) {
          swappableElementIndex = i
        } else {
          break
        }
      }
    }

    console.log("setting placeholderIndex in list to", swappableElementIndex)
    setPlaceholderIndex(swappableElementIndex)
  }

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
