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
  draggingSize: { width: number; height: number } | undefined
  draggingId: string | undefined
  downElement: HTMLElement | undefined
  itemRectCache: Record<string, DOMRect> = {}
  elements: HTMLElement[] = []
  maxElementIndex = 0

  onMouseDown(event: React.MouseEvent) {
    this.downAt = this.lastPoint = { x: event.clientX, y: event.clientY }
    assertHTMLTarget(event)
    this.downElement = event.target
    this.downId = event.target.dataset.rhahOrderableListId
    const { width, height } = event.target.getBoundingClientRect()
    this.draggingSize = { width, height }
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

    window.addEventListener("mousemove", (event) => {
      console.log("window mouse move handler")
      assertDragging(this)

      const dy = event.clientY - this.downAt.y
      const direction = event.clientY - this.lastPoint.y > 0 ? "down" : "up"

      this.lastPoint = { x: event.clientY, y: event.clientY }

      let swappableElementIndex = -1

      if (direction === "down") {
        for (let i = 0; i <= this.maxElementIndex; i++) {
          const element = this.elements[i]
          if (element.dataset.rhahPlaceholder) continue
          const targetRect = this.getRect(element)
          const mightSwap = intrudesDown(
            dy,
            this.getRect(this.downElement),
            targetRect
          )

          if (mightSwap) {
            swappableElementIndex = i
          } else {
            break
          }
        }
      } else {
        for (let i = this.maxElementIndex; i >= 0; i--) {
          const element = this.elements[i]
          if (element.dataset.rhahPlaceholder) continue
          const targetRect = this.getRect(element)
          const mightSwap = intrudesUp(
            dy,
            this.getRect(this.downElement),
            targetRect
          )

          if (mightSwap) {
            swappableElementIndex = i
          } else {
            break
          }
        }
      }

      console.log("setting placeholderIndex in list to", swappableElementIndex)
      setPlaceholderIndex(swappableElementIndex)
    })
  }
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

type DraggingOrderableListState = OrderableListState & {
  downAt: Exclude<OrderableListState["downAt"], undefined>
  lastPoint: Exclude<OrderableListState["lastPoint"], undefined>
  downElement: Exclude<OrderableListState["downElement"], undefined>
}

function assertDragging(
  list: OrderableListState
): asserts list is DraggingOrderableListState {
  if (
    !list.downAt ||
    !list.lastPoint ||
    !list.downElement ||
    !list.draggingSize ||
    !list.isDragging
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
      console.log("memoizing items", list.draggingSize)
      const itemsToSplice = items

      if (placeholderIndex < 0 || !list.draggingSize) return items

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
        style: { ...list.draggingSize },
        ref: (element) => {
          if (!element) return
          list.pushElement(element, index)
        },
      }
      return props
    }

    // if (itemPropsCache.current[id]) return itemPropsCache[id]

    const style: React.CSSProperties =
      item.id === draggingId ? { ...list.draggingSize } : {}

    // if (list.isDragging) {
    //   style.pointerEvents = "none"
    // }

    const props: ItemProps = {
      onMouseMove: (event) => {
        console.log("element mouse move handler")
        if (list.isDragging) return
        if (!list.dragDidStartAt(item.id, event.clientX, event.clientY)) return
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

    if (!list.downAt) {
      throw new Error("Can't start drag because we don't know down position")
    }

    const draggingItemIndex = items.findIndex((item) => item.id === id)

    const dx = event.clientX - list.downAt.x
    const dy = event.clientY - list.downAt.y

    assertHTMLTarget(event)

    event.target.style.transform = `translate(${dx}px, ${dy}px)`
    event.target.style.position = "absolute"

    setPlaceholderIndex(draggingItemIndex)
    console.log("set setPlaceholderIndex to", draggingItemIndex)
    setDraggingId(id)
    list.listen(setPlaceholderIndex)
  }

  return {
    getItemProps,
    items: itemsAndPlaceholders,
    isPlaceholder,
  }
}
