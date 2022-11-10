import { render, fireEvent, cleanup } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOrderableList } from "~/index"

const ITEMS = [
  {
    id: "1",
    text: "First one",
  },
  {
    id: "2",
    text: "Second one",
  },
  {
    id: "3",
    text: "Third one",
  },
]

describe("useOrderableList", () => {
  const onClick = vi.fn()

  const List = () => {
    const { getItemProps, items, isPlaceholder } = useOrderableList(ITEMS)

    return (
      <ul>
        {items.map((item) =>
          isPlaceholder(item) ? (
            <li key={item.key}>Placeholder</li>
          ) : (
            <li key={item.id} onClick={onClick} {...getItemProps(item.id)}>
              {item.text}
            </li>
          )
        )}
      </ul>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("example render without errors", () => {
    render(<List />)
  })

  it("example should show the first one first", () => {
    const { getAllByRole } = render(<List />)

    const items = getAllByRole("listitem")

    expect(items[0].innerHTML).toEqual("First one")
    expect(items).toHaveLength(3)
  })

  it("should fire a click event if we mousedown without dragging", () => {
    const { getAllByRole } = render(<List />)

    const [first] = getAllByRole("listitem")

    fireEvent.mouseEnter(first, {
      clientX: 0,
      clientY: 0,
    })

    fireEvent.mouseDown(first, {
      clientX: 10,
      clientY: 10,
    })

    fireEvent.mouseUp(first, {
      clientX: 10,
      clientY: 10,
    })

    fireEvent.click(first, {
      clientX: 10,
      clientY: 10,
    })

    expect(onClick).toHaveBeenCalledOnce()
  })

  it("should pop the element out and add a placeholder if we drag", () => {
    const { getAllByRole } = render(<List />)

    const [first] = getAllByRole("listitem")

    fireEvent.mouseDown(first, {
      clientX: 10,
      clientY: 10,
    })

    fireEvent.mouseMove(first, {
      clientX: 20,
      clientY: 20,
    })

    expect(first.style.position).toBe("absolute")

    fireEvent.mouseUp(first, {
      clientX: 20,
      clientY: 20,
    })

    expect(onClick).not.toHaveBeenCalled()

    const items = getAllByRole("listitem")

    expect(items).toHaveLength(4)
    expect(items[1].innerHTML).toEqual("Placeholder")
  })
})
