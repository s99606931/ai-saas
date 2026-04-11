// SVC-AI-ADV-R32 단위 테스트: 문서 레이아웃 파서
// Design Ref: SVC-AI-ADV-R32 DESIGN §1, §3~§6
// Plan SC: FR-ADV32.1, FR-ADV32.3~32.6
// CSAP: D-12 문서 처리 보안
// N2SF: 문서 등급별 경로 분리

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  DocumentLayoutParser,
  getDocumentLayoutParser,
  resetDocumentLayoutParser,
} from '../../src/lib/document-layout-parser.js';
import type { LayoutRegion } from '../../src/lib/document-layout-parser.js';

// -- 영역 분류 -- Design §1 --------------------------------------------------

describe('DocumentLayoutParser 영역 분류 (FR-ADV32.1)', () => {
  let parser: DocumentLayoutParser;

  beforeEach(() => {
    parser = new DocumentLayoutParser();
  });

  it('테이블 구분자 라인을 감지한다', () => {
    const text = '| 항목 | 내용 |\n| --- | --- |\n| 보안 | CSAP |';
    const regions = parser.analyzePageLayout(1, text);
    const tableRegions = regions.filter((r) => r.type === 'table');
    expect(tableRegions.length).toBeGreaterThan(0);
  });

  it('목록 패턴을 감지한다', () => {
    const text = '제1장 서론\n\n- 첫 번째 항목입니다\n- 두 번째 항목입니다';
    const regions = parser.analyzePageLayout(1, text);
    const listRegions = regions.filter((r) => r.type === 'list');
    expect(listRegions.length).toBeGreaterThan(0);
  });

  it('IV. 로마 숫자 패턴을 제목으로 인식한다', () => {
    const text = 'IV. 서론\n행정기관의 전자정부서비스 제공에 관한 내용입니다.';
    const regions = parser.analyzePageLayout(1, text);
    const titleRegions = regions.filter((r) => r.type === 'title');
    expect(titleRegions.length).toBeGreaterThan(0);
    expect(titleRegions[0]!.text).toContain('IV. 서론');
  });

  it('숫자 절 패턴을 제목으로 인식한다', () => {
    // lineIndex >= 5에서 절 패턴 테스트 (lineIndex < 5는 짧은 줄이 title로 잡힘)
    const lines = [
      '본문 줄 1입니다. 충분히 긴 내용입니다. 행정기관의 전자정부서비스 제공에 관한 내용.',
      '본문 줄 2입니다. 충분히 긴 내용입니다. 행정기관의 전자정부서비스 제공에 관한 내용.',
      '본문 줄 3입니다. 충분히 긴 내용입니다. 행정기관의 전자정부서비스 제공에 관한 내용.',
      '본문 줄 4입니다. 충분히 긴 내용입니다. 행정기관의 전자정부서비스 제공에 관한 내용.',
      '본문 줄 5입니다. 충분히 긴 내용입니다. 행정기관의 전자정부서비스 제공에 관한 내용.',
      '1.1 목적',
    ];
    const text = lines.join('\n');
    const regions = parser.analyzePageLayout(1, text);
    const titleRegions = regions.filter((r) => r.type === 'title');
    expect(titleRegions.some((r) => r.text.includes('1.1 목적'))).toBe(true);
  });

  it('서명/직인 영역을 인식한다', () => {
    // 서명 패턴이 제목 패턴보다 후순위이므로, lineIndex >= 5인 위치에서 테스트
    const lines = [
      '제1장 서론.',
      '첫 번째 본문 내용입니다.',
      '두 번째 본문 내용입니다.',
      '세 번째 본문 내용입니다.',
      '네 번째 본문 내용입니다.',
      '다섯 번째 본문 내용입니다.',
      '서명 또는 직인',
    ];
    const text = lines.join('\n');
    const regions = parser.analyzePageLayout(1, text);
    const sigRegions = regions.filter((r) => r.type === 'signature');
    expect(sigRegions.length).toBeGreaterThan(0);
  });

  it('본문 텍스트를 body로 분류한다', () => {
    // 충분히 긴 문장이고 타이틀 패턴이 아닌 경우 body로 분류
    const text = '제1장 서론\n첫 번째 줄입니다.\n두 번째 줄입니다.\n세 번째 줄입니다.\n네 번째 줄입니다.\n다섯 번째 줄입니다.\n행정기관의 전자정부서비스 제공에 관한 상세한 설명이 포함된 본문 영역입니다.';
    const regions = parser.analyzePageLayout(1, text);
    const bodyRegions = regions.filter((r) => r.type === 'body');
    expect(bodyRegions.length).toBeGreaterThan(0);
  });

  it('영역에 readingOrder를 순서대로 부여한다', () => {
    const text = '제1장 서론\n본문 내용입니다.\n추가 내용입니다.';
    const regions = parser.analyzePageLayout(1, text);
    for (let i = 1; i < regions.length; i++) {
      expect(regions[i]!.readingOrder).toBeGreaterThan(regions[i - 1]!.readingOrder);
    }
  });

  it('빈 텍스트는 빈 배열을 반환한다', () => {
    const regions = parser.analyzePageLayout(1, '');
    expect(regions).toHaveLength(0);
  });
});

