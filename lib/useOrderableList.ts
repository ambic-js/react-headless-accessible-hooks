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
}

/**
 * Hook which gives you some functions to make a list of elements re-orderable via drag and drop.
 */
export const useOrderableList = <ItemType extends ObjectWithId>(
  items: ItemType[],
  { onOrderChange }: UseOrderableListOptions
) => {
  const [orderedIds, setOrder] = useState(() => items.map(({ id }) => id))

  const [service] = useState(
    () =>
      new DragService(orderedIds, {
        onDragEnd: (newOrderedIds) => {
          setPlaceholderIndex(-1)
          setDraggingId(undefined)
          setOrder(newOrderedIds)
          onOrderChange?.(newOrderedIds)
        },
      })
  )

  const [placeholderIndex, setPlaceholderIndex] = useState(-1)
  const [draggingId, setDraggingId] = useState<string | undefined>()

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
      console.log(props)
      return props
    }

    // if (itemPropsCache.current[id]) return itemPropsCache[id]

    const style: React.CSSProperties =
      item.id === draggingId
        ? {
            width: service.downRect?.width,
            height: service.downRect?.height,
            userSelect: "none",
          }
        : { userSelect: "none" }

    // if (list.isDragging) {
    //   style.pointerEvents = "none"
    // }

    const props: ItemProps = {
      onMouseMove: (event) => {
        if (service.isDragging) return
        if (!service.dragDidStartAt(item.id, event.clientX, event.clientY)) {
          return
        }
        startDrag(item.id, event)
      },
      onMouseDown: (event) => {
        service.onMouseDown(event)
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
        console.log("setting placeholder to", index)
        setPlaceholderIndex(index)
      },
    })
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
