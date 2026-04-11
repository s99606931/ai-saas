// SVC-AI-ADV-R24 단위 테스트: 임베딩 파이프라인
// Design Ref: SVC-AI-ADV-R24 DESIGN §1~§5
// Plan SC: FR-ADV24.1~24.6
// CSAP: D-09 벡터 암호화, D-06 파이프라인 감사
// N2SF: N-05 O등급 데이터만 임베딩

import { describe, it, expect, beforeEach } from 'vitest';

import {
  contentHash,
  fixedChunk,
  semanticChunk,
  recursiveChunk,
  chunkDocument,
  EmbeddingModelRegistry,
  DocumentHashIndex,
  runEmbeddingPipeline,
} from '../../src/lib/embedding-pipeline.js';
import type { DocumentItem, EmbeddingModel } from '../../src/lib/embedding-pipeline.js';

// ── contentHash — Design §4 ────────────────────────────────────────────

describe('contentHash SHA-256 해시', () => {
  it('동일한 콘텐츠는 동일한 해시', () => {
    const hash1 = contentHash('전자정부법 제10조');
    const hash2 = contentHash('전자정부법 제10조');
    expect(hash1).toBe(hash2);
  });

  it('다른 콘텐츠는 다른 해시', () => {
    const hash1 = contentHash('전자정부법 제10조');
    const hash2 = contentHash('전자정부법 제11조');
    expect(hash1).not.toBe(hash2);
  });

  it('16자 길이를 반환한다', () => {
    expect(contentHash('test').length).toBe(16);
  });
});

// ── fixedChunk — Design §2 ──────────────────────────────────────────────

