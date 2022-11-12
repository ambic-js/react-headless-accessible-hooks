import type React from "react"
import { useState, useMemo } from "react"
import short from "short-uuid"
import { DragService } from "./DragService"
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
  const [service] = useState(() => new DragService())
  const [placeholderIndex, setPlaceholderIndex] = useState(-1)
  const [draggingId, setDraggingId] = useState<string | undefined>()
  // const itemPropsCache = useRef<Record<string, ItemProps>>({})

  const itemsAndPlaceholders = useMemo(
    function insertPlaceholders() {
      console.log("memoizing items")
      const itemsToSplice = items

      if (placeholderIndex < 0 || !service.downRect) return items

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

  service.resetElementList(itemsAndPlaceholders.length)

  console.log({ placeholderIndex, items: itemsAndPlaceholders.length })

  const getItemProps = (index: number) => {
    const item = itemsAndPlaceholders[index]
    if (!item) {
      throw new Error(`No item at index ${index}. Max index is ${items.length}`)
    }

    if (isPlaceholder(item)) {
      const props: PlaceholderProps = {
        "data-rhah-placeholder": "true",
        style: {
          width: service.downRect?.width,
          height: service.downRect?.height,
        },
        ref: (element) => {
          if (!element) return
          service.pushElement(element, index)
        },
      }
      return props
    }

    // if (itemPropsCache.current[id]) return itemPropsCache[id]

    const style: React.CSSProperties =
      item.id === draggingId
        ? { width: service.downRect?.width, height: service.downRect?.height }
        : {}

    // if (list.isDragging) {
    //   style.pointerEvents = "none"
    // }

    const props: ItemProps = {
      onMouseMove: (event) => {
        if (service.isDragging) return
        if (!service.dragDidStartAt(item.id, event.clientX, event.clientY))
          return
        console.log("element mouse move handler")
        startDrag(item.id, event)
        // event.preventDefault()
      },
      onMouseDown: (event) => {
        service.onMouseDown(event)
      },
      "data-rhah-orderable-list-id": item.id,
      style,
      ref: (element) => {
        if (!element) return
        service.pushElement(element, index)
      },
    }

    // itemPropsCache.current[id] = props

    return props
  }

  const startDrag = (id: string, event: React.MouseEvent) => {
    console.log("startDrag", service.downAt)

    if (!service.downAt || !service.downRect) {
      throw new Error("Can't start drag because we don't know down position")
    }

    assertHTMLTarget(event)

    const draggingItemIndex = items.findIndex((item) => item.id === id)

    setPlaceholderIndex(draggingItemIndex)
    console.log("set setPlaceholderIndex to", draggingItemIndex)
    setDraggingId(id)
    service.trackDrag(setPlaceholderIndex)

    const position = service.getDragElementPosition(event)

    event.target.style.position = "absolute"
    event.target.style.top = position.top
    event.target.style.left = position.left
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
