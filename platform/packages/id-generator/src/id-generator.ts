// ID Generator -- 분산 고유 ID 생성
// Design Ref: SVC-IDGEN-R33 DESIGN
// Plan SC: FR-ID.1, FR-ID.2, FR-ID.3, FR-ID.4, FR-ID.5

import { randomBytes } from 'node:crypto';

/**
 * UUID v7 생성 (RFC 9562)
 * Plan SC: FR-ID.1
 *
 * 시간 기반 UUID: 밀리초 타임스탬프(48비트) + 버전(4비트) + 랜덤(12비트)
 *                + 변형(2비트) + 랜덤(62비트)
 * 시간 순서 정렬 가능하여 DB B-tree 인덱스에 효율적입니다.
 */
export function generateUUIDv7(timestamp?: number): string {
  const now = timestamp ?? Date.now();

  // 48비트 밀리초 타임스탬프
  const msHex = now.toString(16).padStart(12, '0');

  // 랜덤 바이트 10개 (80비트 = 20 hex chars)
  const rand = randomBytes(10);
  const randHex = Buffer.from(rand).toString('hex');

  // 그룹3: 버전7(4비트) + rand_a(12비트)
  const group3 = '7' + randHex.slice(0, 3);

  // 그룹4: 변형(2비트=10) + rand_b(14비트)
  const variantNibble = (parseInt(randHex.slice(3, 4), 16) & 0x3) | 0x8;
  const group4 = variantNibble.toString(16) + randHex.slice(4, 7);

  // 그룹5: rand_c(48비트 = 12 hex chars)
  const group5 = randHex.slice(7, 19);

  return [
    msHex.slice(0, 8),     // 32비트 타임스탬프 상위
    msHex.slice(8, 12),    // 16비트 타임스탬프 하위
    group3,                 // 4비트 버전 + 12비트 랜덤
    group4,                 // 2비트 변형 + 14비트 랜덤
    group5,                 // 48비트 랜덤
  ].join('-');
}

/**
 * 접두사 붙은 ID 생성
 * Plan SC: FR-ID.2
 *
 * 형식: {prefix}_{uuid}
 * 예: usr_01912345-6789-7abc-...
 */
export function generatePrefixedId(prefix: string, timestamp?: number): string {
  return `${prefix}_${generateUUIDv7(timestamp)}`;
}

/**
 * URL-safe 짧은 ID 생성 (NanoID 스타일)
 * Plan SC: FR-ID.3
 *
 * 기본 12자리, 알파벳+숫자+특수문자(URL-safe)
 * 충돌 확률: 12자리 기준 ~1% at 1.5M IDs
 */
export function generateShortId(length: number = 12): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  let id = '';

  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }

  return id;
}

/**
 * 배치 ID 생성
 * Plan SC: FR-ID.4
 */
export function generateBatch(
  count: number,
  generator: () => string = generateUUIDv7,
): string[] {
  return Array.from({ length: count }, () => generator());
}

/**
 * UUID v7 형식 검증
 * Plan SC: FR-ID.5
 */
export function isValidUUIDv7(id: string): boolean {
  // UUID v7 형식: xxxxxxxx-xxxx-7xxx-[89ab]xxx-xxxxxxxxxxxx
  const uuidV7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  return uuidV7Regex.test(id);
}

/**
 * 접두사 ID 검증
 * Plan SC: FR-ID.5
 */
export function isValidPrefixedId(id: string, expectedPrefix?: string): boolean {
  const match = id.match(/^([a-z]+)_(.+)$/);
  if (!match) return false;

  const [, prefix, uuid] = match;

  if (expectedPrefix && prefix !== expectedPrefix) return false;

  return isValidUUIDv7(uuid);
}

/**
 * 접두사 ID에서 UUID 부분 추출
 */
export function extractUUID(prefixedId: string): string | null {
  const match = prefixedId.match(/^[a-z]+_(.+)$/);
  return match ? match[1] : null;
}

/**
 * 접두사 ID에서 접두사 추출
 */
export function extractPrefix(prefixedId: string): string | null {
  const match = prefixedId.match(/^([a-z]+)_/);
  return match ? match[1] : null;
}
