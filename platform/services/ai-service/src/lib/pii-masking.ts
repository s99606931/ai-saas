// PII 마스킹 유틸리티
// Design Ref: DESIGN-MTU-P10
// Plan SC: FR-P10.3
// CSAP: N2SF N-05 — O등급 데이터 PII 마스킹 후 AI API 전송

/**
 * PII (개인식별정보) 마스킹
 *
 * O등급 데이터를 AI API로 전송하기 전에 PII를 마스킹합니다.
 *
 * 마스킹 대상:
 * - 이메일 주소
 * - 전화번호 (한국 형식)
 * - 주민등록번호
 * - 카드 번호
 * - IP 주소
 *
 * @param text - 마스킹할 텍스트
 * @returns 마스킹된 텍스트
 */
export function maskPII(text: string): string {
  let masked = text;

  // 이메일 마스킹
  masked = masked.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[EMAIL_MASKED]',
  );

  // 전화번호 마스킹 (한국 형식: 010-1234-5678, 02-123-4567)
  masked = masked.replace(
    /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
    '[PHONE_MASKED]',
  );

  // 주민등록번호 마스킹 (YYMMDD-NNNNNNN)
  masked = masked.replace(
    /\d{6}[-\s]?\d{7}/g,
    '[RRN_MASKED]',
  );

  // 카드 번호 마스킹 (XXXX-XXXX-XXXX-XXXX)
  masked = masked.replace(
    /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,
    '[CARD_MASKED]',
  );

  // IPv4 주소 마스킹
  masked = masked.replace(
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
    '[IP_MASKED]',
  );

  return masked;
}

/**
 * 텍스트에 PII가 포함되어 있는지 확인
 *
 * @param text - 검사할 텍스트
 * @returns PII 포함 여부
 */
export function containsPII(text: string): boolean {
  const piiPatterns = [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,  // 이메일
    /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/,                // 전화번호
    /\d{6}[-\s]?\d{7}/,                                    // 주민등록번호
    /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/,            // 카드 번호
  ];

  return piiPatterns.some((pattern) => pattern.test(text));
}
