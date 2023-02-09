import { z } from "zod";
import {
  Timestamp,
  FieldValue,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  deleteField
} from "firebase/firestore";
import type { UpdateData } from "./types";
import { flatten, unflatten } from "./flat";

// Custom Zod Implementation for FieldValue
const FirebaseArrayUnionFieldValue = z.custom<FieldValue>(
  (data: any) => {
    return data._methodName === "arrayUnion" && data instanceof FieldValue;
  },
  {
    message: "FieldValue must be arrayUnion"
  }
);

const FirebaseArrayRemoveFieldValue = z.custom<FieldValue>(
  (data: any) => {
    return data._methodName === "arrayRemove" && data instanceof FieldValue;
  },
  {
    message: "FieldValue must be arrayRemove"
  }
);

const FirebaseDeleteFieldFieldValue = z.custom<FieldValue>(
  (data: any) => {
    return data._methodName === "deleteField" && data instanceof FieldValue;
  },
  {
    message: "FieldValue must be deleteField"
  }
);

const FirebaseIncrementFieldValue = z.custom<FieldValue>(
  (data: any) => {
    return data._methodName === "increment" && data instanceof FieldValue;
  },
  {
    message: "FieldValue must be increment"
  }
);

const FirebaseServerTimestampFieldValue = z.custom<FieldValue>(
  (data: any) => {
    return data._methodName === "serverTimestamp" && data instanceof FieldValue;
  },
  {
    message: "FieldValue must be serverTimestamp"
  }
);

interface ZodFirestoreOptions<SET extends boolean, UPDATE extends boolean> {
  set?: SET;
  update?: UPDATE;
}

function zodFirestoreArray<
  T,
  SET extends boolean = false,
  UPDATE extends boolean = false
>(arraySchema: z.ZodType<T>, opts: ZodFirestoreOptions<SET, UPDATE> = {}) {
  const setSchema = z.array(arraySchema);

  const updateSchema = z.union([
    FirebaseArrayUnionFieldValue,
    FirebaseArrayRemoveFieldValue,
    FirebaseDeleteFieldFieldValue,
    z.array(arraySchema)
  ]);

  const getSchema = z.array(arraySchema);

  type RETURN = SET extends true
    ? typeof setSchema
    : UPDATE extends true
    ? typeof updateSchema
    : typeof getSchema;

  return (opts?.set
    ? setSchema
    : opts?.update
    ? updateSchema
    : getSchema) as RETURN;
}

function zodFirestoreTimestamp<
  SET extends boolean = false,
  UPDATE extends boolean = false
>(opts: ZodFirestoreOptions<SET, UPDATE> = {}) {
  const setSchema = z.union([z.instanceof(Timestamp), z.date()]);

  const updateSchema = z.union([
    z.instanceof(Timestamp),
    FirebaseDeleteFieldFieldValue,
    z.date()
  ]);

  const getSchema = z.instanceof(Timestamp).transform((value) => {
    return value.toDate();
  });

  type RETURN = SET extends true
    ? typeof setSchema
    : UPDATE extends true
    ? typeof updateSchema
    : typeof getSchema;

  return (opts?.set
    ? setSchema
    : opts?.update
    ? updateSchema
    : getSchema) as RETURN;
}

function zodFirestoreServerTimestamp<
  SET extends boolean = false,
  UPDATE extends boolean = false
>(opts: ZodFirestoreOptions<SET, UPDATE> = {}) {
  const setSchema = FirebaseServerTimestampFieldValue;

  const updateSchema = z.union([
    FirebaseServerTimestampFieldValue,
    FirebaseDeleteFieldFieldValue
  ]);

  const getSchema = z.instanceof(Timestamp).transform((value) => {
    return value.toDate();
  });

  type RETURN = SET extends true
    ? typeof setSchema
    : UPDATE extends true
    ? typeof updateSchema
    : typeof getSchema;

  return (opts?.set
    ? setSchema
    : opts?.update
    ? updateSchema
    : getSchema) as RETURN;
}

function zodFirestoreNumber<
  SET extends boolean = false,
  UPDATE extends boolean = false
>(opts: ZodFirestoreOptions<SET, UPDATE> = {}) {
  const setSchema = z.number();

  const updateSchema = z.union([
    FirebaseIncrementFieldValue,
    FirebaseDeleteFieldFieldValue,
    z.number()
  ]);

  const getSchema = z.number();

  type RETURN = SET extends true
    ? typeof setSchema
    : UPDATE extends true
    ? typeof updateSchema
    : typeof getSchema;

  return (opts?.set
    ? setSchema
    : opts?.update
    ? updateSchema
    : getSchema) as RETURN;
}

function zodFirestoreObject<
  T extends z.ZodRawShape,
  SET extends boolean = false,
  UPDATE extends boolean = false
>(objectSchema: T, opts: ZodFirestoreOptions<SET, UPDATE> = {}) {
  const setSchema = z.object(objectSchema);

  const updateSchema = z.preprocess(
    (val: any) => {
      console.log("before preprocess", val);
      const newObj = unflatten(val, {
        object: true,
        safe: true,
        ingnore: (value) => {
          if (value instanceof FieldValue || value instanceof Timestamp) {
            return true;
          }
          return false;
        }
      });
      console.log("after preprocess", newObj);
      return newObj;
    },
    z
      .object(objectSchema)
      .deepPartial()
      .transform((val) => {
        console.log("afterParse", val);
        const newObj = flatten(val, {
          safe: true,
          ingnore: (value) => {
            if (value instanceof FieldValue || value instanceof Timestamp) {
              return true;
            }
            return false;
          }
        });
        console.log("afterTransform", newObj);
        return newObj;
      })
  );

  const getSchema = z.object(objectSchema);

  type SetSchemaInputType = z.input<typeof setSchema>;

  type RETURN = SET extends true
    ? typeof setSchema
    : UPDATE extends true
    ? z.ZodType<UpdateData<SetSchemaInputType>>
    : typeof getSchema;

  return (opts?.set
    ? setSchema
    : opts?.update
    ? updateSchema
    : getSchema) as RETURN;
}


function zodFireStoreSchemaCreater(){
  
}

function TestSchema<
  SET extends boolean = false,
  UPDATE extends boolean = false
>(opts: ZodFirestoreOptions<SET, UPDATE> = {}) {
  return zodFirestoreObject(
    {
      _createdTs: zodFirestoreTimestamp(opts),
      _serverCreatedTs: zodFirestoreServerTimestamp(opts),
      count: zodFirestoreNumber(opts),
      arr: zodFirestoreArray(z.string(), opts),
      one: z.object({
        "0": z.object({
          "0": z.string(),
          "1": zodFirestoreNumber(opts)
        }),
        five: zodFirestoreArray(
          z.object({
            iii: z.object({
              www: z.string()
            })
          }),
          opts
        )
      })
    },
    opts
  );
}

const TestSetSchema = TestSchema({ update: true });

type ITestSetSchema = z.infer<typeof TestSetSchema>;

const update: ITestSetSchema = {
  _serverCreatedTs: serverTimestamp(),
  arr: ["222", "3333"],
  "one.0.0": "sokodik"
};

const parseValue = TestSetSchema.parse(update);

console.log(parseValue);
