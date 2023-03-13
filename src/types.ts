import { Timestamp, FieldValue } from "firebase/firestore";

type StringLiteral<T> = T extends string
  ? string extends T
    ? never
    : T
  : never;

type PathImplForString<T, K extends keyof T> = K extends string
  ? T[K] extends Date
    ? K
    : T[K] extends Timestamp
    ? K
    : T[K] extends FieldValue
    ? K
    : T[K] extends Record<string, any> | undefined
    ? T[K] extends ArrayLike<any> | undefined
      ? StringLiteral<K> extends never
        ? `${K}.${PathImplForString<
            Required<T[K]>,
            Exclude<keyof Required<T[K]>, keyof any[]>
          >}`
        :
            | K
            | `${K}.${PathImplForString<
                Required<T[K]>,
                Exclude<keyof Required<T[K]>, keyof any[]>
              >}`
      : StringLiteral<K> extends never
      ? `${K}.${PathImplForString<Required<T[K]>, keyof Required<T[K]>>}`
      : K | `${K}.${PathImplForString<Required<T[K]>, keyof Required<T[K]>>}`
    : K
  : never;

type PathImplForStringLiteral<T, K extends keyof T> = K extends string
  ? T[K] extends Date
    ? K
    : T[K] extends Timestamp
    ? K
    : T[K] extends FieldValue
    ? K
    : T[K] extends Record<string, any>
    ? T[K] extends ArrayLike<any>
      ?
          | K
          | `${K}.${PathImplForStringLiteral<
              Required<T[K]>,
              Exclude<keyof Required<T[K]>, keyof any[]>
            >}`
      :
          | K
          | `${K}.${PathImplForStringLiteral<
              Required<T[K]>,
              keyof Required<T[K]>
            >}`
    : K
  : never;

type IsHaveStringImpl<T, K extends keyof T> = K extends string
  ? StringLiteral<K> extends never
    ? true
    : T[K] extends Date
    ? never
    : T[K] extends Timestamp
    ? never
    : T[K] extends FieldValue
    ? never
    : T[K] extends Record<string, any>
    ? T[K] extends ArrayLike<any>
      ? StringLiteral<K> extends never
        ? true
        : IsHaveStringImpl<
            Required<T[K]>,
            Exclude<keyof Required<T[K]>, keyof any[]>
          >
      : StringLiteral<K> extends never
      ? true
      : IsHaveStringImpl<Required<T[K]>, keyof Required<T[K]>>
    : never
  : never;

export type IsHaveString<T> = IsHaveStringImpl<Required<T>, keyof Required<T>>;

type PathForString<T> =
  | PathImplForString<Required<T>, keyof Required<T>>
  | (StringLiteral<keyof Required<T>> extends never
      ? never
      : keyof Required<T>);

type PathForStringLiteral<T> =
  | PathImplForStringLiteral<Required<T>, keyof Required<T>>
  | (StringLiteral<keyof Required<T>> extends never
      ? never
      : keyof Required<T>);

type PathValueForStringLiteral<
  T,
  P extends PathForStringLiteral<T>
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends PathForStringLiteral<Required<T[K]>>
      ? PathValueForStringLiteral<Required<T[K]>, Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;

type PathValueForString<
  T,
  P extends PathForString<T>
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends PathForString<Required<T[K]>>
      ? PathValueForString<Required<T[K]>, Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;

export type UpdateStringData<T extends object> = Partial<{
  [TKey in PathForString<Required<T>>]: PathValueForString<Required<T>, TKey>;
}>;

export type UpdateStringLiteralData<T extends object> = Partial<{
  [TKey in PathForStringLiteral<Required<T>>]: PathValueForStringLiteral<
    Required<T>,
    TKey
  >;
}>;

export type UpdateData<T extends object> = IsHaveString<T> extends never
  ? UpdateStringLiteralData<T>
  : UpdateStringLiteralData<T> | UpdateStringData<T>;
