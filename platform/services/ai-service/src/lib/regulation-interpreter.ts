// AI 법령/규정 자동 해석 엔진 -- FR-N267.1~FR-N267.6
// Design Ref: MTU-N267 DESIGN §1~§6
// CSAP: D-06 감사, D-08 접근 통제, D-12 개발 보안
// N2SF: 법령 텍스트 = O등급 (공개 데이터)

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 법령 구조 단위 -- Design §1 */
export type ArticleLevel = 'act' | 'chapter' | 'section' | 'article' | 'paragraph' | 'subparagraph' | 'item';

/** 조문 노드 -- Design §1 */
export interface ArticleNode {
  id: string;
  level: ArticleLevel;
  number: string;
  title: string;
  content: string;
  children: ArticleNode[];
  references: ArticleReference[];
  keywords: string[];
}

/** 조문 참조 관계 -- Design §2 */
export interface ArticleReference {
  sourceId: string;
  targetId: string;
  targetAct?: string;
  referenceText: string;
  type: 'internal' | 'external';
}

/** 법령 문서 */
export interface RegulationDocument {
  id: string;
  title: string;
  enactedDate: string;
  lastAmendedDate: string;
  articles: ArticleNode[];
  indexedAt: string;
}

/** 검색 결과 -- Design §3 */
export interface RegulationSearchResult {
  article: ArticleNode;
  regulationTitle: string;
  relevanceScore: number;
  matchedKeywords: string[];
}

/** 해석 결과 -- Design §4 */
export interface RegulationInterpretation {
  id: string;
  query: string;
  relatedArticles: RegulationSearchResult[];
  interpretation: string;
  applicationGuide: string;
  disclaimer: string;
  createdAt: string;
  createdBy: string;
}

/** 개정 변경 분석 -- Design §5 */
export interface AmendmentAnalysis {
  id: string;
  regulationId: string;
  oldVersion: ArticleNode;
  newVersion: ArticleNode;
  changeType: 'added' | 'modified' | 'deleted';
  impactSummary: string;
  affectedSystems: string[];
  analyzedAt: string;
}

/** 감사 항목 */
export interface RegulationAuditEntry {
  id: string;
  action: string;
  actor: string;
  query?: string;
  regulationId?: string;
  timestamp: string;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: RegulationAuditEntry[] = [];

function recordAudit(
  action: string,
  actor: string,
  details?: { query?: string; regulationId?: string }
): void {
  auditLog.push({
    id: randomUUID(),
    action,
    actor,
    query: details?.query,
    regulationId: details?.regulationId,
    timestamp: new Date().toISOString(),
  });
}

export function getRegulationAuditLog(): RegulationAuditEntry[] {
  return [...auditLog];
}

// -- 법령 저장소 ──────────────────────────────────────────────────────────────

const regulations = new Map<string, RegulationDocument>();

// -- §1 법령 구조화 파싱 ─────────────────────────────────────────────────────

/** 조문 번호 패턴 */
const ARTICLE_PATTERNS: { level: ArticleLevel; pattern: RegExp }[] = [
  { level: 'chapter', pattern: /^제(\d+)장\s+(.+)$/ },
  { level: 'section', pattern: /^제(\d+)절\s+(.+)$/ },
  { level: 'article', pattern: /^제(\d+)조(?:\((.+)\))?\s*(.*)$/ },
  { level: 'paragraph', pattern: /^[①-⑳⑴-⒇]\s*(.+)$/ },
  { level: 'subparagraph', pattern: /^(\d+)\.\s+(.+)$/ },
  { level: 'item', pattern: /^[가-하]\.\s+(.+)$/ },
];

/** 법령 텍스트 파싱 -- FR-N267.1 */
export function parseRegulation(params: {
  title: string;
  text: string;
  enactedDate: string;
  lastAmendedDate: string;
  actor: string;
}): RegulationDocument {
  const lines = params.text.split('\n').map((l) => l.trim()).filter(Boolean);
  const articles: ArticleNode[] = [];
  const stack: ArticleNode[] = [];

  for (const line of lines) {
    const node = parseLine(line);
    if (!node) continue;

    // 스택 기반 계층 구조 구축
    while (stack.length > 0 && getLevelDepth(stack[stack.length - 1]!.level) >= getLevelDepth(node.level)) {
      stack.pop();
    }

    if (stack.length > 0) {
      stack[stack.length - 1]!.children.push(node);
    } else {
      articles.push(node);
    }
    stack.push(node);
  }

  const doc: RegulationDocument = {
    id: randomUUID(),
    title: params.title,
    enactedDate: params.enactedDate,
    lastAmendedDate: params.lastAmendedDate,
    articles,
    indexedAt: new Date().toISOString(),
  };

  regulations.set(doc.id, doc);

  // 참조 관계 추출
  extractReferences(doc);

  recordAudit('REGULATION_PARSED', params.actor, { regulationId: doc.id });
  return doc;
}

/** 라인 파싱 */
function parseLine(line: string): ArticleNode | null {
  for (const { level, pattern } of ARTICLE_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return {
        id: randomUUID(),
        level,
        number: match[1] || '',
        title: match[2] || '',
        content: line,
        children: [],
        references: [],
        keywords: extractKeywords(line),
      };
    }
  }
  return null;
}

