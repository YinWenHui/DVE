function unavailable(): never {
  throw new Error("This Node.js API is unavailable in the browser.");
}

export const promises = { writeFile: unavailable };
const browserNodeShim = { promises, readFileSync: unavailable, get: unavailable };
export default browserNodeShim;
