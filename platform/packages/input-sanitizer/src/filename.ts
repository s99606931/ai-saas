// 파일명 안전화
// Plan SC: FR-IS.3
// CSAP: D-12, OWASP A03 Path Traversal

const WINDOWS_RESERVED = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

const MAX_LENGTH = 255;

/**
 * 사용자 제공 파일명을 OS 안전 형식으로 변환
 * Plan SC: FR-IS.3
 */
export function safeFilename(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('safeFilename expects a string');
  }

  // 1. NFC 정규화 (zero-width 공격 완화)
  let result = input.normalize('NFC');

  // 2-4. 제어문자 + 경로 구분자 제거
  // eslint-disable-next-line no-control-regex
  result = result.replace(/[\u0000-\u001F\u007F/\\]/g, '');

  // 5. 다중 점 시퀀스(.. 등) → '_' 치환 (단일 . 확장자는 보존)
  result = result.replace(/\.{2,}/g, '_');

  // 6. 선행 점 제거 (숨김 파일/디렉토리 방지)
  result = result.replace(/^\.+/, '');

  // 7. 양 끝 공백/점 제거
  result = result.trim().replace(/[. ]+$/, '');

  if (result.length === 0) {
    return 'unnamed';
  }

  // 8. Windows 예약어 회피
  const dotIndex = result.lastIndexOf('.');
  const stem = dotIndex > 0 ? result.slice(0, dotIndex) : result;
  const ext = dotIndex > 0 ? result.slice(dotIndex) : '';
  if (WINDOWS_RESERVED.has(stem.toUpperCase())) {
    result = `${stem}_${ext}`;
  }

  // 9. 길이 제한 (확장자 보존 시도)
  if (result.length > MAX_LENGTH) {
    const lastDot = result.lastIndexOf('.');
    if (lastDot > 0 && result.length - lastDot <= 10) {
      const extPart = result.slice(lastDot);
      result = result.slice(0, MAX_LENGTH - extPart.length) + extPart;
    } else {
      result = result.slice(0, MAX_LENGTH);
    }
  }

  return result;
}
