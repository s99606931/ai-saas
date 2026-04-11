// SVC-AI-ADV-R5 단위 테스트: 인메모리 지식 그래프
// Design Ref: SVC-AI-ADV-R5 DESIGN §2
// Plan SC: FR-ADV5.3, FR-ADV5.4
// CSAP: D-12, N2SF N-05

import { describe, it, expect, beforeEach } from 'vitest';
import {
  KnowledgeGraph,
  getOrCreateGraph,
  invalidateGraph,
} from '../../src/lib/knowledge-graph.js';
import type { GraphNode, GraphEdge } from '../../src/lib/knowledge-graph.js';

// 테스트 데이터
const lawNode: GraphNode = {
  id: 'law_1',
  type: 'law',
  name: '개인정보 보호법',
  metadata: { year: 2023 },
  documentId: 'doc_1',
};

const articleNode: GraphNode = {
  id: 'art_1',
  type: 'article',
  name: '제15조',
  metadata: { section: '개인정보의 수집 이용' },
  documentId: 'doc_1',
};

const orgNode: GraphNode = {
  id: 'org_1',
  type: 'organization',
  name: '개인정보보호위원회',
  metadata: {},
  documentId: 'doc_2',
};

const policyNode: GraphNode = {
  id: 'policy_1',
  type: 'policy',
  name: '디지털 플랫폼 정부 계획',
  metadata: {},
  documentId: 'doc_3',
};

const conceptNode: GraphNode = {
  id: 'concept_1',
  type: 'concept',
  name: 'CSAP',
  metadata: { fullName: '클라우드 보안 인증' },
  documentId: 'doc_4',
};

const refEdge: GraphEdge = {
  source: 'art_1',
  target: 'law_1',
  relation: 'references',
  weight: 0.9,
};

const parentEdge: GraphEdge = {
  source: 'law_1',
  target: 'art_1',
  relation: 'parent_of',
  weight: 1.0,
};

const relatedEdge: GraphEdge = {
  source: 'org_1',
  target: 'law_1',
  relation: 'related_to',
  weight: 0.7,
};