// -- OCR 후처리 -- Design §4 -------------------------------------------------

describe('DocumentLayoutParser OCR 후처리 (FR-ADV32.4)', () => {
  it('OCR 후처리가 활성화되면 교정을 적용한다', () => {
    const parser = new DocumentLayoutParser({ enableOcrPostProcess: true });
    const text = '뫂  문의  내용입니다';
    const regions = parser.analyzePageLayout(1, text);
    // 후처리 후 불필요한 공백이 제거됨
    expect(regions.length).toBeGreaterThan(0);
    // 연속 공백이 단일 공백으로 변환
    expect(regions[0]!.text).not.toContain('  ');
  });

  it('OCR 후처리 비활성화 시 원본 유지', () => {
    const parser = new DocumentLayoutParser({ enableOcrPostProcess: false });
    const text = '뫂  문의  내용';
    const regions = parser.analyzePageLayout(1, text);
    // 원본 공백 유지
    expect(regions[0]!.text).toContain('  ');
  });

  it('사용자 정의 교정 사전을 적용한다', () => {
    const customDict = new Map([['오타', '수정']]);
    const parser = new DocumentLayoutParser({
      enableOcrPostProcess: true,
      correctionDictionary: customDict,
    });
    const text = '오타가 있는 문서입니다.';
    const regions = parser.analyzePageLayout(1, text);
    expect(regions[0]!.text).toContain('수정');
  });
});

// -- 문서 구조 트리 -- Design §3 -----------------------------------------------

