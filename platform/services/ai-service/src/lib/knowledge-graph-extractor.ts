// LLM 기반 엔티티/관계 추출기 -- FR-ADV5.1, FR-ADV5.2
// Design Ref: SVC-AI-ADV-R5 DESIGN §1
// 문서에서 법령, 조문, 기관, 정책 엔티티 및 관계 추출
// CSAP: D-12 시스템 개발 보안, N2SF N-05 O등급

import { getLLMConfig, createLLMProvider } from './llm-provider.js';
import { maskPII } from './pii-masking.js';
import type { LLMMessage } from './llm-provider.js';
import { getOrCreateGraph } from './knowledge-graph.js';
import type { GraphNode, GraphEdge, EntityType, RelationType } from './knowledge-graph.js';

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export interface ExtractionResult {
  entities: GraphNode[];
  relations: GraphEdge[];
  tokensUsed: number;
}

// ── 추출 프롬프트 ──────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `당신은 공공기관 문서 분석 전문가입니다.
주어진 문서 텍스트에서 엔티티(개체)와 관계를 추출합니다.

## 엔티티 타입
- law: 법령 (예: 개인정보 보호법, 전자정부법)
- article: 조문 (예: 제1조, 제2항)
- organization: 기관 (예: 행정안전부, 과학기술정보통신부)
- policy: 정책 (예: 디지털 플랫폼 정부 계획)
- concept: 개념 (예: CSAP, ISMS-P, N2SF)

## 관계 타입
- references: A가 B를 참조/인용
- amends: A가 B를 개정
- supersedes: A가 B를 대체
- parent_of: A가 B의 상위 (법률→시행령)
- related_to: A와 B가 관련됨

반드시 아래 JSON 형식으로만 응답하세요:
{
  "entities": [
    {"id": "고유ID", "type": "law", "name": "이름"}
  ],
  "relations": [
    {"source": "엔티티ID", "target": "엔티티ID", "relation": "references", "weight": 0.9}
  ]
}`;

// ── 엔티티/관계 추출 ────────────────────────────────────────────────────

/**
 * LLM 기반 엔티티/관계 추출
 * Plan SC: FR-ADV5.1, FR-ADV5.2
 *
 * @param text 문서 텍스트
 * @param documentId 문서 ID
 * @param tenantId 테넌트 ID
 */
export async function extractEntitiesAndRelations(
  text: string,
  documentId: string,
  _tenantId: string,
): Promise<ExtractionResult> {
  const maskedText = maskPII(text.slice(0, 4000)); // 토큰 절약

  const messages: LLMMessage[] = [
    { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: `다음 문서에서 엔티티와 관계를 추출하세요:\n\n${maskedText}` },
  ];

  try {
    const llmConfig = getLLMConfig();
    const provider = await createLLMProvider(llmConfig);
    const response = await provider.chat(messages, { maxTokens: 1024, temperature: 0.1 });

    const jsonMatch = /\{[\s\S]*\}/.exec(response.text);
    if (!jsonMatch) return { entities: [], relations: [], tokensUsed: response.tokensUsed };

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const rawEntities = parsed['entities'];
    const rawRelations = parsed['relations'];

    const validEntityTypes: EntityType[] = ['law', 'article', 'organization', 'policy', 'concept'];
    const validRelTypes: RelationType[] = ['references', 'amends', 'supersedes', 'parent_of', 'related_to'];

    const entities: GraphNode[] = [];
    if (Array.isArray(rawEntities)) {
      for (const e of rawEntities as Array<Record<string, unknown>>) {
        const type = String(e['type'] ?? '');
        if (!validEntityTypes.includes(type as EntityType)) continue;

        entities.push({
          id: String(e['id'] ?? `${documentId}_${entities.length}`),
          type: type as EntityType,
          name: String(e['name'] ?? ''),
          metadata: {},
          documentId,
        });
      }
    }

    const relations: GraphEdge[] = [];
    if (Array.isArray(rawRelations)) {
      for (const r of rawRelations as Array<Record<string, unknown>>) {
        const relation = String(r['relation'] ?? '');
        if (!validRelTypes.includes(relation as RelationType)) continue;

        relations.push({
          source: String(r['source'] ?? ''),
          target: String(r['target'] ?? ''),
          relation: relation as RelationType,
          weight: typeof r['weight'] === 'number' ? Math.min(1, Math.max(0, r['weight'])) : 0.5,
        });
      }
    }

    return { entities, relations, tokensUsed: response.tokensUsed };
  } catch {
    // LLM 실패 시 규칙 기반 추출
    return ruleBasedExtraction(text, documentId);
  }
}

/**
 * 규칙 기반 엔티티 추출 (LLM 없이 사용 가능한 폴백)
 */
function ruleBasedExtraction(text: string, documentId: string): ExtractionResult {
  const entities: GraphNode[] = [];
  let idCounter = 0;

  // 법령 추출
  const lawPatterns = text.match(/(?:「|「)([^」」]+)(?:」|」)/g) ?? [];
  for (const match of lawPatterns) {
    const name = match.replace(/[「」「」]/g, '').trim();
    if (name.length >= 2) {
      entities.push({
        id: `${documentId}_law_${idCounter++}`,
        type: 'law',
        name,
        metadata: {},
        documentId,
      });
    }
  }

  // 조문 추출
  const articlePatterns = text.match(/제\d+조(?:\s*제\d+항)?/g) ?? [];
  for (const match of articlePatterns) {
    entities.push({
      id: `${documentId}_art_${idCounter++}`,
      type: 'article',
      name: match.trim(),
      metadata: {},
      documentId,
    });
  }

  // 기관 추출
  const orgPatterns = text.match(/(?:행정안전부|과학기술정보통신부|국토교통부|환경부|기획재정부|보건복지부|교육부|법무부|국방부|외교부|통일부|산업통상자원부|농림축산식품부|문화체육관광부|고용노동부|여성가족부|해양수산부|중소벤처기업부|국무조정실)/g) ?? [];
  for (const match of [...new Set(orgPatterns)]) {
    entities.push({
      id: `${documentId}_org_${idCounter++}`,
      type: 'organization',
      name: match,
      metadata: {},
      documentId,
    });
  }

  return { entities, relations: [], tokensUsed: 0 };
}

/**
 * 추출된 엔티티/관계를 지식 그래프에 저장
 */
export function addToKnowledgeGraph(
  tenantId: string,
  result: ExtractionResult,
): void {
  const graph = getOrCreateGraph(tenantId);

  for (const entity of result.entities) {
    graph.addNode(entity);
  }

  for (const relation of result.relations) {
    graph.addEdge(relation);
  }
}