/** 레벨 깊이 */
function getLevelDepth(level: ArticleLevel): number {
  const depths: Record<ArticleLevel, number> = {
    act: 0, chapter: 1, section: 2, article: 3,
    paragraph: 4, subparagraph: 5, item: 6,
  };
  return depths[level];
}

/** 키워드 추출 */
function extractKeywords(text: string): string[] {
  // 한국어 명사 패턴 간이 추출 (2자 이상)
  const words = text.match(/[가-힣]{2,}/g) || [];
  const stopWords = new Set(['경우', '따른', '대한', '것을', '있는', '하는', '또는', '및', '위한']);
  return [...new Set(words.filter((w) => !stopWords.has(w)))];
}

// -- §2 참조 관계 추출 ────────────────────────────────────────────────────────

/** 참조 패턴 */
const REFERENCE_PATTERN = /제(\d+)조(?:제(\d+)항)?/g;

/** 조문 간 참조 관계 추출 -- FR-N267.2 */
function extractReferences(doc: RegulationDocument): void {
  const allArticles = flattenArticles(doc.articles);
  const articleMap = new Map(allArticles.map((a) => [`${a.level}-${a.number}`, a]));

  for (const article of allArticles) {
    const matches = article.content.matchAll(REFERENCE_PATTERN);
    for (const match of matches) {
      const targetKey = `article-${match[1]}`;
      const target = articleMap.get(targetKey);
      if (target && target.id !== article.id) {
        article.references.push({
          sourceId: article.id,
          targetId: target.id,
          referenceText: match[0],
          type: 'internal',
        });
      }
    }
  }
}

/** 조문 트리 평탄화 */
function flattenArticles(articles: ArticleNode[]): ArticleNode[] {
  const result: ArticleNode[] = [];
  for (const article of articles) {
    result.push(article);
    result.push(...flattenArticles(article.children));
  }
  return result;
}

// -- §3 관련 조문 검색 ────────────────────────────────────────────────────────

/** 자연어 질의 기반 관련 조문 검색 -- FR-N267.3 */
export function searchRegulations(
  query: string,
  actor: string,
  limit: number = 10
): RegulationSearchResult[] {
  const queryKeywords = extractKeywords(query);
  const results: RegulationSearchResult[] = [];

  for (const [, doc] of regulations) {
    const allArticles = flattenArticles(doc.articles);

    for (const article of allArticles) {
      const matchedKeywords = article.keywords.filter((kw) =>
        queryKeywords.some((qk) => kw.includes(qk) || qk.includes(kw))
      );

      if (matchedKeywords.length > 0) {
        const relevanceScore = matchedKeywords.length / Math.max(queryKeywords.length, 1);
        results.push({
          article,
          regulationTitle: doc.title,
          relevanceScore: Math.min(1, relevanceScore),
          matchedKeywords,
        });
      }
    }
  }

  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  recordAudit('REGULATION_SEARCH', actor, { query });
  return results.slice(0, limit);
}

// -- §4 AI 해석 생성 ──────────────────────────────────────────────────────────

