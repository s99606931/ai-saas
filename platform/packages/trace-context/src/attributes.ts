// Span 속성 화이트리스트/블랙리스트 검증
// Plan SC: FR-TC.6
// CSAP: D-06 감사, D-12 민감정보 차단

export const DEFAULT_DENY_PATTERNS: RegExp[] = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /api[-_]?key/i,
  /credential/i,
  /session[-_]?id/i,
  /cookie/i,
];

export interface SanitizeOptions {
  denyPatterns?: RegExp[];
  maxLength?: number;
}

const DEFAULT_MAX_LENGTH = 512;

/**
 * 민감 키를 제거하고 값 길이를 제한
 */
export function sanitizeAttributes(
  attrs: Record<string, unknown> | undefined,
  options: SanitizeOptions = {},
): Record<string, unknown> {
  if (!attrs) return {};
  const denyPatterns = options.denyPatterns ?? DEFAULT_DENY_PATTERNS;
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(attrs)) {
    if (denyPatterns.some((re) => re.test(key))) {
      continue;
    }
    result[key] = truncate(value, maxLength);
  }
  return result;
}

function truncate(value: unknown, maxLength: number): unknown {
  if (typeof value === 'string' && value.length > maxLength) {
    return `${value.slice(0, maxLength)}...[truncated]`;
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return value;
  }
  if (typeof value === 'string') {
    return value;
  }
  // 객체/배열은 JSON 문자열화 후 길이 제한
  try {
    const json = JSON.stringify(value);
    return json.length > maxLength
      ? `${json.slice(0, maxLength)}...[truncated]`
      : json;
  } catch {
    return '[unserializable]';
  }
}
