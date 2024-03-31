type Falsy = 0 | '' | false | null | undefined

export function truthy<T>(x: T): x is Exclude<T, Falsy> {
    return !!(x as any);
}

export function falsy<T>(x: T): x is T & Falsy {
    return !(x as any);
}