// AI 지식 베이스 자동 구축 -- FR-N279.1~FR-N279.6
// Design Ref: MTU-N279 DESIGN §1~§6
// CSAP: D-06 감사, D-08 접근 통제, D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  sourceDocument: string;
  qualityScore: number;
  createdAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: Record<string, string>;
}

export interface QAResult {
  question: string;
  answer: string;
  relevantEntries: KnowledgeEntry[];
  confidence: number;
}

export interface QualityReport {
  totalEntries: number;
  avgQualityScore: number;
  lowQualityCount: number;
  categoryDistribution: Record<string, number>;
  reportedAt: string;
}

// -- 저장소/감사 ──────────────────────────────────────────────────────────────

const entries = new Map<string, KnowledgeEntry>();
const auditLog: { id: string; action: string; actor: string; timestamp: string }[] = [];

function recordAudit(action: string, actor: string): void {
  auditLog.push({ id: randomUUID(), action, actor, timestamp: new Date().toISOString() });
}

export function getKBauditLog() { return [...auditLog]; }

// -- §1 문서 청크 분할 ────────────────────────────────────────────────────────

export function splitIntoChunks(documentId: string, text: string, chunkSize: number = 500): DocumentChunk[] {
  const sentences = text.split(/[.!?。]\s*/);
  const chunks: DocumentChunk[] = [];
  let current = '';
  let index = 0;

  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize && current.length > 0) {
      chunks.push({
        id: randomUUID(),
        documentId,
        content: current.trim(),
        chunkIndex: index++,
        metadata: {},
      });
      current = '';
    }
    current += sentence + '. ';
  }

  if (current.trim()) {
    chunks.push({ id: randomUUID(), documentId, content: current.trim(), chunkIndex: index, metadata: {} });
  }

  return chunks;
}

// -- §2 지식 추출 (Q&A 쌍 생성) ──────────────────────────────────────────────

const QA_PATTERNS = [
  { pattern: /(.+?)[은는이가]\s*(.+?)(?:입니다|이다|한다|됩니다)/, qPrefix: '무엇' },
  { pattern: /(.+?)(?:하려면|하기 위해서는)\s*(.+?)(?:해야|필요)/, qPrefix: '어떻게' },
  { pattern: /(.+?)(?:경우|때)[에는]?\s*(.+?)(?:합니다|한다)/, qPrefix: '언제' },
];

export function extractKnowledge(
  chunks: DocumentChunk[],
  sourceDocument: string,
  category: string,
  actor: string
): KnowledgeEntry[] {
  const extracted: KnowledgeEntry[] = [];

  for (const chunk of chunks) {
    const sentences = chunk.content.split(/[.]\s*/);

    for (const sentence of sentences) {
      if (sentence.length < 20) continue;

      const entry: KnowledgeEntry = {
        id: randomUUID(),
        question: generateQuestion(sentence),
        answer: sentence.trim(),
        category,
        tags: extractTags(sentence),
        sourceDocument,
        qualityScore: calculateQualityScore(sentence),
        createdAt: new Date().toISOString(),
      };

      entries.set(entry.id, entry);
      extracted.push(entry);
    }
  }

  recordAudit('KNOWLEDGE_EXTRACTED', actor);
  return extracted;
}

function generateQuestion(sentence: string): string {
  for (const { pattern, qPrefix } of QA_PATTERNS) {
    const match = sentence.match(pattern);
    if (match) {
      return `${match[1]}${qPrefix === '무엇' ? '이란 무엇입니까?' : qPrefix === '어떻게' ? '은 어떻게 합니까?' : '은 언제입니까?'}`;
    }
  }
  return `${sentence.substring(0, 30)}에 대해 설명하십시오.`;
}

function extractTags(text: string): string[] {
  const words = text.match(/[가-힣]{2,}/g) || [];
  const stopWords = new Set(['경우', '위한', '대한', '것을', '있는', '하는', '또는', '때문', '합니다', '됩니다']);
  return [...new Set(words.filter((w) => !stopWords.has(w) && w.length >= 2))].slice(0, 5);
}

function calculateQualityScore(text: string): number {
  let score = 0.5;
  if (text.length >= 30) score += 0.1;
  if (text.length >= 50) score += 0.1;
  if (text.includes('필수') || text.includes('반드시')) score += 0.1;
  if (text.match(/\d/)) score += 0.1; // 수치 포함
  if (text.includes('예:') || text.includes('예시')) score += 0.1;
  return Math.min(1, score);
}

// -- §4 질의 응답 ────────────────────────────────────────────────────────────

export function queryKnowledgeBase(question: string, limit: number = 5): QAResult {
  const queryTags = extractTags(question);
  const scored: { entry: KnowledgeEntry; score: number }[] = [];

  for (const [, entry] of entries) {
    const commonTags = entry.tags.filter((t) => queryTags.some((qt) => t.includes(qt) || qt.includes(t)));
    const titleMatch = queryTags.some((qt) => entry.question.includes(qt)) ? 0.3 : 0;
    const score = (commonTags.length / Math.max(queryTags.length, 1)) * 0.7 + titleMatch;
    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.slice(0, limit).map((s) => s.entry);

  return {
    question,
    answer: relevant.length > 0 ? (relevant[0]?.answer ?? '해당 질문에 대한 답변을 찾을 수 없습니다.') : '해당 질문에 대한 답변을 찾을 수 없습니다.',
    relevantEntries: relevant,
    confidence: relevant.length > 0 ? (scored[0]?.score ?? 0) : 0,
  };
}

// -- §5 품질 검증 ────────────────────────────────────────────────────────────

export function generateQualityReport(): QualityReport {
  const allEntries = Array.from(entries.values());
  const categoryDist: Record<string, number> = {};
  let totalScore = 0;
  let lowQuality = 0;

  for (const entry of allEntries) {
    categoryDist[entry.category] = (categoryDist[entry.category] || 0) + 1;
    totalScore += entry.qualityScore;
    if (entry.qualityScore < 0.5) lowQuality++;
  }

  return {
    totalEntries: allEntries.length,
    avgQualityScore: allEntries.length > 0 ? totalScore / allEntries.length : 0,
    lowQualityCount: lowQuality,
    categoryDistribution: categoryDist,
    reportedAt: new Date().toISOString(),
  };
}

// -- 조회 ────────────────────────────────────────────────────────────────────

export function getEntry(id: string) { return entries.get(id); }
export function listEntries(category?: string): KnowledgeEntry[] {
  const all = Array.from(entries.values());
  return category ? all.filter((e) => e.category === category) : all;
}
