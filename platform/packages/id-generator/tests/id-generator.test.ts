// ID Generator 테스트
// Design Ref: SVC-IDGEN-R33 DESIGN
// Plan SC: FR-ID.1~FR-ID.5

import { describe, it, expect } from 'vitest';
import {
  generateUUIDv7,
  generatePrefixedId,
  generateShortId,
  generateBatch,
  isValidUUIDv7,
  isValidPrefixedId,
  extractUUID,
  extractPrefix,
} from '../src/id-generator.js';

describe('IdGenerator', () => {
  describe('FR-ID.1: UUID v7 생성', () => {
    it('유효한 UUID v7 형식을 생성한다', () => {
      const id = generateUUIDv7();
      expect(isValidUUIDv7(id)).toBe(true);
    });

    it('버전 비트가 7이다', () => {
      const id = generateUUIDv7();
      // 3번째 그룹의 첫 문자가 '7'
      expect(id.split('-')[2][0]).toBe('7');
    });

    it('변형 비트가 올바르다 (8, 9, a, b)', () => {
      const id = generateUUIDv7();
      const variantChar = id.split('-')[3][0];
      expect(['8', '9', 'a', 'b']).toContain(variantChar);
    });

    it('시간 순서로 정렬 가능하다', () => {
      const id1 = generateUUIDv7(1000);
      const id2 = generateUUIDv7(2000);
      expect(id1 < id2).toBe(true);
    });

    it('고유한 ID를 생성한다', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateUUIDv7());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('FR-ID.2: 접두사 ID', () => {
    it('접두사가 포함된 ID를 생성한다', () => {
      const id = generatePrefixedId('usr');
      expect(id.startsWith('usr_')).toBe(true);
    });

    it('접두사 뒤의 UUID가 유효하다', () => {
      const id = generatePrefixedId('ten');
      const uuid = extractUUID(id);
      expect(uuid).not.toBeNull();
      expect(isValidUUIDv7(uuid!)).toBe(true);
    });

    it('다양한 접두사를 지원한다', () => {
      const prefixes = ['usr', 'ten', 'ord', 'inv', 'sub'];
      for (const prefix of prefixes) {
        const id = generatePrefixedId(prefix);
        expect(extractPrefix(id)).toBe(prefix);
      }
    });
  });

  describe('FR-ID.3: 짧은 ID', () => {
    it('기본 12자리를 생성한다', () => {
      const id = generateShortId();
      expect(id).toHaveLength(12);
    });

    it('커스텀 길이를 지원한다', () => {
      expect(generateShortId(8)).toHaveLength(8);
      expect(generateShortId(16)).toHaveLength(16);
      expect(generateShortId(24)).toHaveLength(24);
    });

    it('URL-safe 문자만 포함한다', () => {
      const id = generateShortId();
      expect(id).toMatch(/^[0-9A-Za-z]+$/);
    });

    it('고유한 ID를 생성한다', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateShortId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('FR-ID.4: 배치 생성', () => {
    it('지정한 수만큼 ID를 생성한다', () => {
      const ids = generateBatch(10);
      expect(ids).toHaveLength(10);
    });

    it('모든 ID가 유효하다', () => {
      const ids = generateBatch(5);
      for (const id of ids) {
        expect(isValidUUIDv7(id)).toBe(true);
      }
    });

    it('커스텀 생성기를 사용할 수 있다', () => {
      const ids = generateBatch(5, () => generatePrefixedId('batch'));
      for (const id of ids) {
        expect(id.startsWith('batch_')).toBe(true);
      }
    });

    it('모든 ID가 고유하다', () => {
      const ids = generateBatch(100);
      expect(new Set(ids).size).toBe(100);
    });
  });

  describe('FR-ID.5: ID 검증', () => {
    it('유효한 UUID v7을 통과시킨다', () => {
      const id = generateUUIDv7();
      expect(isValidUUIDv7(id)).toBe(true);
    });

    it('잘못된 형식을 거부한다', () => {
      expect(isValidUUIDv7('not-a-uuid')).toBe(false);
      expect(isValidUUIDv7('')).toBe(false);
      expect(isValidUUIDv7('12345678-1234-1234-1234-123456789012')).toBe(false); // v1 형식
    });

    it('유효한 접두사 ID를 통과시킨다', () => {
      const id = generatePrefixedId('usr');
      expect(isValidPrefixedId(id)).toBe(true);
      expect(isValidPrefixedId(id, 'usr')).toBe(true);
    });

    it('잘못된 접두사를 거부한다', () => {
      const id = generatePrefixedId('usr');
      expect(isValidPrefixedId(id, 'ten')).toBe(false);
    });

    it('접두사 없는 UUID를 접두사 ID로 거부한다', () => {
      const id = generateUUIDv7();
      expect(isValidPrefixedId(id)).toBe(false);
    });
  });
});
