// 합성 데이터 생성 단위 테스트 -- MTU-N272
import { describe, it, expect } from 'vitest';
import {
  detectPII,
  maskText,
  generateSyntheticData,
  validateQuality,
  getSyntheticAuditLog,
  type SyntheticConfig,
  type SyntheticRecord,
} from '../../src/lib/synthetic-data-generator';

describe('합성 데이터 생성', () => {
  describe('detectPII', () => {
    it('주민등록번호를 탐지해야 한다', () => {
      const detections = detectPII('주민번호: 880101-1234567');
      expect(detections.some((d) => d.type === 'rrn')).toBe(true);
    });

    it('전화번호를 탐지해야 한다', () => {
      const detections = detectPII('연락처: 010-1234-5678');
      expect(detections.some((d) => d.type === 'phone')).toBe(true);
    });

    it('이메일을 탐지해야 한다', () => {
      const detections = detectPII('이메일: test@example.com');
      expect(detections.some((d) => d.type === 'email')).toBe(true);
    });

    it('카드번호를 탐지해야 한다', () => {
      const detections = detectPII('카드: 1234-5678-9012-3456');
      expect(detections.some((d) => d.type === 'card')).toBe(true);
    });

    it('PII가 없는 텍스트에서 빈 배열을 반환해야 한다', () => {
      const detections = detectPII('공공기관 SaaS 프레임워크');
      expect(detections.length).toBe(0);
    });
  });

  describe('maskText', () => {
    it('주민등록번호를 마스킹해야 한다', () => {
      const result = maskText('주민번호: 880101-1234567', undefined, 'test-user');
      expect(result.maskedText).not.toContain('880101-1234567');
      expect(result.detections.length).toBeGreaterThan(0);
    });

    it('이메일을 난독화해야 한다', () => {
      const result = maskText('이메일: test@example.com', undefined, 'test-user');
      expect(result.maskedText).not.toContain('test@example.com');
    });

    it('원본 길이를 보존해야 한다', () => {
      const text = '테스트 텍스트';
      const result = maskText(text);
      expect(result.originalLength).toBe(text.length);
    });
  });

  describe('generateSyntheticData', () => {
    it('지정된 행 수만큼 생성해야 한다', () => {
      const config: SyntheticConfig = {
        schema: [
          { name: '이름', type: 'string', piiType: 'name' },
          { name: '나이', type: 'number', min: 20, max: 65 },
          { name: '부서', type: 'category', categories: ['총무과', '기획과', '정보화과'] },
        ],
        rowCount: 100,
        preserveDistribution: true,
        seed: 42,
      };

      const data = generateSyntheticData(config, 'test-user');
      expect(data).toHaveLength(100);
    });

    it('한국 이름을 생성해야 한다', () => {
      const config: SyntheticConfig = {
        schema: [{ name: '이름', type: 'string', piiType: 'name' }],
        rowCount: 10,
        preserveDistribution: true,
        seed: 123,
      };

      const data = generateSyntheticData(config, 'test-user');
      for (const row of data) {
        expect(typeof row['이름']).toBe('string');
        expect((row['이름'] as string).length).toBeGreaterThanOrEqual(2);
      }
    });

    it('수치 필드가 범위 내여야 한다', () => {
      const config: SyntheticConfig = {
        schema: [{ name: '점수', type: 'number', min: 0, max: 100 }],
        rowCount: 50,
        preserveDistribution: true,
        seed: 456,
      };

      const data = generateSyntheticData(config, 'test-user');
      for (const row of data) {
        expect(row['점수']).toBeGreaterThanOrEqual(0);
        expect(row['점수']).toBeLessThanOrEqual(100);
      }
    });

    it('정규분포로 생성할 수 있어야 한다', () => {
      const config: SyntheticConfig = {
        schema: [{ name: '값', type: 'number', min: 0, max: 100, distribution: 'normal' }],
        rowCount: 100,
        preserveDistribution: true,
        seed: 789,
      };

      const data = generateSyntheticData(config, 'test-user');
      const values = data.map((r) => r['값'] as number);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      // 정규분포 평균은 중앙(50) 근처
      expect(avg).toBeGreaterThan(30);
      expect(avg).toBeLessThan(70);
    });

    it('카테고리 필드가 주어진 범위 내여야 한다', () => {
      const categories = ['A', 'B', 'C'];
      const config: SyntheticConfig = {
        schema: [{ name: '등급', type: 'category', categories }],
        rowCount: 20,
        preserveDistribution: true,
      };

      const data = generateSyntheticData(config, 'test-user');
      for (const row of data) {
        expect(categories).toContain(row['등급']);
      }
    });
  });

  describe('validateQuality', () => {
    it('동일 분포 데이터에 높은 점수를 부여해야 한다', () => {
      const data: SyntheticRecord[] = Array.from({ length: 50 }, (_, i) => ({
        value: 50 + Math.random() * 10,
        category: i % 2 === 0 ? 'A' : 'B',
      }));

      const validation = validateQuality(data, data, ['value', 'category']);
      expect(validation.overallScore).toBeGreaterThan(0.8);
      expect(validation.isAcceptable).toBe(true);
    });
  });

  describe('감사 로그', () => {
    it('모든 작업이 기록되어야 한다', () => {
      const log = getSyntheticAuditLog();
      expect(log.length).toBeGreaterThan(0);
    });
  });
});
