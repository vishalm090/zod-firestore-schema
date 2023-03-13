import { z } from "zod";
import {
  Timestamp,
  FieldValue,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  deleteField,
} from "firebase/firestore";
import {
  collection,
  doc,
  writeBatch,
  query,
  where,
  getDocs,
  orderBy,
  getDoc,
} from "firebase/firestore";
import type { UpdateData } from "./types";
import { flatten, unflatten } from "./flat";

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const REACT_APP_API_KEY = "AIzaSyBejxaOOsOW4ud_-BO2wI0QI59qJquv_Xc";
const REACT_APP_AUTH_DOMAIN = "dev-quiz-app-090.firebaseapp.com";
const REACT_APP_PROJECT_ID = "dev-quiz-app-090";
const REACT_APP_STORAGE_BUCKET = "dev-quiz-app-090.appspot.com";
const REACT_APP_MESSAGING_SENDER_ID = "262690210009";
const REACT_APP_APP_ID = "1:262690210009:web:a74fc42f472d2ca8347ec8";
const REACT_APP_MEASUREMENT_ID = "G-6VWSX4QCEW";

const firebaseConfig = {
  apiKey: REACT_APP_API_KEY,
  authDomain: REACT_APP_AUTH_DOMAIN,
  projectId: REACT_APP_PROJECT_ID,
  storageBucket: REACT_APP_STORAGE_BUCKET,
  messagingSenderId: REACT_APP_MESSAGING_SENDER_ID,
  appId: REACT_APP_APP_ID,
  measurementId: REACT_APP_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Custom Zod Implementation for FieldValue
const FirebaseArrayUnionFieldValue = z.custom<FieldValue>(
  (data: any) => {
    return data._methodName === "arrayUnion" && data instanceof FieldValue;
  },
  {
    message: "FieldValue must be arrayUnion",
  }
);

const FirebaseArrayRemoveFieldValue = z.custom<FieldValue>(
  (data: any) => {
    return data._methodName === "arrayRemove" && data instanceof FieldValue;
  },
  {
    message: "FieldValue must be arrayRemove",
  }
);

const FirebaseDeleteFieldFieldValue = z.custom<FieldValue>(
  (data: any) => {
    return data._methodName === "deleteField" && data instanceof FieldValue;
  },
  {
    message: "FieldValue must be deleteField",
  }
);

const FirebaseIncrementFieldValue = z.custom<FieldValue>(
  (data: any) => {
    return data._methodName === "increment" && data instanceof FieldValue;
  },
  {
    message: "FieldValue must be increment",
  }
);

const FirebaseServerTimestampFieldValue = z.custom<FieldValue>(
  (data: any) => {
    return (
      data?._methodName === "serverTimestamp" && data instanceof FieldValue
    );
  },
  {
    message: "FieldValue must be serverTimestamp",
  }
);

interface ZodFirestoreOptions<SET extends boolean, UPDATE extends boolean> {
  set?: SET;
  update?: UPDATE;
}

function zodRecord<
  T extends z.ZodTypeAny,
  K extends z.KeySchema,
  SET extends boolean = false,
  UPDATE extends boolean = false
>(
  keySchema: K,
  valueType: T,
  opts: ZodFirestoreOptions<SET, UPDATE> = {},
  params?: z.RawCreateParams
) {
  const setSchema = z.record(keySchema, valueType, params);
  let updateSchema;

  if (valueType instanceof z.ZodObject) {
    updateSchema = z.record(
      keySchema,
      valueType.deepPartial().optional(),
      params
    );
  } else {
    updateSchema = z.record(keySchema, valueType.optional(), params);
  }
  const getSchema = z.record(keySchema, valueType, params);

  type RETURN = SET extends true
    ? typeof setSchema
    : UPDATE extends true
    ? typeof setSchema
    : typeof getSchema;

  return (
    opts?.set ? setSchema : opts?.update ? updateSchema : getSchema
  ) as RETURN;
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
    z.array(arraySchema),
  ]);

  const getSchema = z.array(arraySchema);

  type RETURN = SET extends true
    ? typeof setSchema
    : UPDATE extends true
    ? typeof updateSchema
    : typeof getSchema;

  return (
    opts?.set ? setSchema : opts?.update ? updateSchema : getSchema
  ) as RETURN;
}

function zodFirestoreTimestamp<
  SET extends boolean = false,
  UPDATE extends boolean = false
>(opts: ZodFirestoreOptions<SET, UPDATE> = {}) {
  const setSchema = z.union([z.instanceof(Timestamp), z.date()]);

  const updateSchema = z.union([
    z.instanceof(Timestamp),
    FirebaseDeleteFieldFieldValue,
    z.date(),
  ]);

  const getSchema = z.instanceof(Timestamp).transform((value) => {
    return value.toDate();
  });

  type RETURN = SET extends true
    ? typeof setSchema
    : UPDATE extends true
    ? typeof updateSchema
    : typeof getSchema;

  return (
    opts?.set ? setSchema : opts?.update ? updateSchema : getSchema
  ) as RETURN;
}

function zodFirestoreServerTimestamp<
  SET extends boolean = false,
  UPDATE extends boolean = false
