/** Upload limits shared by the server and the Dropzone. No `node:` imports, so the client can use it. */
export const MAX_BYTES = 10 * 1024 * 1024;

/** Decoded pixel count above which an image is refused before reading (decompression bomb guard). */
export const MAX_PIXELS = 100_000_000;
