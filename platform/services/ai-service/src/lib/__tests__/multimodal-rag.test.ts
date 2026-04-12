import { describe, it, expect } from 'vitest';
import {
  MultiModalRAG,
  type MultiModalDoc,
} from '../multimodal-rag.js';

function textDoc(id: string, text: string, tags: string[] = []): MultiModalDoc {
  return {
    id,
    modality: 'text',
    title: `text-${id}`,
    text,
    grade: 'O',
    tags,
  };
}

function imageDoc(
  id: string,
  opts: { hasExifGps?: boolean; tags?: string[]; source?: string } = {},
): MultiModalDoc {
  return {
    id,
    modality: 'image',
    title: `image-${id}`,
    imageMeta: {
      width: 1024,
      height: 768,
      hasExifGps: opts.hasExifGps ?? false,
      source: opts.source ?? '민원실 사진',
    },
    grade: 'O',
    tags: opts.tags ?? [],
  };
}

function ocrDoc(id: string, text: string): MultiModalDoc {
  return {
    id,
    modality: 'ocr',
    title: `ocr-${id}`,
    text,
    grade: 'O',
    tags: [],
  };
}

describe('addDocument 등급/EXIF 검증 (FR-R69.1, N-05)', () => {
  it('O 등급 텍스트 허용', () => {
    const r = new MultiModalRAG();
    r.addDocument(textDoc('a', '공공기관 업무 처리 절차'));
    expect(r.getDocumentCount()).toBe(1);
  });
  it('C 등급 차단', () => {
    const r = new MultiModalRAG();
    expect(() =>
      r.addDocument({ ...textDoc('a', 'x'), grade: 'C' }),
    ).toThrow('MMRAG_GRADE_BLOCKED');
  });
  it('EXIF GPS 있는 이미지 차단', () => {
    const r = new MultiModalRAG();
    expect(() => r.addDocument(imageDoc('img1', { hasExifGps: true }))).toThrow(
      'MMRAG_EXIF_BLOCKED',
    );
  });
  it('EXIF GPS 없는 이미지 허용', () => {
    const r = new MultiModalRAG();
    r.addDocument(imageDoc('img2', { hasExifGps: false, tags: ['도면'] }));
    expect(r.getDocumentCount()).toBe(1);
  });
});

describe('query 텍스트 모달 (FR-R69.2, FR-R69.3)', () => {
  it('텍스트 매칭 상위 반환', () => {
    const r = new MultiModalRAG();
    r.addDocument(textDoc('a', '정보공개 청구 절차 안내'));
    r.addDocument(textDoc('b', '예산 집행 가이드'));
    const results = r.query({ text: '정보공개 청구', topK: 5 });
    expect(results[0]?.docId).toBe('a');
  });
  it('topK 제한', () => {
    const r = new MultiModalRAG();
    for (let i = 0; i < 10; i += 1) {
      r.addDocument(textDoc(`d${i}`, '정보공개 절차'));
    }
    const results = r.query({ text: '정보공개', topK: 3 });
    expect(results.length).toBe(3);
  });
});

describe('퓨전 랭킹 weighted', () => {
  it('text + ocr 통합 랭킹', () => {
    const r = new MultiModalRAG();
    r.addDocument(textDoc('t1', '민원 처리 절차'));
    r.addDocument(ocrDoc('o1', '민원 담당자 연락처'));
    r.addDocument(imageDoc('i1', { tags: ['민원', '접수창구'] }));
    const results = r.query({ text: '민원', topK: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.sources.length).toBeGreaterThanOrEqual(1);
  });
});

describe('퓨전 랭킹 RRF', () => {
  it('RRF 방식 동작', () => {
    const r = new MultiModalRAG();
    r.addDocument(textDoc('t1', '예산 분석'));
    r.addDocument(ocrDoc('o1', '예산 보고서'));
    const results = r.query({ text: '예산', topK: 5, fusion: 'rrf' });
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('modality 필터', () => {
  it('text 모달만 검색', () => {
    const r = new MultiModalRAG();
    r.addDocument(textDoc('t1', '정책 분석'));
    r.addDocument(ocrDoc('o1', '정책 원문'));
    const results = r.query({ text: '정책', topK: 5, modalities: ['text'] });
    expect(results.every((res) => res.modality === 'text')).toBe(true);
  });
});

describe('감사 로그 (FR-R69.4, FR-R69.5, CSAP D-06)', () => {
  it('DOC_ADD + QUERY 기록', () => {
    const r = new MultiModalRAG();
    r.addDocument(textDoc('a', '테스트'));
    r.query({ text: '테스트', topK: 1 });
    const actions = r.getAuditLog().map((e) => e.action);
    expect(actions).toContain('DOC_ADD');
    expect(actions).toContain('QUERY');
  });
  it('DOC_BLOCK_GRADE 기록', () => {
    const r = new MultiModalRAG();
    try {
      r.addDocument({ ...textDoc('a', 'x'), grade: 'C' });
    } catch {
      /* noop */
    }
    expect(r.getAuditLog().some((e) => e.action === 'DOC_BLOCK_GRADE')).toBe(
      true,
    );
  });
  it('DOC_BLOCK_EXIF 기록', () => {
    const r = new MultiModalRAG();
    try {
      r.addDocument(imageDoc('i1', { hasExifGps: true }));
    } catch {
      /* noop */
    }
    expect(r.getAuditLog().some((e) => e.action === 'DOC_BLOCK_EXIF')).toBe(true);
  });
});