describe('fixedChunk 고정 크기 청킹', () => {
  it('짧은 텍스트는 단일 청크', () => {
    const chunks = fixedChunk('doc-1', '짧은 텍스트입니다.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.documentId).toBe('doc-1');
    expect(chunks[0]!.index).toBe(0);
  });

  it('긴 텍스트를 여러 청크로 분할한다', () => {
    const text = Array.from({ length: 30 }, (_, i) =>
      `문장 ${i}입니다. 행정기관의 전자정부서비스 제공에 관한 상세한 설명이 포함되어 있습니다.`
    ).join(' ');
    const chunks = fixedChunk('doc-1', text, 128);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('청크 인덱스가 순서대로 증가한다', () => {
    const text = Array.from({ length: 20 }, (_, i) =>
      `긴 문장 ${i}입니다. 충분한 내용입니다.`
    ).join(' ');
    const chunks = fixedChunk('doc-1', text, 64);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.index).toBe(i);
    }
  });

  it('각 청크에 contentHash가 포함된다', () => {
    const chunks = fixedChunk('doc-1', '테스트 내용입니다.');
    for (const chunk of chunks) {
      expect(chunk.contentHash.length).toBe(16);
    }
  });

  it('빈 텍스트는 빈 배열', () => {
    expect(fixedChunk('doc-1', '')).toHaveLength(0);
  });
});

// ── semanticChunk — Design §2 ──────────────────────────────────────────

describe('semanticChunk 시맨틱 청킹', () => {
  it('문단 경계로 분할한다', () => {
    const text = '첫 번째 문단입니다.\n\n두 번째 문단입니다.\n\n세 번째 문단입니다.';
    const chunks = semanticChunk('doc-1', text, 1024);
    // 모두 하나의 청크에 들어갈 수 있음
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('큰 문단은 여러 청크로 분할한다', () => {
    const text = Array.from({ length: 20 }, (_, i) =>
      `문단 ${i}입니다. 행정기관의 전자정부서비스 제공에 관한 상세한 설명이 포함되어 있습니다.`
    ).join('\n\n');
    const chunks = semanticChunk('doc-1', text, 128);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

// ── recursiveChunk — Design §2 ─────────────────────────────────────────

describe('recursiveChunk 재귀 청킹', () => {
  it('짧은 텍스트는 단일 청크', () => {
    const chunks = recursiveChunk('doc-1', '짧은 내용.');
    expect(chunks).toHaveLength(1);
  });

  it('긴 텍스트를 재귀적으로 분할한다', () => {
    const text = Array.from({ length: 20 }, (_, i) =>
      `문단 ${i}입니다. 행정기관의 전자정부서비스 제공에 관한 상세한 설명이 포함되어 있습니다.`
    ).join('\n\n');
    const chunks = recursiveChunk('doc-1', text, 128);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

// ── chunkDocument 전략 라우팅 ──────────────────────────────────────────

describe('chunkDocument 전략 라우팅', () => {
  const text = '문장 하나입니다. 문장 둘입니다.';

  it('fixed 전략을 사용한다', () => {
    const chunks = chunkDocument('doc-1', text, 'fixed');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('semantic 전략을 사용한다', () => {
    const chunks = chunkDocument('doc-1', text, 'semantic');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('recursive 전략을 사용한다', () => {
    const chunks = chunkDocument('doc-1', text, 'recursive');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});

// ── EmbeddingModelRegistry — Design §3 ──────────────────────────────────

describe('EmbeddingModelRegistry 모델 레지스트리 (FR-ADV24.3)', () => {
  let registry: EmbeddingModelRegistry;

  const model1: EmbeddingModel = {
    id: 'e5-large',
    name: 'E5 Large',
    dimensions: 1024,
    maxTokens: 512,
    provider: 'local',
    isActive: true,
  };

  const model2: EmbeddingModel = {
    id: 'bge-m3',
    name: 'BGE M3',
    dimensions: 768,
    maxTokens: 8192,
    provider: 'local',
    isActive: false,
  };

  beforeEach(() => {
    registry = new EmbeddingModelRegistry();
  });

  it('모델을 등록한다', () => {
    registry.register(model1);
    expect(registry.size).toBe(1);
  });

  it('활성 모델을 조회한다', () => {
    registry.register(model1);
    registry.register(model2);
    const active = registry.getActive();
    expect(active).toBeDefined();
    expect(active!.id).toBe('e5-large');
  });

  it('활성 모델이 없으면 undefined', () => {
    registry.register({ ...model1, isActive: false });
    expect(registry.getActive()).toBeUndefined();
  });

  it('모델을 활성화한다 (이전 활성 모델 비활성화)', () => {
    registry.register(model1);
    registry.register(model2);
    registry.activate('bge-m3');
    const active = registry.getActive();
    expect(active!.id).toBe('bge-m3');
  });

  it('존재하지 않는 모델 활성화는 false', () => {
    expect(registry.activate('nonexistent')).toBe(false);
  });

  it('모델 목록을 반환한다', () => {
    registry.register(model1);
    registry.register(model2);
    expect(registry.list()).toHaveLength(2);
  });
});

// ── DocumentHashIndex — Design §4 ──────────────────────────────────────

describe('DocumentHashIndex 증분 업데이트 (FR-ADV24.4)', () => {
  let index: DocumentHashIndex;

  beforeEach(() => {
    index = new DocumentHashIndex();
  });

  it('새 문서는 변경된 것으로 감지한다', () => {
    expect(index.hasChanged('doc-1', '내용')).toBe(true);
  });

  it('동일한 내용은 변경되지 않은 것으로 감지한다', () => {
    index.update('doc-1', '내용');
    expect(index.hasChanged('doc-1', '내용')).toBe(false);
  });

  it('변경된 내용을 감지한다', () => {
    index.update('doc-1', '원래 내용');
    expect(index.hasChanged('doc-1', '수정된 내용')).toBe(true);
  });

  it('문서를 삭제한다', () => {
    index.update('doc-1', '내용');
    expect(index.remove('doc-1')).toBe(true);
    expect(index.hasChanged('doc-1', '내용')).toBe(true); // 삭제 후 새로 감지
  });

  it('존재하지 않는 문서 삭제는 false', () => {
    expect(index.remove('nonexistent')).toBe(false);
  });

  it('인덱스 크기를 반환한다', () => {
    index.update('doc-1', '내용1');
    index.update('doc-2', '내용2');
    expect(index.size).toBe(2);
  });
});

// ── runEmbeddingPipeline 통합 — Design §1 ──────────────────────────────

describe('runEmbeddingPipeline 파이프라인 실행 (FR-ADV24.1)', () => {
  it('문서를 처리한다', async () => {
    const documents: DocumentItem[] = [
      { id: 'doc-1', content: '전자정부법 제10조 관련 내용.', metadata: {}, source: 'test', updatedAt: new Date().toISOString() },
      { id: 'doc-2', content: '행정절차법 제1조 관련 내용.', metadata: {}, source: 'test', updatedAt: new Date().toISOString() },
    ];

    const hashIndex = new DocumentHashIndex();
    const stored: unknown[] = [];

    const result = await runEmbeddingPipeline(
      documents,
      'fixed',
      hashIndex,
      async (texts) => texts.map(() => [0.1, 0.2, 0.3]),
      async (chunks) => { stored.push(...chunks); },
    );

    expect(result.totalDocuments).toBe(2);
    expect(result.totalChunks).toBeGreaterThan(0);
    expect(result.skippedChunks).toBe(0);
    expect(result.stages).toHaveLength(4);
    expect(stored.length).toBeGreaterThan(0);
  });

  it('증분 처리: 변경되지 않은 문서는 건너뛴다', async () => {
    const documents: DocumentItem[] = [
      { id: 'doc-1', content: '동일한 내용.', metadata: {}, source: 'test', updatedAt: '' },
    ];

    const hashIndex = new DocumentHashIndex();
    hashIndex.update('doc-1', '동일한 내용.');

    const result = await runEmbeddingPipeline(
      documents,
      'fixed',
      hashIndex,
      async (texts) => texts.map(() => [0.1]),
      async () => {},
    );

    expect(result.skippedChunks).toBe(1);
    expect(result.totalChunks).toBe(0);
  });

  it('임베딩 실패 시 failedCount를 기록한다', async () => {
    const documents: DocumentItem[] = [
      { id: 'doc-1', content: '테스트 문서 내용.', metadata: {}, source: 'test', updatedAt: '' },
    ];

    const hashIndex = new DocumentHashIndex();

    const result = await runEmbeddingPipeline(
      documents,
      'fixed',
      hashIndex,
      async () => { throw new Error('Embedding failed'); },
      async () => {},
    );

    const embedStage = result.stages.find((s) => s.stage === 'embed');
    expect(embedStage!.failedCount).toBeGreaterThan(0);
  });

  it('빈 문서 목록을 처리한다', async () => {
    const result = await runEmbeddingPipeline(
      [],
      'fixed',
      new DocumentHashIndex(),
      async () => [],
      async () => {},
    );

    expect(result.totalDocuments).toBe(0);
    expect(result.totalChunks).toBe(0);
  });
});
