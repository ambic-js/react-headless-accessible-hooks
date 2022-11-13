import type React from "react"
import { useState, useMemo, useEffect } from "react"
import short from "short-uuid"
import { DragService } from "./DragService"
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
  "data-rhah-placeholder": "true"
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

  // It's a bit unusual to fire a mutation on every render, but in this case
  // we want to ensure the list length is correct on each render because the
  // `getItemProps` function includes a callback ref that will sync the
  // elements to the DragService on every render
  /// this would move down below so it could use itemsAndPlaceholders?
  service.resetElementList(orderedIds)

  const [placeholderIndex, setPlaceholderIndex] = useState(-1)
  const [draggingId, setDraggingId] = useState<string | undefined>()

  useEffect(() => {
    return () => service.destroy()
  }, [service])

  // const itemPropsCache = useRef<Record<string, ItemProps>>({})

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

  const getItemProps = (index: number) => {
    const item = itemsAndPlaceholders[index]
    if (!item) {
      throw new Error(`No item at index ${index}. Max index is ${items.length}`)
    }

    if (isPlaceholder(item)) {
      const props: PlaceholderProps = {
        "data-rhah-placeholder": "true", /// delete
        /// add rhahOrderableListId so the rect can be cached if we ever uncomment that
        style: {
          width: service.downRect?.width,
          height: service.downRect?.height,
        },
        /// need to push an id from a callback ref here
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

    /// this would have to be just the index?
    const indexIgnoringPlaceholders = itemsAndPlaceholders
      .slice(0, index)
      .filter((item) => !isPlaceholder(item)).length

    const props: ItemProps = {
      onMouseMove: (event) => {
        if (service.isDragging) return
        if (!service.dragDidStartAt(item.id, event.clientX, event.clientY)) {
          return
        }
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
        service.pushElement(element, indexIgnoringPlaceholders)
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
