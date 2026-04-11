// SVC-AI-2026 단위 테스트: 텍스트 청킹
// Design Ref: SVC-AI-2026 DESIGN §1, SVC-AI-ADV-R1 DESIGN §5
// Plan SC: FR-AI26.1 (RAG), FR-ADV1.6 (계층적 청킹)

import { describe, it, expect } from 'vitest';

import {
  chunkText,
  estimateTokens,
  hierarchicalChunk,
  buildChildToParentMap,
} from '../../src/lib/chunker.js';
import type { TextChunk, HierarchicalChunk } from '../../src/lib/chunker.js';

// ── chunkText 기본 청킹 ────────────────────────────────────────────────────

describe('chunkText 기본 청킹', () => {
  it('짧은 텍스트는 단일 청크로 반환한다', () => {
    const chunks = chunkText('짧은 텍스트입니다. 여기에 내용이 있습니다.');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]!.chunkIndex).toBe(0);
  });

  it('긴 텍스트를 여러 청크로 분할한다', () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) =>
      `문단 ${i}입니다. 이 문단에는 충분한 내용이 포함되어 있습니다. 행정 절차에 관한 상세한 설명을 담고 있습니다.`
    ).join('\n\n');
    const chunks = chunkText(paragraphs, 128);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('청크 인덱스가 순서대로 증가한다', () => {
    const text = Array.from({ length: 10 }, (_, i) =>
      `긴 문단 ${i}입니다. 상세한 설명이 포함됩니다. 행정기관의 업무 처리에 관한 내용입니다.`
    ).join('\n\n');
    const chunks = chunkText(text, 64);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.chunkIndex).toBe(chunks[i - 1]!.chunkIndex + 1);
    }
  });

  it('빈 텍스트는 빈 배열을 반환한다', () => {
    expect(chunkText('')).toHaveLength(0);
  });

  it('각 청크에 tokenCount를 포함한다', () => {
    const chunks = chunkText('테스트 텍스트입니다. 충분한 길이의 내용을 포함해야 합니다.');
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }
  });

  it('오버랩이 적용된다', () => {
    const text = Array.from({ length: 30 }, (_, i) =>
      `문단 ${i}번입니다. 충분히 긴 설명이 포함되어 있습니다. 이 문장은 오버랩 테스트를 위한 것입니다.`
    ).join('\n\n');
    const chunks = chunkText(text, 128, 20);
    // 오버랩이 있으므로 인접 청크의 내용이 겹칠 수 있음
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('매우 짧은 청크는 필터링한다', () => {
    const text = '짧은.\n\n두번째 문단은 충분히 길어서 포함됩니다. 행정기관 업무 처리 절차를 설명합니다.';
    const chunks = chunkText(text);
    // 10자 이하 청크는 필터링됨
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(10);
    }
  });
});

// ── estimateTokens ─────────────────────────────────────────────────────────

describe('estimateTokens 토큰 추정', () => {
  it('텍스트 길이의 절반을 반환한다', () => {
    expect(estimateTokens('한글텍스트')).toBe(3); // ceil(5/2)
  });

  it('빈 문자열은 0을 반환한다', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('영문도 처리한다', () => {
    expect(estimateTokens('hello world')).toBe(6); // ceil(11/2)
  });
});

// ── hierarchicalChunk 계층적 청킹 — FR-ADV1.6 ──────────────────────────────

describe('hierarchicalChunk 계층적 청킹 (FR-ADV1.6)', () => {
  const longText = Array.from({ length: 50 }, (_, i) =>
    `문단 ${i}번입니다. 이 문단에는 전자정부법에 관한 상세한 설명이 포함되어 있습니다. 행정기관의 장은 전자정부서비스를 제공할 때 국민의 편의를 도모하여야 합니다. 추가적인 내용이 여기에 있습니다.`
  ).join('\n\n');

  it('부모-자식 구조를 생성한다', () => {
    const result = hierarchicalChunk(longText, 512, 128);
    expect(result.length).toBeGreaterThan(0);
    for (const group of result) {
      expect(group.parent).toBeDefined();
      expect(group.children.length).toBeGreaterThanOrEqual(0);
      expect(group.parentIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('자식 청크가 부모보다 작다', () => {
    const result = hierarchicalChunk(longText, 512, 128);
    for (const group of result) {
      for (const child of group.children) {
        expect(child.tokenCount).toBeLessThanOrEqual(group.parent.tokenCount + 50); // 약간의 오버랩 허용
      }
    }
  });

  it('빈 텍스트는 빈 배열을 반환한다', () => {
    expect(hierarchicalChunk('')).toHaveLength(0);
  });
});

// ── buildChildToParentMap ──────────────────────────────────────────────────

describe('buildChildToParentMap 역참조 맵', () => {
  it('자식 인덱스에서 부모 청크를 조회한다', () => {
    const longText = Array.from({ length: 30 }, (_, i) =>
      `문단 ${i}입니다. 충분히 긴 내용이 포함되어 있습니다. 전자정부 서비스 제공에 관한 상세 설명입니다.`
    ).join('\n\n');

    const hierarchical = hierarchicalChunk(longText, 512, 128);
    const map = buildChildToParentMap(hierarchical);

    expect(map.size).toBeGreaterThan(0);
    // 모든 자식이 부모를 가진다
    for (const group of hierarchical) {
      for (const child of group.children) {
        const parent = map.get(child.chunkIndex);
        expect(parent).toBeDefined();
        expect(parent!.content).toBe(group.parent.content);
      }
    }
  });

  it('빈 계층은 빈 맵을 반환한다', () => {
    const map = buildChildToParentMap([]);
    expect(map.size).toBe(0);
  });
});
