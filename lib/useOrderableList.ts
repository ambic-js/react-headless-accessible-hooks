import type React from "react"
import { useState, useRef, useMemo, StyleHTMLAttributes } from "react"
import short from "short-uuid"
import { assertHTMLTarget } from "~/helpers"

type ObjectWithId = {
  id: string
}

type Placeholder = {
  __typename: "Placeholder"
  // rect: PlaceholderRect
  key: string
  getProps: () => {
    style: React.CSSProperties
  }
}

const isPlaceholder = (
  item: Placeholder | ObjectWithId
): item is Placeholder => {
  return (item as Placeholder).__typename === "Placeholder"
}

class OrderableListState {
  downId: string | undefined
  downAt: { x: number; y: number } | undefined
  draggingSize: { width: number; height: number } | undefined
  draggingId: string | undefined

  setDown(id: string, event: React.MouseEvent) {
    this.downId = id
    this.downAt = { x: event.clientX, y: event.clientY }
    assertHTMLTarget(event)
    const { width, height } = event.target.getBoundingClientRect()
    this.draggingSize = { width, height }
  }

  isDrag(id: string, event: React.MouseEvent) {
    // If we didn't mouse down on a draggable element, this is definitely not a drag
    if (!this.downId || !this.downAt) return false
    // If we moused down on a different draggable element, that's weird. Not a drag.
    if (id !== this.downId) return false
    // If we came up at the same pixel we went down, also not a drag.
    if (event.clientX === this.downAt.x && event.clientY === this.downAt.y)
      return false
    // Otherwise, yes it is a drag!
    return true
  }

  // startDrag() {
  //   this.draggingId = this.downId
  // }
}

type ItemProps = Pick<
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>,
  "onMouseDown" | "onMouseUp" | "onMouseMove" | "style"
>

export const useOrderableList = <ItemType extends ObjectWithId>(
  items: ItemType[]
) => {
  const [list] = useState(() => new OrderableListState())
  const [placeholderIndex, setPlaceholderIndex] = useState(-1)
  const [draggingId, setDraggingId] = useState<string | undefined>()
  // const itemPropsCache = useRef<Record<string, ItemProps>>({})

  const itemsAndPlaceholders = useMemo(
    function insertPlaceholders() {
      const itemsToSplice = items

      if (placeholderIndex < 0 || !list.draggingSize) return items

      // if (!placeholderRect) return items

      const before = itemsToSplice.slice(0, placeholderIndex)
      const after = itemsToSplice.slice(placeholderIndex)

      const placeholder: Placeholder = {
        __typename: "Placeholder",
        key: short.generate(),
        getProps: () => ({
          style: { ...list.draggingSize },
        }),
        // rect: placeholderRect,
      }

      const newItems = [...before, placeholder, ...after]

      return newItems
    },
    [items, placeholderIndex]
  )

  const getItemProps = (id: string) => {
    // if (itemPropsCache.current[id]) return itemPropsCache[id]

    const props: ItemProps = {
      onMouseDown: (event: React.MouseEvent) => {
        list.setDown(id, event)
      },
      // onMouseUp: (event: React.MouseEvent) => {
      // },
      onMouseMove: (event: React.MouseEvent) => {
        if (!list.isDrag(id, event)) return
        startDrag(id, event)
      },
    }

    // itemPropsCache.current[id] = props

    return props
  }

  const startDrag = (id: string, event: React.MouseEvent) => {
    if (!list.downAt) return

    const draggingItemIndex = items.findIndex((item) => item.id === id)

    const dx = event.clientX - list.downAt.x
    const dy = event.clientY - list.downAt.y

    assertHTMLTarget(event)

    event.target.style.transform = `translate(${dx}px, ${dy}px)`
    event.target.style.position = "absolute"

    setPlaceholderIndex(draggingItemIndex + 1)
    // list.startDrag()
    setDraggingId(id)
  }

  return {
    getItemProps,
    items: itemsAndPlaceholders,
    isPlaceholder,
  }
}
