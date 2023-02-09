import {
  Timestamp,
  FieldValue,
} from "firebase/firestore";


type PathImpl<T, K extends keyof T> =
K extends string
? T[K] extends Date  
? K 
: T[K] extends Timestamp
? K
: T[K] extends FieldValue
? K
: T[K] extends Record<string, any>
? T[K] extends ArrayLike<any>
? K | `${K}.${PathImpl<T[K], Exclude<keyof T[K], keyof any[]>>}`
: K | `${K}.${PathImpl<T[K], keyof T[K]>}`
: K
: never

type Path<T> = PathImpl<T, keyof T> | keyof T

type PathValue<T, P extends Path<T>> =
P extends `${infer K}.${infer Rest}`
? K extends keyof T
? Rest extends Path<T[K]>
? PathValue<T[K], Rest>
: never
: never
: P extends keyof T
? T[P]
: never

export type UpdateData<T extends object> = Partial<{
[TKey in Path<T>]: PathValue<T, TKey>
}>