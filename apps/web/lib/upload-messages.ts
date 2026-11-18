import { formatBytes } from './format-bytes';
import { MAX_BYTES } from './limits';

/** Every upload error string, in one place, so the server, the Dropzone and the tests quote the same words. */
export const EMPTY = 'That file is empty.';
export const OVERSIZE = 'That file is over 10 MB. Try a smaller photo, or a lower-resolution scan.';
export const NOT_SUPPORTED = 'That file is not a PDF, PNG or JPEG.';
export const HEIC_HINT = 'On iPhone, choose Most Compatible in Camera settings, or share the photo as JPEG.';
export const TOO_MANY_PIXELS = 'That image is too large to read. Try a smaller photo.';
export const UNREADABLE_IMAGE = 'That image could not be read. Save it again as PNG or JPEG and try once more.';
export const NO_FILE = 'Choose a file to upload.';
export const UPLOAD_FAILED = 'Upload failed. Try again.';
export const OFFLINE = 'Upload failed. Check your connection and try again.';

/** The oversize message with the file's size and the limit (file-size facts, not money). */
export const oversize = (size: number) => `${OVERSIZE} This one is ${formatBytes(size)}; the limit is ${formatBytes(MAX_BYTES)}.`;
