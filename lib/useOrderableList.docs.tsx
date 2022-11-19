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
  border: "1px solid #ddd",
  boxSizing: "border-box",
  paddingTop: 4,
  paddingBottom: 4,
  paddingLeft: 8,
  paddingRight: 8,
  marginBottom: 8,
  transitionTimingFunction: "linear",
  transitionDuration: "24ms",

  variants: {
    isLifted: {
      "true": {
        zIndex: 2,
        transform: "translate(-2px, -4px) rotate(0.15deg)",
        boxShadow: "1px 4px 2px 1px rgba(0,0,0,0.05)",
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
          handle: "@pavelasamsonov",
        },
      ]

      type FollowingProps = {
        users: { id: string; handle: string }[]
      }

      const Following = ({ users: initialUsers }: FollowingProps) => {
        const [users, setUsers] = useState(initialUsers)

        const { items, isPlaceholder, getItemProps, isLifted } =
          useOrderableList(users, {
            onOrderChange: (sortedIds) => {
              const sortedUsers = sortBy(initialUsers, (user) =>
                sortedIds.indexOf(user.id)
              )
              setUsers(sortedUsers)
            },
            dragOutIsAllowed: true,
          })

        return (
          <>
            {items.map((item, index) =>
              isPlaceholder(item) ? (
                <Placeholder
                  key={item.id}
                  {...getItemProps(index)}
                ></Placeholder>
              ) : (
                <Card
                  key={item.id}
                  {...getItemProps(index)}
                  isLifted={isLifted(item.id)}
                >
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