describe('KnowledgeGraph (FR-ADV5.3)', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    graph = new KnowledgeGraph('tenant-test');
  });

  describe('addNode', () => {
    it('노드를 추가한다', () => {
      graph.addNode(lawNode);
      const found = graph.getNode('law_1');
      expect(found).toBeDefined();
      expect(found?.name).toBe('개인정보 보호법');
      expect(found?.type).toBe('law');
    });

    it('중복 노드는 메타데이터를 병합한다', () => {
      graph.addNode(lawNode);
      graph.addNode({
        ...lawNode,
        metadata: { year: 2024, amendment: true },
      });
      const found = graph.getNode('law_1');
      expect(found?.metadata['year']).toBe(2024);
      expect(found?.metadata['amendment']).toBe(true);
    });

    it('5가지 엔티티 타입을 모두 지원한다', () => {
      graph.addNode(lawNode);
      graph.addNode(articleNode);
      graph.addNode(orgNode);
      graph.addNode(policyNode);
      graph.addNode(conceptNode);
      expect(graph.stats.nodeCount).toBe(5);
    });
  });

  describe('addEdge', () => {
    it('엣지를 추가한다', () => {
      graph.addNode(lawNode);
      graph.addNode(articleNode);
      graph.addEdge(refEdge);
      expect(graph.stats.edgeCount).toBe(1);
    });

    it('여러 엣지를 추가할 수 있다', () => {
      graph.addNode(lawNode);
      graph.addNode(articleNode);
      graph.addNode(orgNode);
      graph.addEdge(refEdge);
      graph.addEdge(parentEdge);
      graph.addEdge(relatedEdge);
      expect(graph.stats.edgeCount).toBe(3);
    });
  });

  describe('getNode', () => {
    it('존재하는 노드를 반환한다', () => {
      graph.addNode(lawNode);
      expect(graph.getNode('law_1')).toBeDefined();
    });

    it('존재하지 않는 노드는 undefined를 반환한다', () => {
      expect(graph.getNode('nonexistent')).toBeUndefined();
    });
  });

  describe('findNodesByName', () => {
    it('이름으로 노드를 검색한다 (부분 매칭)', () => {
      graph.addNode(lawNode);
      graph.addNode(articleNode);
      const results = graph.findNodesByName('보호법');
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('law_1');
    });

    it('대소문자 구분 없이 검색한다', () => {
      graph.addNode(conceptNode);
      const results = graph.findNodesByName('csap');
      expect(results).toHaveLength(1);
    });

    it('매칭 없으면 빈 배열을 반환한다', () => {
      const results = graph.findNodesByName('없는 노드');
      expect(results).toHaveLength(0);
    });
  });

  describe('findNodesByType', () => {
    it('타입으로 노드를 필터한다', () => {
      graph.addNode(lawNode);
      graph.addNode(articleNode);
      graph.addNode(orgNode);
      const laws = graph.findNodesByType('law');
      expect(laws).toHaveLength(1);
      expect(laws[0]?.id).toBe('law_1');
    });

    it('해당 타입이 없으면 빈 배열을 반환한다', () => {
      graph.addNode(lawNode);
      const policies = graph.findNodesByType('policy');
      expect(policies).toHaveLength(0);
    });
  });

  describe('explore (BFS N-hop 탐색) (FR-ADV5.4)', () => {
    beforeEach(() => {
      graph.addNode(lawNode);
      graph.addNode(articleNode);
      graph.addNode(orgNode);
      graph.addNode(policyNode);
      graph.addEdge(parentEdge); // law -> article
      graph.addEdge(relatedEdge); // org -> law
      graph.addEdge({
        source: 'policy_1',
        target: 'org_1',
        relation: 'related_to',
        weight: 0.5,
      }); // policy -> org
    });

    it('1-hop 이웃을 탐색한다', () => {
      const results = graph.explore('law_1', 1);
      // law_1 -> article (순방향), org -> law (역방향)
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.node.id === 'art_1')).toBe(true);
    });

    it('2-hop까지 탐색한다', () => {
      const results = graph.explore('law_1', 2);
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('시작 노드 자체는 결과에 포함하지 않는다', () => {
      const results = graph.explore('law_1', 2);
      expect(results.every((r) => r.node.id !== 'law_1')).toBe(true);
    });

    it('존재하지 않는 노드에서 탐색 시 빈 배열을 반환한다', () => {
      const results = graph.explore('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('maxResults를 초과하지 않는다', () => {
      const results = graph.explore('law_1', 3, 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('경로(path) 정보를 포함한다', () => {
      const results = graph.explore('law_1', 1);
      for (const r of results) {
        expect(r.path).toBeDefined();
        expect(r.path[0]).toBe('law_1');
      }
    });

    it('깊이(depth) 정보가 정확하다', () => {
      const results = graph.explore('law_1', 2);
      for (const r of results) {
        expect(r.depth).toBeGreaterThanOrEqual(1);
        expect(r.depth).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('linkEntities', () => {
    it('텍스트에서 매칭되는 엔티티를 찾는다', () => {
      graph.addNode(lawNode);
      graph.addNode(orgNode);
      const matches = graph.linkEntities('개인정보 보호법에 따른 개인정보보호위원회의 역할');
      expect(matches.some((n) => n.id === 'law_1')).toBe(true);
      expect(matches.some((n) => n.id === 'org_1')).toBe(true);
    });

    it('2글자 미만 노드명은 매칭하지 않는다', () => {
      graph.addNode({ id: 'short', type: 'concept', name: 'A', metadata: {} });
      const matches = graph.linkEntities('A라는 개념에 대해');
      expect(matches).toHaveLength(0);
    });

    it('매칭 없으면 빈 배열을 반환한다', () => {
      graph.addNode(lawNode);
      const matches = graph.linkEntities('전혀 관련 없는 텍스트');
      expect(matches).toHaveLength(0);
    });
  });

  describe('stats', () => {
    it('노드 수와 엣지 수를 정확히 반환한다', () => {
      graph.addNode(lawNode);
      graph.addNode(articleNode);
      graph.addEdge(refEdge);
      const stats = graph.stats;
      expect(stats.nodeCount).toBe(2);
      expect(stats.edgeCount).toBe(1);
      expect(stats.tenantId).toBe('tenant-test');
    });

    it('빈 그래프는 0을 반환한다', () => {
      const stats = graph.stats;
      expect(stats.nodeCount).toBe(0);
      expect(stats.edgeCount).toBe(0);
    });
  });

  describe('clear', () => {
    it('그래프를 완전히 초기화한다', () => {
      graph.addNode(lawNode);
      graph.addNode(articleNode);
      graph.addEdge(refEdge);
      graph.clear();
      expect(graph.stats.nodeCount).toBe(0);
      expect(graph.stats.edgeCount).toBe(0);
    });
  });
});

describe('테넌트별 그래프 캐시', () => {
  beforeEach(() => {
    invalidateGraph('tenant-1');
    invalidateGraph('tenant-2');
  });

  describe('getOrCreateGraph', () => {
    it('테넌트별 그래프를 생성한다', () => {
      const g = getOrCreateGraph('tenant-1');
      expect(g).toBeDefined();
    });

    it('같은 테넌트 그래프를 재사용한다', () => {
      const g1 = getOrCreateGraph('tenant-1');
      const g2 = getOrCreateGraph('tenant-1');
      expect(g1).toBe(g2);
    });

    it('다른 테넌트 그래프는 분리된다 (N2SF N-03)', () => {
      const g1 = getOrCreateGraph('tenant-1');
      const g2 = getOrCreateGraph('tenant-2');
      expect(g1).not.toBe(g2);
    });
  });

  describe('invalidateGraph', () => {
    it('테넌트 그래프를 무효화한다', () => {
      const g1 = getOrCreateGraph('tenant-1');
      invalidateGraph('tenant-1');
      const g2 = getOrCreateGraph('tenant-1');
      expect(g1).not.toBe(g2);
    });
  });
});