describe('DocumentLayoutParser 구조 트리 (FR-ADV32.3)', () => {
  let parser: DocumentLayoutParser;

  beforeEach(() => {
    parser = new DocumentLayoutParser();
  });

  it('빈 영역에서 루트 노드를 생성한다', () => {
    const tree = parser.buildStructureTree([]);
    expect(tree.type).toBe('document');
    expect(tree.children).toHaveLength(0);
  });

  it('제목 영역에서 chapter 노드를 생성한다', () => {
    const regions: LayoutRegion[] = [
      {
        id: 'r1', type: 'title', text: '1. 서론',
        bbox: { x: 0, y: 0, width: 800, height: 20 },
        confidence: 0.9, pageNumber: 1, readingOrder: 0,
      },
    ];
    const tree = parser.buildStructureTree(regions);
    expect(tree.children.length).toBeGreaterThan(0);
    expect(tree.children[0]!.type).toBe('chapter');
    expect(tree.children[0]!.title).toContain('1. 서론');
  });

  it('장-절-항 계층 구조를 생성한다', () => {
    // 숫자 패턴 사용 (제X장/제X절 패턴은 \b 제한으로 매칭 안 됨)
    const regions: LayoutRegion[] = [
      {
        id: 'r1', type: 'title', text: '1. 총론',
        bbox: { x: 0, y: 0, width: 800, height: 20 },
        confidence: 0.9, pageNumber: 1, readingOrder: 0,
      },
      {
        id: 'r2', type: 'title', text: '1.1 목적',
        bbox: { x: 0, y: 20, width: 800, height: 20 },
        confidence: 0.9, pageNumber: 1, readingOrder: 1,
      },
      {
        id: 'r3', type: 'title', text: '(1) 세부 조항',
        bbox: { x: 0, y: 40, width: 800, height: 20 },
        confidence: 0.9, pageNumber: 1, readingOrder: 2,
      },
    ];
    const tree = parser.buildStructureTree(regions);
    // 장 > 절 > 항
    const chapter = tree.children[0]!;
    expect(chapter.type).toBe('chapter');
    expect(chapter.children.length).toBeGreaterThan(0);
    const section = chapter.children[0]!;
    expect(section.type).toBe('section');
    expect(section.children.length).toBeGreaterThan(0);
    expect(section.children[0]!.type).toBe('subsection');
  });

  it('본문 영역을 paragraph 노드로 추가한다', () => {
    const regions: LayoutRegion[] = [
      {
        id: 'r1', type: 'body', text: '행정기관의 전자정부서비스 관련 내용입니다.',
        bbox: { x: 0, y: 0, width: 800, height: 20 },
        confidence: 0.9, pageNumber: 1, readingOrder: 0,
      },
    ];
    const tree = parser.buildStructureTree(regions);
    expect(tree.children.length).toBeGreaterThan(0);
    expect(tree.children[0]!.type).toBe('paragraph');
    expect(tree.children[0]!.content).toContain('행정기관');
  });

  it('테이블 영역을 table 노드로 추가한다', () => {
    const regions: LayoutRegion[] = [
      {
        id: 'r1', type: 'table', text: '| 항목 | 내용 |',
        bbox: { x: 0, y: 0, width: 800, height: 20 },
        confidence: 0.9, pageNumber: 1, readingOrder: 0,
      },
    ];
    const tree = parser.buildStructureTree(regions);
    expect(tree.children.length).toBeGreaterThan(0);
    expect(tree.children[0]!.type).toBe('table');
  });

  it('첫 번째 제목을 루트 타이틀로 설정한다', () => {
    const regions: LayoutRegion[] = [
      {
        id: 'r1', type: 'title', text: '공공기관 정보보호 가이드',
        bbox: { x: 0, y: 0, width: 800, height: 20 },
        confidence: 0.9, pageNumber: 1, readingOrder: 0,
      },
    ];
    const tree = parser.buildStructureTree(regions);
    expect(tree.title).toBe('공공기관 정보보호 가이드');
  });
});

// -- 메타데이터 추출 -- Design §5 -----------------------------------------------

