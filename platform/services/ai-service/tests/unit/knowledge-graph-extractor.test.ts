// SVC-AI-ADV-R5 단위 테스트: 엔티티/관계 추출 + 지식 그래프 저장
// Design Ref: SVC-AI-ADV-R5 DESIGN §1
// Plan SC: FR-ADV5.1, FR-ADV5.2
// CSAP: D-12, N2SF N-05

import { describe, it, expect, beforeEach } from 'vitest';
import { addToKnowledgeGraph } from '../../src/lib/knowledge-graph-extractor.js';
import { getOrCreateGraph, invalidateGraph } from '../../src/lib/knowledge-graph.js';
import type { GraphNode, GraphEdge } from '../../src/lib/knowledge-graph.js';
import type { ExtractionResult } from '../../src/lib/knowledge-graph-extractor.js';

describe('addToKnowledgeGraph', () => {
  beforeEach(() => {
    invalidateGraph('tenant-test');
  });

  it('추출 결과를 그래프에 저장한다', () => {
    const entities: GraphNode[] = [
      { id: 'law_1', type: 'law', name: '개인정보 보호법', metadata: {}, documentId: 'doc1' },
      { id: 'org_1', type: 'organization', name: '행정안전부', metadata: {}, documentId: 'doc1' },
    ];
    const relations: GraphEdge[] = [
      { source: 'org_1', target: 'law_1', relation: 'related_to', weight: 0.8 },
    ];
    const result: ExtractionResult = { entities, relations, tokensUsed: 100 };

    addToKnowledgeGraph('tenant-test', result);

    const graph = getOrCreateGraph('tenant-test');
    expect(graph.stats.nodeCount).toBe(2);
    expect(graph.stats.edgeCount).toBe(1);
    expect(graph.getNode('law_1')?.name).toBe('개인정보 보호법');
  });

  it('빈 추출 결과는 그래프에 영향 없다', () => {
    const result: ExtractionResult = { entities: [], relations: [], tokensUsed: 0 };
    addToKnowledgeGraph('tenant-test', result);
    const graph = getOrCreateGraph('tenant-test');
    expect(graph.stats.nodeCount).toBe(0);
  });

  it('여러 번 호출하면 그래프에 누적된다', () => {
    const result1: ExtractionResult = {
      entities: [{ id: 'law_1', type: 'law', name: '전자정부법', metadata: {}, documentId: 'doc1' }],
      relations: [],
      tokensUsed: 50,
    };
    const result2: ExtractionResult = {
      entities: [{ id: 'org_1', type: 'organization', name: '과학기술정보통신부', metadata: {}, documentId: 'doc2' }],
      relations: [{ source: 'org_1', target: 'law_1', relation: 'references', weight: 0.9 }],
      tokensUsed: 50,
    };

    addToKnowledgeGraph('tenant-test', result1);
    addToKnowledgeGraph('tenant-test', result2);

    const graph = getOrCreateGraph('tenant-test');
    expect(graph.stats.nodeCount).toBe(2);
    expect(graph.stats.edgeCount).toBe(1);
  });

  it('테넌트 격리를 유지한다 (N2SF N-03)', () => {
    const result: ExtractionResult = {
      entities: [{ id: 'law_1', type: 'law', name: '테넌트A 법령', metadata: {}, documentId: 'doc1' }],
      relations: [],
      tokensUsed: 10,
    };
    addToKnowledgeGraph('tenant-A', result);

    invalidateGraph('tenant-B');
    const graphB = getOrCreateGraph('tenant-B');
    expect(graphB.stats.nodeCount).toBe(0);

    invalidateGraph('tenant-A');
  });
});
