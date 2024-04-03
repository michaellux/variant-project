type Falsy = 0 | '' | false | null | undefined

export function truthy<T> (x: T): x is Exclude<T, Falsy> {
  return x !== false && x !== 0 && x !== '' && x !== null && x !== undefined
}

export function falsy<T> (x: T): x is T & Falsy {
  return x === false || x === 0 || x === '' || x === null || x === undefined
}
