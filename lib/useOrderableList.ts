type ObjectWithId = {
  id: string
}

export const useOrderableList = <ItemType extends ObjectWithId>(
  items: ItemType[]
) => {
  const getItemProps = (id: string) => ({})

  return {
    getItemProps,
    items,
  }
}
