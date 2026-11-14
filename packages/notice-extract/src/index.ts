/** CBP Form 28 (request for information), CBP Form 29 (notice of action), courier duty invoice. */
export const NOTICE_KINDS = ['form28', 'form29', 'courier'] as const;

export type NoticeKind = (typeof NOTICE_KINDS)[number];
