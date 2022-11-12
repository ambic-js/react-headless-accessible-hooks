import type React from "react"
import { useState, useMemo } from "react"
import short from "short-uuid"
import { assertHTMLTarget } from "~/helpers"

type ObjectWithId = {
  id: string
}

type Placeholder = {
  __typename: "Placeholder"
  key: string
}

const isPlaceholder = (
  item: Placeholder | ObjectWithId
): item is Placeholder => {
  return (item as Placeholder).__typename === "Placeholder"
}

type Point = { x: number; y: number }

class OrderableListState {
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

  listen(setPlaceholderIndex: (index: number) => void) {
    this.isDragging = true
    console.log("listen")
    assertDragging(this)

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
  (list: OrderableListState, setPlaceholderIndex: (index: number) => void) =>
  (event: MouseEvent) => {
    console.log("window mouse move handler")
    assertDragging(list)

    const dy = event.clientY - list.downAt.y

    const position = getDragElementPosition(list.downRect, list.downAt, event)

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

const getDragElementPosition = (
  downRect: DOMRect,
  downAt: Point,
  event: Pick<MouseEvent, "clientX" | "clientY">
) => {
  const top = `${downRect.top + event.clientY - downAt.y}px`
  const left = `${downRect.left + event.clientX - downAt.x}px`

  console.log({
    top,
    left,
    downTop: downRect.top,
    downLeft: downRect.left,
    downAtLeft: downAt.x,
    downAtTop: downAt.y,
  })

  return {
    top,
    left,
  }
}

type DraggingOrderableListState = OrderableListState & {
  downAt: Exclude<OrderableListState["downAt"], undefined>
  downElement: Exclude<OrderableListState["downElement"], undefined>
  downRect: Exclude<OrderableListState["downRect"], undefined>
  isDragging: true
  lastPoint: Exclude<OrderableListState["lastPoint"], undefined>
}

function assertDragging(
  list: OrderableListState
): asserts list is DraggingOrderableListState {
  if (
    !list.downAt ||
    !list.downElement ||
    !list.downRect ||
    !list.isDragging ||
    !list.lastPoint
  ) {
    throw new Error("Expected OrderableListState to be in dragging state")
  }
}

type ItemProps = Pick<
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>,
  "onMouseDown" | "onMouseUp" | "onMouseMove" | "style"
> & {
  "data-rhah-orderable-list-id": string
  ref: (element: HTMLElement | null) => void
}

type PlaceholderProps = Pick<
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>,
  "style"
> & {
  "data-rhah-placeholder": "true"
  ref: (element: HTMLElement | null) => void
}

export const useOrderableList = <ItemType extends ObjectWithId>(
  items: ItemType[]
) => {
  const [list] = useState(() => new OrderableListState())
  const [placeholderIndex, setPlaceholderIndex] = useState(-1)
  const [draggingId, setDraggingId] = useState<string | undefined>()
  // const itemPropsCache = useRef<Record<string, ItemProps>>({})

  const itemsAndPlaceholders = useMemo(
    function insertPlaceholders() {
      console.log("memoizing items")
      const itemsToSplice = items

      if (placeholderIndex < 0 || !list.downRect) return items

      // if (!placeholderRect) return items

      const before = itemsToSplice.slice(0, placeholderIndex)
      const after = itemsToSplice.slice(placeholderIndex)

      const placeholder: Placeholder = {
        __typename: "Placeholder",
        key: short.generate(),
        // rect: placeholderRect,
      }

      const newItems = [...before, placeholder, ...after]

      return newItems
    },
    [items, placeholderIndex]
  )

  list.resetElementList(itemsAndPlaceholders.length)

  console.log({ placeholderIndex, items: itemsAndPlaceholders.length })

  const getItemProps = (index: number) => {
    const item = itemsAndPlaceholders[index]
    if (!item) {
      throw new Error(`No item at index ${index}. Max index is ${items.length}`)
    }

    if (isPlaceholder(item)) {
      const props: PlaceholderProps = {
        "data-rhah-placeholder": "true",
        style: { width: list.downRect?.width, height: list.downRect?.height },
        ref: (element) => {
          if (!element) return
          list.pushElement(element, index)
        },
      }
      return props
    }

    // if (itemPropsCache.current[id]) return itemPropsCache[id]

    const style: React.CSSProperties =
      item.id === draggingId
        ? { width: list.downRect?.width, height: list.downRect?.height }
        : {}

    // if (list.isDragging) {
    //   style.pointerEvents = "none"
    // }

    const props: ItemProps = {
      onMouseMove: (event) => {
        if (list.isDragging) return
        if (!list.dragDidStartAt(item.id, event.clientX, event.clientY)) return
        console.log("element mouse move handler")
        startDrag(item.id, event)
        // event.preventDefault()
      },
      onMouseDown: (event) => {
        list.onMouseDown(event)
      },
      "data-rhah-orderable-list-id": item.id,
      style,
      ref: (element) => {
        if (!element) return
        list.pushElement(element, index)
      },
    }

    // itemPropsCache.current[id] = props

    return props
  }

  const startDrag = (id: string, event: React.MouseEvent) => {
    console.log("startDrag", list.downAt)

    if (!list.downAt || !list.downRect) {
      throw new Error("Can't start drag because we don't know down position")
    }

    assertHTMLTarget(event)

    const position = getDragElementPosition(list.downRect, list.downAt, event)

    event.target.style.position = "absolute"
    event.target.style.top = position.top
    event.target.style.left = position.left

    const draggingItemIndex = items.findIndex((item) => item.id === id)

    setPlaceholderIndex(draggingItemIndex)
    console.log("set setPlaceholderIndex to", draggingItemIndex)
    setDraggingId(id)
    list.listen(setPlaceholderIndex)
  }

  const isDragging = (id: string) => {
    return id === draggingId
  }

  return {
    getItemProps,
    items: itemsAndPlaceholders,
    isPlaceholder,
    isDragging,
  }
}
