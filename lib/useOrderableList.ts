import type React from "react"
import { useState, useMemo, useEffect } from "react"
import short from "short-uuid"
import { DragService, isPlaceholderId } from "./DragService"
import { assertHTMLTarget } from "~/helpers"

type ObjectWithId = {
  id: string
}

type Placeholder = {
  __typename: "Placeholder"
  id: string
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
  "data-rhah-orderable-list-id": string
  ref: (element: HTMLElement | null) => void
}

type UseOrderableListOptions = {
  onOrderChange?: (ids: string[]) => void
  dragOutIsAllowed?: boolean
}

/**
 * Hook which gives you some functions to make a list of elements re-orderable via drag and drop.
 */
export const useOrderableList = <ItemType extends ObjectWithId>(
  items: ItemType[],
  { onOrderChange, dragOutIsAllowed = true }: UseOrderableListOptions
) => {
  const [orderedIds, setOrder] = useState(() => items.map(({ id }) => id))

  const [service] = useState(
    () =>
      new DragService(orderedIds, {
        onDragEnd: (newOrderedIds) => {
          console.log("new order!", newOrderedIds)
          setPlaceholderIndex(-1)
          setDraggingId(undefined)
          setDownId(undefined)
          setOrder(newOrderedIds)
          onOrderChange?.(newOrderedIds)
        },
        dragOutIsAllowed,
      })
  )

  const [placeholderIndex, setPlaceholderIndex] = useState(-1)
  const [draggingId, setDraggingId] = useState<string>()
  const [downId, setDownId] = useState<string>()

  useEffect(() => {
    return () => service.destroy()
  }, [service])

  // const itemPropsCache = useRef<Record<string, ItemProps>>({})

  useEffect(() => {
    if (items.some((item) => isPlaceholderId(item.id))) {
      throw new Error(
        `Your item array has an item.id that starts with "rhah-placeholder-" which doesn't work because that's how the useOrderableList hook tells whether an id is a placeholder id`
      )
    }
  }, [items])

  const itemsAndPlaceholders = useMemo(
    function insertPlaceholders() {
      const itemsToSplice = items

      if (placeholderIndex < 0 || !service.downRect) return items

      const before = itemsToSplice.slice(0, placeholderIndex)
      const after = itemsToSplice.slice(placeholderIndex)

      const placeholder: Placeholder = {
        __typename: "Placeholder",
        id: `rhah-placeholder-${short.generate()}`,
      }

      const newItems = [...before, placeholder, ...after]

      return newItems
    },
    [items, placeholderIndex]
  )

  console.log("placeholder at", placeholderIndex)
  // It's a bit unusual to fire a mutation on every render, but in this case
  // we want to ensure the list length is correct on each render because the
  // `getItemProps` function includes a callback ref that will sync the
  // elements to the DragService on every render
  service.resetElementList(itemsAndPlaceholders.map((item) => item.id))

  const getItemProps = (elementIndex: number) => {
    const item = itemsAndPlaceholders[elementIndex]
    if (!item) {
      const maxIndex = itemsAndPlaceholders.length - 1
      throw new Error(
        `No item at index ${elementIndex}. Max index is ${maxIndex}`
      )
    }

    if (isPlaceholder(item)) {
      const rect = service.downRect
      const props: PlaceholderProps = {
        "data-rhah-orderable-list-id": item.id,
        style: {
          width: rect ? `${Math.floor(rect.width)}px` : undefined,
          height: rect ? `${Math.floor(rect.height)}px` : undefined,
        },
        ref: (element) => {
          if (!element) return
          service.pushElement(element, elementIndex)
        },
      }
      return props
    }

    // if (itemPropsCache.current[id]) return itemPropsCache[id]

    const style: React.CSSProperties =
      item.id === draggingId
        ? {
            position: "absolute",
            width: service.downRect?.width,
            height: service.downRect?.height,
            userSelect: "none",
            cursor: "grabbing",
          }
        : { userSelect: "none", cursor: "grab" }

    // if (list.isDragging) {
    //   style.pointerEvents = "none"
    // }

    const props: ItemProps = {
      onMouseMove: (event) => {
        if (service.isDragging || !downId) return
        if (!service.dragDidStartAt(item.id, event.clientX, event.clientY)) {
          return
        }
        startDrag(item.id, event)
      },
      onMouseDown: (event) => {
        setDownId(item.id)
        assertHTMLTarget(event)
        event.target.style.cursor = "grabbing"
        service.onMouseDown(event)
      },
      onMouseUp: (event) => {
        setDownId(undefined)
        setDraggingId(undefined)
        assertHTMLTarget(event)
        event.target.style.cursor = "grab"
      },
      "data-rhah-orderable-list-id": item.id,
      style,
      ref: (element) => {
        if (!element) return
        service.pushElement(element, elementIndex)
      },
    }

    // itemPropsCache.current[id] = props

    return props
  }

  const startDrag = (id: string, event: React.MouseEvent) => {
    assertHTMLTarget(event)

    setDraggingId(id)

    service.startTracking(id, event, {
      onDragTo: (index: number) => {
        setPlaceholderIndex(index)
      },
    })
  }

  const isLifted = (id: string) => {
    return id === draggingId || id === downId
  }

  return {
    getItemProps,
    items: itemsAndPlaceholders,
    isPlaceholder,
    isLifted,
  }
}
