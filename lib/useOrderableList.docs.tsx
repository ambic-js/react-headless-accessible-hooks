import { styled } from "@stitches/react"
import { Doc, Demo } from "codedocs"
import sortBy from "lodash/sortBy"
import { useState } from "react"
import { useOrderableList } from "./useOrderableList"

export default (
  <Doc path="/Docs/useOrderableList">
    Useful for items that you want the user to put in order.
  </Doc>
)

const Placeholder = styled("div", {
  borderRadius: 6,
  backgroundColor: "#eee",
  marginBottom: 8,
})

const Card = styled("div", {
  borderRadius: 6,
  backgroundColor: "white",
  boxShadow: "0px 1px 5px 0px rgba(0,0,0,0.1)",
  border: "1px solid #ddd",
  boxSizing: "border-box",
  paddingTop: 4,
  paddingBottom: 4,
  paddingLeft: 8,
  paddingRight: 8,
  marginBottom: 8,
  cursor: "grab",

  variants: {
    isDragging: {
      "true": {
        zIndex: 2,
      },
    },
  },
})

export const Basic = (
  <Demo
    generate={() => {
      const USERS = [
        {
          id: "1",
          handle: "@yvonnezlam",
        },
        {
          id: "2",
          handle: "@rsms",
        },
        {
          id: "3",
          handle: "@PavelASamsonov",
        },
      ]

      type FollowingProps = {
        users: { id: string; handle: string }[]
      }

      const Following = ({ users: initialUsers }: FollowingProps) => {
        const [users, setUsers] = useState(initialUsers)

        const { items, isPlaceholder, getItemProps, isDragging } =
          useOrderableList(users, {
            onOrderChange: (sortedIds) => {
              const sortedUsers = sortBy(initialUsers, (user) =>
                sortedIds.indexOf(user.id)
              )
              setUsers(sortedUsers)
            },
          })

        return (
          <>
            {items.map((item, index) =>
              isPlaceholder(item) ? (
                <Placeholder {...getItemProps(index)}></Placeholder>
              ) : (
                <Card {...getItemProps(index)} isDragging={isDragging(item.id)}>
                  {item.handle}
                </Card>
              )
            )}
          </>
        )
      }

      return <Following users={USERS} />
    }}
  />
)
