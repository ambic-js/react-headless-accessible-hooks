export const mockDomRect = (overrides: Partial<DOMRect>) =>
  new Proxy({} as DOMRect, {
    get(_, prop: keyof DOMRect) {
      if (prop in overrides) return overrides[prop]
      throw new Error(
        `${prop} not implemented in your mockDomRect. Try mockDomRect({ ${prop}: ... })`
      )
    },
  })