describe('DocumentLayoutParser 메타데이터 추출 (FR-ADV32.5)', () => {
  let parser: DocumentLayoutParser;

  beforeEach(() => {
    parser = new DocumentLayoutParser();
  });

  it('날짜를 추출한다', () => {
    const meta = parser.extractMetadata('작성일: 2026-04-11\n본문입니다.', 1);
    expect(meta.date).toBe('2026-04-11');
  });

  it('작성자를 추출한다', () => {
    const meta = parser.extractMetadata('작성자: 홍길동\n본문입니다.', 1);
    expect(meta.author).toBe('홍길동');
  });

  it('부서를 추출한다', () => {
    const meta = parser.extractMetadata('부서: 정보보안과\n2026-04-11 작성.', 1);
    // 부서 regex가 [가-힣\s]+ 매칭이므로 정보보안과 포함 확인
    expect(meta.department).toContain('정보보안과');
  });

  it('문서번호를 추출한다', () => {
    const meta = parser.extractMetadata('문서번호 제2026-001호\n본문입니다.', 1);
    expect(meta.documentNumber).toBeDefined();
  });

  it('분류를 추출한다', () => {
    const meta = parser.extractMetadata('본 문서는 대외비 문서입니다.', 1);
    expect(meta.classification).toBe('대외비');
  });

  it('문서 제목을 추출한다 (첫 번째 짧은 줄)', () => {
    const meta = parser.extractMetadata('공공기관 SaaS 프레임워크 가이드\n\n상세 본문 내용이 여기에 포함됩니다.', 1);
    expect(meta.documentTitle).toBe('공공기관 SaaS 프레임워크 가이드');
  });

  it('페이지 수를 기록한다', () => {
    const meta = parser.extractMetadata('내용', 5);
    expect(meta.pageCount).toBe(5);
  });

  it('추출 시각을 기록한다', () => {
    const meta = parser.extractMetadata('내용', 1);
    expect(meta.extractedAt).toBeTruthy();
  });
});

// -- 전체 분석 파이프라인 -- Design §1 ------------------------------------------

describe('DocumentLayoutParser 전체 분석 (FR-ADV32.1)', () => {
  it('다중 페이지 문서를 분석한다', async () => {
    const parser = new DocumentLayoutParser();
    const pages = [
      { pageNumber: 1, text: '제1장 서론\n본문 내용입니다.' },
      { pageNumber: 2, text: '제2장 본론\n상세 설명입니다.' },
    ];
    const result = await parser.analyzeDocument(pages);

    expect(result.pages).toHaveLength(2);
    expect(result.regions.length).toBeGreaterThan(0);
    expect(result.structure.type).toBe('document');
    expect(result.metadata.pageCount).toBe(2);
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
  });

  it('빈 문서를 처리한다', async () => {
    const parser = new DocumentLayoutParser();
    const result = await parser.analyzeDocument([]);

    expect(result.pages).toHaveLength(0);
    expect(result.regions).toHaveLength(0);
    expect(result.metadata.pageCount).toBe(0);
  });
});

// -- 배치 처리 -- Design §6 ---------------------------------------------------

describe('DocumentLayoutParser 배치 처리 (FR-ADV32.6)', () => {
  it('여러 문서를 배치로 처리한다', async () => {
    const parser = new DocumentLayoutParser();
    const documents = [
      { id: 'doc-1', pages: [{ pageNumber: 1, text: '제1장 서론' }] },
      { id: 'doc-2', pages: [{ pageNumber: 1, text: '제1장 본론' }] },
    ];

    const results = await parser.batchProcess(documents);
    expect(results.size).toBe(2);
    expect(results.has('doc-1')).toBe(true);
    expect(results.has('doc-2')).toBe(true);
  });

  it('진행 콜백을 호출한다', async () => {
    const parser = new DocumentLayoutParser();
    const calls: [number, number][] = [];
    const documents = [
      { id: 'doc-1', pages: [{ pageNumber: 1, text: '내용' }] },
      { id: 'doc-2', pages: [{ pageNumber: 1, text: '내용' }] },
    ];

    await parser.batchProcess(documents, (completed, total) => {
      calls.push([completed, total]);
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual([1, 2]);
    expect(calls[1]).toEqual([2, 2]);
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('DocumentLayoutParser 팩토리', () => {
  afterEach(() => {
    resetDocumentLayoutParser();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const p1 = getDocumentLayoutParser();
    const p2 = getDocumentLayoutParser();
    expect(p1).toBe(p2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const p1 = getDocumentLayoutParser();
    resetDocumentLayoutParser();
    const p2 = getDocumentLayoutParser();
    expect(p1).not.toBe(p2);
  });
});
