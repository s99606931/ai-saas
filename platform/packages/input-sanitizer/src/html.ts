// HTML escape (XSS 1차 방어)
// Plan SC: FR-IS.1, FR-IS.2
// CSAP: D-12 입력 검증, OWASP A03

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
};

const ATTR_EXTRA_MAP: Record<string, string> = {
  '=': '&#x3D;',
  '`': '&#x60;',
};

/**
 * HTML 컨텍스트용 escape
 * Plan SC: FR-IS.1
 */
export function escapeHtml(value: string): string {
  if (typeof value !== 'string') {
    throw new TypeError('escapeHtml expects a string');
  }
  return value.replace(/[&<>"'/]/g, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

/**
 * HTML 속성 컨텍스트용 escape (=, ` 추가)
 * Plan SC: FR-IS.2
 */
export function escapeAttribute(value: string): string {
  const base = escapeHtml(value);
  return base.replace(/[=`]/g, (ch) => ATTR_EXTRA_MAP[ch] ?? ch);
}
