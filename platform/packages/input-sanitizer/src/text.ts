// 텍스트 새니타이즈 (제어문자, 길이 제한)
// Plan SC: FR-IS.6, FR-IS.7

export interface StripControlOptions {
  /** 탭(\t) 보존 (default: false) */
  keepTab?: boolean;
  /** 개행(\n, \r) 보존 (default: false) */
  keepNewline?: boolean;
}

/**
 * 제어문자 제거 (로그 인젝션, 터미널 이스케이프 방어)
 * Plan SC: FR-IS.6
 */
export function stripControlChars(
  input: string,
  options: StripControlOptions = {},
): string {
  if (typeof input !== 'string') {
    throw new TypeError('stripControlChars expects a string');
  }
  const keepTab = options.keepTab ?? false;
  const keepNewline = options.keepNewline ?? false;

  let result = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x09 && keepTab) {
      result += ch;
      continue;
    }
    if ((code === 0x0a || code === 0x0d) && keepNewline) {
      result += ch;
      continue;
    }
    if (code < 0x20 || code === 0x7f) {
      continue;
    }
    result += ch;
  }
  return result;
}

/**
 * 코드포인트 단위로 안전 길이 제한 (서로게이트 페어 보호)
 * Plan SC: FR-IS.7
 */
export function truncate(input: string, max: number): string {
  if (typeof input !== 'string') {
    throw new TypeError('truncate expects a string');
  }
  if (!Number.isInteger(max) || max < 0) {
    throw new RangeError('max must be a non-negative integer');
  }
  const codepoints = Array.from(input);
  if (codepoints.length <= max) return input;
  return codepoints.slice(0, max).join('');
}
