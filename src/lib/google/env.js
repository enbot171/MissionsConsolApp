// Fail loudly at the point of use rather than sending `undefined` to Google
// and debugging an opaque 400 later.
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}
