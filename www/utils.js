/**
 * Helper function to convert a Uint8Array to a hex string for logging.
 * @param {Uint8Array} bytes The array of bytes to convert.
 * @returns {string} The hexadecimal representation of the bytes.
 */
export function bytesToHex(bytes) {
  if (!bytes) {
    return "";
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}
