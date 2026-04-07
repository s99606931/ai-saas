// 공공데이터 연동 플러그인 Zod 스키마 테스트
// Design Ref: MTU-ECO3 Design 2.2
// Plan SC: FR-ECO3.5~FR-ECO3.8
// CSAP: D-08 접근 통제, D-12 입력 검증

import { describe, it, expect } from 'vitest';
import { datasetSearchSchema, transformSchema } from '../../src/schemas/dataset.schema';

describe('datasetSearchSchema (CSAP D-12 입력 검증)', () => {
  it('빈 검색을 허용한다 (기본값 적용)', () => {
    const result = datasetSearchSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('키워드 검색을 허용한다', () => {
    const result = datasetSearchSchema.safeParse({ keyword: '교통' });
    expect(result.success).toBe(true);
  });

  it('빈 키워드를 거부한다', () => {
    expect(datasetSearchSchema.safeParse({ keyword: '' }).success).toBe(false);
  });

  it('키워드 100자 초과를 거부한다', () => {
    expect(datasetSearchSchema.safeParse({ keyword: 'a'.repeat(101) }).success).toBe(false);
  });

  it('유효한 카테고리만 허용한다', () => {
    const categories = ['general', 'economy', 'society', 'education', 'health', 'environment', 'transportation', 'culture'];
    for (const category of categories) {
      expect(datasetSearchSchema.safeParse({ category }).success).toBe(true);
    }
  });

  it('잘못된 카테고리를 거부한다', () => {
    expect(datasetSearchSchema.safeParse({ category: 'sports' }).success).toBe(false);
  });

  it('유효한 포맷만 허용한다 (json, xml, csv)', () => {
    for (const format of ['json', 'xml', 'csv']) {
      expect(datasetSearchSchema.safeParse({ format }).success).toBe(true);
    }
  });

  it('잘못된 포맷을 거부한다', () => {
    expect(datasetSearchSchema.safeParse({ format: 'excel' }).success).toBe(false);
  });

  it('limit 100 초과를 거부한다', () => {
    expect(datasetSearchSchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('page 0 이하를 거부한다', () => {
    expect(datasetSearchSchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('복합 검색을 허용한다', () => {
    const result = datasetSearchSchema.safeParse({
      keyword: '인구통계', category: 'society', format: 'csv', page: '2', limit: '50',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(50);
    }
  });
});

describe('transformSchema (FR-ECO3.8 데이터 변환)', () => {
  it('유효한 변환 요청을 허용한다', () => {
    const result = transformSchema.safeParse({
      data: '<root><item>1</item></root>',
      sourceFormat: 'xml',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetFormat).toBe('json'); // 기본값
      expect(result.data.encoding).toBe('utf-8');    // 기본값
    }
  });

  it('빈 데이터를 거부한다', () => {
    expect(transformSchema.safeParse({
      data: '', sourceFormat: 'xml',
    }).success).toBe(false);
  });

  it('유효한 원본 포맷만 허용한다 (xml, csv)', () => {
    expect(transformSchema.safeParse({ data: 'd', sourceFormat: 'xml' }).success).toBe(true);
    expect(transformSchema.safeParse({ data: 'd', sourceFormat: 'csv' }).success).toBe(true);
  });

  it('json을 원본 포맷으로 거부한다', () => {
    expect(transformSchema.safeParse({ data: 'd', sourceFormat: 'json' }).success).toBe(false);
  });

  it('euc-kr 인코딩을 허용한다', () => {
    const result = transformSchema.safeParse({
      data: 'd', sourceFormat: 'csv', encoding: 'euc-kr',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.encoding).toBe('euc-kr');
  });

  it('잘못된 인코딩을 거부한다', () => {
    expect(transformSchema.safeParse({
      data: 'd', sourceFormat: 'csv', encoding: 'ascii',
    }).success).toBe(false);
  });
});
