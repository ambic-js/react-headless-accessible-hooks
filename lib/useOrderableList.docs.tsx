import { Doc, Demo } from "codedocs"
import { useState } from "react"
import { useOrderableList } from "./useOrderableList"

export default (
  <Doc path="/Docs/useOrderableList">
    Useful for items that you want the user to put in order.
  </Doc>
)

export const Basic = (
  <Demo
    render={() => {
      const [_items] = useState([
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
      ])

      const { items, isPlaceholder, getItemProps } = useOrderableList(_items)

      return items.map((item) =>
        isPlaceholder(item) ? (
          <div key={item.key}>Placeholder</div>
        ) : (
          <div key={item.id} {...getItemProps(item.id)}>
            {item.text}
          </div>
        )
      )
    }}
  />
)