/** AI 기반 법령 해석 생성 -- FR-N267.4 */
export function generateInterpretation(
  query: string,
  actor: string
): RegulationInterpretation {
  const relatedArticles = searchRegulations(query, actor, 5);

  // 관련 조문 기반 해석 생성 (규칙 기반 + 구조화)
  const firstArticle = relatedArticles[0];

  const interpretation = relatedArticles.length > 0 && firstArticle
    ? `질의 "${query}"에 대해 ${relatedArticles.length}개의 관련 조문이 검색되었습니다. ` +
      `주요 근거 조문: ${firstArticle.article.content.substring(0, 100)}... ` +
      `해당 조문은 ${firstArticle.matchedKeywords.join(', ')} 키워드와 관련됩니다.`
    : `질의 "${query}"에 대한 직접 관련 조문을 찾을 수 없습니다. 유사 검색어로 재시도하십시오.`;

  const applicationGuide = relatedArticles.length > 0 && firstArticle
    ? `적용 가이드: 해당 규정은 ${firstArticle.regulationTitle}에 근거하며, ` +
      `관련 조문 ${relatedArticles.length}건을 종합하여 검토가 필요합니다.`
    : '적용 가이드를 생성하기 위한 관련 조문이 부족합니다.';

  const result: RegulationInterpretation = {
    id: randomUUID(),
    query,
    relatedArticles,
    interpretation,
    applicationGuide,
    disclaimer: '본 해석은 AI에 의해 자동 생성된 참고 자료이며, 법적 효력이 없습니다. ' +
      '정확한 해석은 관련 법령 전문가와 상의하십시오.',
    createdAt: new Date().toISOString(),
    createdBy: actor,
  };

  recordAudit('INTERPRETATION_GENERATED', actor, { query });
  return result;
}

// -- §5 개정 영향 분석 ────────────────────────────────────────────────────────

/** 법령 개정 변경 영향 분석 -- FR-N267.5 */
export function analyzeAmendment(
  regulationId: string,
  oldArticle: ArticleNode,
  newArticle: ArticleNode,
  actor: string
): AmendmentAnalysis {
  let changeType: AmendmentAnalysis['changeType'];
  if (!oldArticle.content && newArticle.content) {
    changeType = 'added';
  } else if (oldArticle.content && !newArticle.content) {
    changeType = 'deleted';
  } else {
    changeType = 'modified';
  }

  // 키워드 변경 분석
  const oldKeywords = new Set(oldArticle.keywords);
  const newKeywords = new Set(newArticle.keywords);
  const addedKeywords = [...newKeywords].filter((k) => !oldKeywords.has(k));
  const removedKeywords = [...oldKeywords].filter((k) => !newKeywords.has(k));

  const impactSummary =
    `변경 유형: ${changeType}. ` +
    `추가 키워드: ${addedKeywords.join(', ') || '없음'}. ` +
    `삭제 키워드: ${removedKeywords.join(', ') || '없음'}.`;

  // 영향 시스템 식별 (키워드 기반)
  const systemKeywordMap: Record<string, string[]> = {
    '접근통제': ['인증', '권한', '접근', '로그인'],
    '데이터보호': ['암호', '개인정보', '보호', '마스킹'],
    '감사로깅': ['감사', '로그', '기록', '추적'],
    '인프라': ['서버', '네트워크', '시스템', '인프라'],
  };

  const affectedSystems: string[] = [];
  const allChangedKeywords = [...addedKeywords, ...removedKeywords];
  for (const [system, keywords] of Object.entries(systemKeywordMap)) {
    if (keywords.some((kw) => allChangedKeywords.some((ck) => ck.includes(kw)))) {
      affectedSystems.push(system);
    }
  }

  const analysis: AmendmentAnalysis = {
    id: randomUUID(),
    regulationId,
    oldVersion: oldArticle,
    newVersion: newArticle,
    changeType,
    impactSummary,
    affectedSystems,
    analyzedAt: new Date().toISOString(),
  };

  recordAudit('AMENDMENT_ANALYZED', actor, { regulationId });
  return analysis;
}

// -- 조회 ────────────────────────────────────────────────────────────────────

/** 법령 문서 조회 */
export function getRegulation(id: string): RegulationDocument | undefined {
  return regulations.get(id);
}

/** 법령 목록 조회 */
export function listRegulations(): RegulationDocument[] {
  return Array.from(regulations.values());
}
