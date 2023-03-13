function isBuffer(obj: any) {
  return (
    obj &&
    obj.constructor &&
    typeof obj.constructor.isBuffer === "function" &&
    obj.constructor.isBuffer(obj)
  );
}

function keyIdentity(key: string) {
  return key;
}

interface FlattenOption {
  delimiter?: string;
  maxDepth?: number;
  safe?: boolean;
  transformKey?: (key: string) => string;
  ignore?: (value: any) => boolean;
}

export function flatten(target: Record<string, any>, opts: FlattenOption = {}) {
  const delimiter = opts.delimiter || ".";
  const maxDepth = opts.maxDepth;
  const transformKey = opts.transformKey || keyIdentity;
  const ignore = opts.ignore || (() => false);
  const output: Record<string, any> = {};

  function step(
    object: Record<string, any>,
    prev?: string,
    currentDepth: number = 1
  ) {
    Object.keys(object).forEach(function (key) {
      const value = object[key];
      const isarray = opts.safe && Array.isArray(value);
      const type = Object.prototype.toString.call(value);
      const isbuffer = isBuffer(value);
      const isIgnore = ignore(value);
      const isobject = type === "[object Object]" || type === "[object Array]";

      const newKey = prev
        ? prev + delimiter + transformKey(key)
        : transformKey(key);

      if (
        !isarray &&
        !isbuffer &&
        !isIgnore &&
        isobject &&
        Object.keys(value).length &&
        (!maxDepth || currentDepth < maxDepth)
      ) {
        return step(value, newKey, currentDepth + 1);
      }

      output[newKey] = value;
    });
  }

  step(target);

  return output;
}

interface UnflattenOption {
  delimiter?: string;
  maxDepth?: number;
  safe?: boolean;
  overwrite?: boolean;
  object?: boolean;
  transformKey?: (key: string) => string;
  ignore?: (value: any) => boolean;
}

export function unflatten(
  target: Record<string, any>,
  opts: UnflattenOption = {}
) {
  const delimiter = opts.delimiter || ".";
  const overwrite = opts.overwrite || false;
  const transformKey = opts.transformKey || keyIdentity;
  const ignore = opts.ignore || (() => false);
  const result: Record<string, any> = {};

  const isbuffer = isBuffer(target);
  if (
    isbuffer ||
    Object.prototype.toString.call(target) !== "[object Object]"
  ) {
    return target;
  }
  // safely ensure that the key is
  // an integer.
  function getkey(key: string) {
    const parsedKey = Number(key);

    return isNaN(parsedKey) || key.indexOf(".") !== -1 || opts.object
      ? key
      : parsedKey;
  }

  function addKeys(
    keyPrefix: string,
    recipient: Record<string, any>,
    target: Record<string, any>
  ) {
    return Object.keys(target).reduce(function (result, key) {
      result[keyPrefix + delimiter + key] = target[key];

      return result;
    }, recipient);
  }

  function isEmpty(val: any) {
    const type = Object.prototype.toString.call(val);
    const isArray = type === "[object Array]";
    const isObject = type === "[object Object]";

    if (!val) {
      return true;
    } else if (isArray) {
      return !val.length;
    } else if (isObject) {
      return !Object.keys(val).length;
    }
  }

  const initailResult: Record<string, any> = {};
  target = Object.keys(target).reduce(function (result, key) {
    const type = Object.prototype.toString.call(target[key]);
    const isIgnore = ignore(target[key]);
    const isarray = opts.safe && Array.isArray(target[key]);
    const isObject = type === "[object Object]" || type === "[object Array]";
    if (isIgnore || isarray || !isObject || isEmpty(target[key])) {
      result[key] = target[key];
      return result;
    } else {
      return addKeys(key, result, flatten(target[key], opts));
    }
  }, initailResult);

  Object.keys(target).forEach(function (key) {
    const split = key.split(delimiter).map(transformKey);
    let key1 = getkey(split.shift() || "");
    let key2 = getkey(split[0]);
    let recipient = result;

    while (key2 !== undefined) {
      if (key1 === "__proto__") {
        return;
      }

      const type = Object.prototype.toString.call(recipient[key1]);
      const isobject = type === "[object Object]" || type === "[object Array]";

      // do not write over falsey, non-undefined values if overwrite is false
      if (!overwrite && !isobject && typeof recipient[key1] !== "undefined") {
        return;
      }

      if ((overwrite && !isobject) || (!overwrite && recipient[key1] == null)) {
        recipient[key1] = typeof key2 === "number" && !opts.object ? [] : {};
      }

      recipient = recipient[key1];
      if (split.length > 0) {
        key1 = getkey(split.shift() || "");
        key2 = getkey(split[0]);
      }
    }

    const type = Object.prototype.toString.call(target[key]);
    const isIgnore = ignore(target[key]);
    const isarray = opts.safe && Array.isArray(target[key]);
    const isObject = type === "[object Object]" || type === "[object Array]";
    if (isIgnore || isarray || !isObject || isEmpty(target[key])) {
      recipient[key1] = target[key];
    } else {
      recipient[key1] = unflatten(target[key], opts);
    }
  });

  return result;
}
