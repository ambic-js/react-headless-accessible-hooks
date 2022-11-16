type HasElementTarget<T> = T & {
  target: HTMLElement
}

export function assertHTMLTarget<T>(
  event: T & {
    target: unknown
  }
): asserts event is HasElementTarget<T> {
  if (!(event.target instanceof HTMLElement)) {
    throw new Error(
      "What kind of MouseEvent doesn't have an HTMLElement for a target?"
    )
  }
}

export const moveItemTo = <T>(
  array: T[],
  doesMatch: (item: T) => boolean,
  toIndex: number
) => {
  const fromIndex = array.findIndex(doesMatch)
  const item = array[fromIndex]
  let out
  if (toIndex > fromIndex) {
    out = [
      ...array.slice(0, fromIndex),
      ...array.slice(fromIndex + 1, toIndex + 1),
      item,
      ...array.slice(toIndex + 1),
    ]
  } else {
    out = [
      ...array.slice(0, toIndex),
      item,
      ...array.slice(toIndex, fromIndex),
      ...array.slice(fromIndex + 1),
    ]
  }
  return out
}

// const list = [1, 2, 3, 4]
// // move earlier
// console.log(
//   1,
//   moveItemTo(list, (n) => n === 2, 0)
// )
// // move to the end
// console.log(
//   2,
//   moveItemTo(list, (n) => n === 2, 3)
// )
// // keep at same position
// console.log(
//   3,
//   moveItemTo(list, (n) => n === 3, 2)
// )
// // move from beginning
// console.log(
//   4,
//   moveItemTo(list, (n) => n === 1, 1)
// )
// // move from end to beginning
// console.log(
//   5,
//   moveItemTo(list, (n) => n === 4, 0)
// )
// // move from middle to beginning
// console.log(
//   6,
//   moveItemTo(list, (n) => n === 3, 0)
// )
