import { render } from "@testing-library/react"
import React from "react"
import { describe, expect, it } from "vitest"
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

const List = () => {
  const { getItemProps, items } = useOrderableList(ITEMS)

  return (
    <ul>
      {items.map(({ id, text }) => (
        <li key={id} {...getItemProps(id)}>
          {text}
        </li>
      ))}
    </ul>
  )
}

describe("MyComponent", () => {
  it("should render without errors", () => {
    render(<List />)
  })

  it("should show the first one first", () => {
    const { getAllByRole } = render(<List />)

    const items = getAllByRole("listitem")

    expect(items[0].innerHTML).toEqual("First one")
  })
})