>(opts: ZodFirestoreOptions<SET, UPDATE> = {}) {
  const setSchema = FirebaseServerTimestampFieldValue;

  const updateSchema = z.union([
    FirebaseServerTimestampFieldValue,
    FirebaseDeleteFieldFieldValue,
  ]);

  const getSchema = z.instanceof(Timestamp).transform((value) => {
    return value.toDate();
  });

  type RETURN = SET extends true
    ? typeof setSchema
    : UPDATE extends true
    ? typeof updateSchema
    : typeof getSchema;

  return (
    opts?.set ? setSchema : opts?.update ? updateSchema : getSchema
  ) as RETURN;
}

function zodFirestoreNumber<
  SET extends boolean = false,
  UPDATE extends boolean = false
>(opts: ZodFirestoreOptions<SET, UPDATE> = {}) {
  const setSchema = z.number();

  const updateSchema = z.union([
    FirebaseIncrementFieldValue,
    FirebaseDeleteFieldFieldValue,
    z.number(),
  ]);

  const getSchema = z.number();

  type RETURN = SET extends true
    ? typeof setSchema
    : UPDATE extends true
    ? typeof updateSchema
    : typeof getSchema;

  return (
    opts?.set ? setSchema : opts?.update ? updateSchema : getSchema
  ) as RETURN;
}

function zodFirestoreSchema<
  T extends z.ZodRawShape,
  SET extends boolean = false,
  UPDATE extends boolean = false
>(objectSchema: T, opts: ZodFirestoreOptions<SET, UPDATE> = {}) {
  const setSchema = z.object(objectSchema);

  let updateInputValue: any = null;
  const updateSchema = z.preprocess(
    (val: any) => {
      updateInputValue = val;
      console.log("before preprocess", val);
      const newObj = unflatten(val, {
        object: true,
        safe: true,
        ignore: (value) => {
          if (value instanceof FieldValue || value instanceof Timestamp) {
            return true;
          }
          return false;
        },
      });
      console.log("after preprocess", newObj);
      return newObj;
    },
    z
      .object(objectSchema)
      .deepPartial()
      .strict()
      .transform((val) => {
        if (updateInputValue) {
          const r = {
            ...updateInputValue,
          };
          updateInputValue = null;
          return r;
        }
        const newObj = flatten(val, {
          safe: true,
          ignore: (value) => {
            if (value instanceof FieldValue || value instanceof Timestamp) {
              return true;
            }
            return false;
          },
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

  return (
    opts?.set ? setSchema.strict() : opts?.update ? updateSchema : getSchema
  ) as RETURN;
}

function TestSchema<
  SET extends boolean = false,
  UPDATE extends boolean = false
>(opts?: ZodFirestoreOptions<SET, UPDATE>) {
  return zodFirestoreSchema(
    {
      _createdTs: zodFirestoreTimestamp(opts).optional(),
      _serverCreatedTs: zodFirestoreServerTimestamp(opts),
      count: zodFirestoreNumber(opts),
      arr: zodFirestoreArray(z.string(), opts),
      one: zodRecord(
        z.string().min(1),
        z.object({
          two: z.string(),
          three: z.string(),
          four: z.number(),
        }),
        opts
      ).optional(),
      lol: zodRecord(
        z.string().min(1),
        z.object({
          two: z.string(),
          three: z.string(),
          four: zodFirestoreNumber(opts),
        }),
        opts
      ),
      aaa: z.object({
        bbb: z.object({
          ccc: z.string(),
        }),
        ddd: z.string().optional(),
      }).optional(),
    },
    opts
  );
}

const TestUpdateSchema = TestSchema({ update: true });
const TestSetSchema = TestSchema({ set: true });
const TestGetSchema = TestSchema({});

type ITestUpdateSchema = z.infer<typeof TestUpdateSchema>;
type ITestSetSchema = z.infer<typeof TestSetSchema>;
type ITestGetSchema = z.infer<typeof TestGetSchema>;

const update: ITestUpdateSchema = {
  lol: {
    zzz: {
      two: "string 3",
      three: "string 3",
      four: increment(1)
    }
  },
  "lol.zzz.four": increment(1)
};

// const set: ITestSetSchema = {
//   _createdTs: new Date(),
//   _serverCreatedTs: serverTimestamp(),
//   count: 3,
//   arr: ["2"],
//   one: {},
//   aaa: {
//     bbb: {
//       ccc: "string",
//     },
//     ddd: "string",
//   },
// };


const parseValue = TestUpdateSchema.parse(update);
// const parseValue2 = TestUpdateSchema.parse(update2);

console.log(parseValue);

async function myFunc(
  { update = false, set = false }: { update?: boolean; set?: boolean },
  data: any,
) {
  try {
    const batch = writeBatch(db);
    const newTestRef = doc(collection(db, "test"));

    if (update) {
      const parseValue = TestUpdateSchema.parse(data);
      console.log("parseValue update", parseValue);
      const newTestRef = doc(db, "test", "3A1tcMyyv3UtM3kisTKz");
      batch.update(newTestRef, parseValue);
    }
    if (set) {
      const parseValue = TestSetSchema.strict().parse(data);
      console.log("parseValue set", parseValue);
      batch.set(newTestRef, parseValue);
    }

    await batch.commit();
  } catch (e) {
    console.log(e);
  }
}

// myFunc({ set: true }, set);

// myFunc({ update: true }, update);
