// KST 상수
// Design Ref: SVC-TIMEZONE-R53.design.md §2

/** KST는 UTC+9 (DST 없음) */
export const KST_OFFSET_MINUTES = 9 * 60;
export const KST_OFFSET_MS = KST_OFFSET_MINUTES * 60_000;
export const KST_OFFSET_LABEL = '+09:00';
