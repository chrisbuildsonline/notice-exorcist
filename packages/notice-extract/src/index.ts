/** CBP Form 28 (request for information), CBP Form 29 (notice of action), courier duty invoice. */
export { NOTICE_KINDS, type NoticeKind } from './schema/common';
export { Notice } from './schema/notice';
export { applyHonesty, type GuardRecord, type GuardRule } from './honesty';
export { extractNotice, type ExtractFailure, type ExtractOk, type ExtractResult, type FailureReason } from './extract';
export { readConfig, type Config } from './config';
export { sniff, type InputType } from './input/sniff';
export { imageInfo, type ImageInfo } from './input/image-info';