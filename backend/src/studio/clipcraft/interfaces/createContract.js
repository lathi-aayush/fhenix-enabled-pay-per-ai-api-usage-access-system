// @filename: backend/src/studio/clipcraft/interfaces/createContract.js

/**
 * Factory for interface stubs — implementations must satisfy all methods.
 * @param {string} name
 * @param {string[]} methods
 */
export function createContract(name, methods) {
  const proto = {};
  for (const method of methods) {
    proto[method] = function notImplemented(..._args) {
      throw new Error(`${name}.${method} is not implemented`);
    };
  }
  return Object.freeze(proto);
}

/**
 * @param {object} impl
 * @param {string} name
 * @param {string[]} requiredMethods
 */
export function validateImplementation(impl, name, requiredMethods) {
  if (!impl || typeof impl !== "object") {
    throw new TypeError(`${name}: implementation must be an object`);
  }
  for (const m of requiredMethods) {
    if (typeof impl[m] !== "function") {
      throw new TypeError(`${name}: missing method ${m}`);
    }
  }
  return impl;
}
