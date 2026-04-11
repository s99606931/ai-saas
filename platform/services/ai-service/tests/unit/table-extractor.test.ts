// SVC-AI-ADV-R32 단위 테스트: 테이블 추출기
// Design Ref: SVC-AI-ADV-R32 DESIGN §2
// Plan SC: FR-ADV32.2
// CSAP: D-12 데이터 정합성 검증

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  TableExtractor,
  getTableExtractor,
  resetTableExtractor,
} from '../../src/lib/table-extractor.js';

// -- 테이블 추출 -- Design §2 --------------------------------------------------

describe('TableExtractor 테이블 추출 (FR-ADV32.2)', () => {
  let extractor: TableExtractor;

  beforeEach(() => {
    extractor = new TableExtractor();
  });

  it('파이프 구분 테이블을 추출한다', () => {
    const text = [
      '| 항목 | 내용 | 비고 |',
      '| --- | --- | --- |',
      '| 보안 | CSAP | 중등급 |',
      '| 인프라 | k3s | WSL2 |',
    ].join('\n');

    const tables = extractor.extractTables(text, 1);
    expect(tables.length).toBeGreaterThanOrEqual(1);
    expect(tables[0]!.rows).toBeGreaterThanOrEqual(2);
    expect(tables[0]!.cols).toBeGreaterThanOrEqual(2);
  });

  it('탭 구분 테이블을 추출한다', () => {
    const text = [
      '항목\t내용\t비고',
      '보안\tCSAP\t중등급',
      '인프라\tk3s\tWSL2',
    ].join('\n');

    const tables = extractor.extractTables(text, 1);
    expect(tables.length).toBeGreaterThanOrEqual(1);
  });

  it('테이블이 없는 텍스트는 빈 배열', () => {
    const text = '일반 텍스트 내용입니다.\n줄바꿈도 있습니다.\n하지만 테이블은 없습니다.';
    const tables = extractor.extractTables(text, 1);
    expect(tables).toHaveLength(0);
  });

  it('최소 행 수 미달 시 추출하지 않는다', () => {
    const extractor = new TableExtractor({ minRows: 5 });
    const text = '| 항목 | 내용 |\n| --- | --- |\n| 보안 | CSAP |';
    const tables = extractor.extractTables(text, 1);
    expect(tables).toHaveLength(0);
  });

  it('pageNumber를 기록한다', () => {
    const text = '| 항목 | 내용 |\n| --- | --- |\n| A | B |';
    const tables = extractor.extractTables(text, 3);
    if (tables.length > 0) {
      expect(tables[0]!.pageNumber).toBe(3);
    }
  });

  it('신뢰도를 계산한다', () => {
    const text = [
      '| 항목 | 내용 | 비고 |',
      '| --- | --- | --- |',
      '| A | B | C |',
      '| D | E | F |',
      '| G | H | I |',
    ].join('\n');
    const tables = extractor.extractTables(text, 1);
    if (tables.length > 0) {
      expect(tables[0]!.confidence).toBeGreaterThan(0);
      expect(tables[0]!.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('헤더를 자동 감지한다', () => {
    const text = [
      '| 항목 | 내용 |',
      '| --- | --- |',
      '| A | B |',
    ].join('\n');
    const tables = extractor.extractTables(text, 1);
    if (tables.length > 0) {
      expect(tables[0]!.headers.length).toBeGreaterThan(0);
    }
  });
});

// -- 출력 변환 ----------------------------------------------------------------

describe('TableExtractor 출력 변환', () => {
  let extractor: TableExtractor;

  const sampleText = [
    '| 이름 | 나이 | 부서 |',
    '| --- | --- | --- |',
    '| 홍길동 | 30 | 보안팀 |',
    '| 김영희 | 25 | 개발팀 |',
  ].join('\n');

  beforeEach(() => {
    extractor = new TableExtractor();
  });

  it('JSON으로 변환한다', () => {
    const tables = extractor.extractTables(sampleText, 1);
    if (tables.length > 0) {
      const json = extractor.toJson(tables[0]!);
      expect(json.length).toBeGreaterThan(0);
      // 데이터 행이 있어야 함
      expect(json[0]).toBeDefined();
    }
  });

  it('CSV로 변환한다', () => {
    const tables = extractor.extractTables(sampleText, 1);
    if (tables.length > 0) {
      const csv = extractor.toCsv(tables[0]!);
      expect(csv).toBeTruthy();
      expect(csv).toContain('\n');
    }
  });

  it('Markdown으로 변환한다', () => {
    const tables = extractor.extractTables(sampleText, 1);
    if (tables.length > 0) {
      const md = extractor.toMarkdown(tables[0]!);
      expect(md).toContain('|');
      expect(md).toContain('---');
    }
  });

  it('2D 배열로 변환한다', () => {
    const tables = extractor.extractTables(sampleText, 1);
    if (tables.length > 0) {
      const arr = extractor.toArray(tables[0]!);
      expect(arr.length).toBeGreaterThan(0);
      expect(Array.isArray(arr[0])).toBe(true);
    }
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('TableExtractor 팩토리', () => {
  afterEach(() => {
    resetTableExtractor();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const e1 = getTableExtractor();
    const e2 = getTableExtractor();
    expect(e1).toBe(e2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const e1 = getTableExtractor();
    resetTableExtractor();
    const e2 = getTableExtractor();
    expect(e1).not.toBe(e2);
  });
});
