// 임베딩 파이프라인 관리 — FR-ADV24.1~24.6
// Design Ref: SVC-AI-ADV-R24 DESIGN §1~§5
// Plan SC: SC-1 (파이프라인), SC-2 (청크 전략), SC-3 (모델 관리), SC-4 (증분)
// CSAP: D-09 벡터 암호화, D-06 파이프라인 감사 로깅
// N2SF: N-05 O등급 데이터만 임베딩

import { createHash } from 'node:crypto';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 청크 전략 — Design §2 */
export type ChunkStrategy = 'fixed' | 'semantic' | 'recursive';

/** 문서 항목 */
export interface DocumentItem {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  source: string;
  updatedAt: string;
}

/** 청크 결과 */
export interface ChunkResult {
  id: string;
  documentId: string;
  content: string;
  index: number;
  tokenCount: number;
  contentHash: string;
}

/** 임베딩 모델 정보 — Design §3 */
export interface EmbeddingModel {
  id: string;
  name: string;
  dimensions: number;
  maxTokens: number;
  provider: string;
  isActive: boolean;
}

/** 파이프라인 단계 결과 */
export interface PipelineStageResult {
  stage: string;
  inputCount: number;
  outputCount: number;
  failedCount: number;
  durationMs: number;
}

/** 파이프라인 실행 결과 — Design §1 */
export interface PipelineResult {
  pipelineId: string;
  stages: PipelineStageResult[];
  totalDocuments: number;
  totalChunks: number;
  newChunks: number;
  updatedChunks: number;
  skippedChunks: number;
  totalDurationMs: number;
  timestamp: string;
}

// ── 콘텐츠 해시 ────────────────────────────────────────────────────────────

/** SHA-256 콘텐츠 해시 — Design §4 */
export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ── 청크 전략 — Design §2 ──────────────────────────────────────────────────

/** 토큰 수 추정 */
function estimateTokens(text: string): number {
  const koreanChars = (text.match(/[\u3131-\uD79D]/g) ?? []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars * 2 + otherChars * 0.4);
}

/** 고정 크기 청크 */
export function fixedChunk(documentId: string, content: string, maxTokens = 512): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  const sentences = content.split(/(?<=[.!?。\n])\s*/);
  let currentChunk = '';
  let currentTokens = 0;
  let index = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);
    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      chunks.push({
        id: `${documentId}-c${index}`,
        documentId,
        content: currentChunk.trim(),
        index,
        tokenCount: currentTokens,
        contentHash: contentHash(currentChunk),
      });
      index++;
      currentChunk = '';
      currentTokens = 0;
    }
    currentChunk += sentence + ' ';
    currentTokens += sentenceTokens;
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: `${documentId}-c${index}`,
      documentId,
      content: currentChunk.trim(),
      index,
      tokenCount: currentTokens,
      contentHash: contentHash(currentChunk),
    });
  }

  return chunks;
}

/** 시맨틱 청크 (문단/섹션 경계 기반) */
export function semanticChunk(documentId: string, content: string, maxTokens = 1024): ChunkResult[] {
  // 문단 경계: 2줄 이상 빈 줄 또는 제목(# 시작)
  const paragraphs = content.split(/\n{2,}|(?=^#{1,3}\s)/m).filter((p) => p.trim().length > 0);
  const chunks: ChunkResult[] = [];
  let currentChunk = '';
  let currentTokens = 0;
  let index = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);
    if (currentTokens + paraTokens > maxTokens && currentChunk.length > 0) {
      chunks.push({
        id: `${documentId}-s${index}`,
        documentId,
        content: currentChunk.trim(),
        index,
        tokenCount: currentTokens,
        contentHash: contentHash(currentChunk),
      });
      index++;
      currentChunk = '';
      currentTokens = 0;
    }
    currentChunk += para + '\n\n';
    currentTokens += paraTokens;
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: `${documentId}-s${index}`,
      documentId,
      content: currentChunk.trim(),
      index,
      tokenCount: currentTokens,
      contentHash: contentHash(currentChunk),
    });
  }

  return chunks;
}

/** 재귀 청크 (큰 청크 → 작은 청크로 분할) */
export function recursiveChunk(documentId: string, content: string, maxTokens = 512): ChunkResult[] {
  const tokens = estimateTokens(content);
  if (tokens <= maxTokens) {
    return [{
      id: `${documentId}-r0`,
      documentId,
      content: content.trim(),
      index: 0,
      tokenCount: tokens,
      contentHash: contentHash(content),
    }];
  }

  // 큰 구분자부터 시도: \n\n → \n → 문장 → 공백
  const separators = ['\n\n', '\n', '. ', ' '];
  for (const sep of separators) {
    const parts = content.split(sep).filter((p) => p.trim().length > 0);
    if (parts.length > 1) {
      const chunks: ChunkResult[] = [];
      let idx = 0;
      for (const part of parts) {
        const subChunks = recursiveChunk(`${documentId}-r${idx}`, part, maxTokens);
        for (const sc of subChunks) {
          chunks.push({ ...sc, index: chunks.length });
        }
        idx++;
      }
      return chunks;
    }
  }

  // 분할 불가: 강제 잘라내기
  const halfLen = Math.floor(content.length / 2);
  const first = recursiveChunk(`${documentId}-r0`, content.slice(0, halfLen), maxTokens);
  const second = recursiveChunk(`${documentId}-r1`, content.slice(halfLen), maxTokens);
  return [...first, ...second].map((c, i) => ({ ...c, index: i }));
}

/** 전략별 청크 실행 */
export function chunkDocument(
  documentId: string,
  content: string,
  strategy: ChunkStrategy,
  maxTokens = 512,
): ChunkResult[] {
  switch (strategy) {
    case 'fixed': return fixedChunk(documentId, content, maxTokens);
    case 'semantic': return semanticChunk(documentId, content, maxTokens);
    case 'recursive': return recursiveChunk(documentId, content, maxTokens);
  }
}

// ── 임베딩 모델 레지스트리 — Design §3 ─────────────────────────────────────

/** 임베딩 모델 레지스트리 */
export class EmbeddingModelRegistry {
  private readonly models: Map<string, EmbeddingModel> = new Map();

  /** 모델 등록 */
  register(model: EmbeddingModel): void {
    this.models.set(model.id, model);
  }

  /** 활성 모델 조회 */
  getActive(): EmbeddingModel | undefined {
    for (const model of this.models.values()) {
      if (model.isActive) return model;
    }
    return undefined;
  }

  /** 모델 활성화 (이전 활성 모델 비활성화) */
  activate(modelId: string): boolean {
    const target = this.models.get(modelId);
    if (!target) return false;

    for (const model of this.models.values()) {
      model.isActive = false;
    }
    target.isActive = true;
    return true;
  }

  /** 모델 목록 */
  list(): EmbeddingModel[] {
    return [...this.models.values()];
  }

  /** 모델 수 */
  get size(): number {
    return this.models.size;
  }
}

// ── 증분 업데이트 — Design §4 ──────────────────────────────────────────────

/** 문서 해시 인덱스 (변경 감지용) */
export class DocumentHashIndex {
  private readonly hashes: Map<string, string> = new Map();

  /** 문서 변경 여부 확인 */
  hasChanged(documentId: string, content: string): boolean {
    const newHash = contentHash(content);
    const existingHash = this.hashes.get(documentId);
    return existingHash !== newHash;
  }

  /** 해시 업데이트 */
  update(documentId: string, content: string): void {
    this.hashes.set(documentId, contentHash(content));
  }

  /** 문서 해시 삭제 */
  remove(documentId: string): boolean {
    return this.hashes.delete(documentId);
  }

  /** 인덱스 크기 */
  get size(): number {
    return this.hashes.size;
  }
}

// ── 파이프라인 실행기 — Design §1 ──────────────────────────────────────────

/**
 * 임베딩 파이프라인 실행
 * ingest → preprocess → chunk → embed → store
 */
export async function runEmbeddingPipeline(
  documents: DocumentItem[],
  strategy: ChunkStrategy,
  hashIndex: DocumentHashIndex,
  embedFn: (texts: string[]) => Promise<number[][]>,
  storeFn: (chunks: Array<{ id: string; content: string; embedding: number[]; metadata: Record<string, unknown> }>) => Promise<void>,
): Promise<PipelineResult> {
  const startTime = Date.now();
  const stages: PipelineStageResult[] = [];

  // Stage 1: 변경 감지 (증분 처리)
  const stage1Start = Date.now();
  const changedDocs = documents.filter((doc) => hashIndex.hasChanged(doc.id, doc.content));
  stages.push({
    stage: 'ingest',
    inputCount: documents.length,
    outputCount: changedDocs.length,
    failedCount: 0,
    durationMs: Date.now() - stage1Start,
  });

  // Stage 2: 청크
  const stage2Start = Date.now();
  const allChunks: ChunkResult[] = [];
  for (const doc of changedDocs) {
    const chunks = chunkDocument(doc.id, doc.content, strategy);
    allChunks.push(...chunks);
  }
  stages.push({
    stage: 'chunk',
    inputCount: changedDocs.length,
    outputCount: allChunks.length,
    failedCount: 0,
    durationMs: Date.now() - stage2Start,
  });

  // Stage 3: 임베딩
  const stage3Start = Date.now();
  const texts = allChunks.map((c) => c.content);
  let embeddings: number[][] = [];
  let embedFailed = 0;
  try {
    embeddings = await embedFn(texts);
  } catch {
    embedFailed = texts.length;
  }
  stages.push({
    stage: 'embed',
    inputCount: texts.length,
    outputCount: embeddings.length,
    failedCount: embedFailed,
    durationMs: Date.now() - stage3Start,
  });

  // Stage 4: 저장
  const stage4Start = Date.now();
  if (embeddings.length > 0) {
    const storeItems = allChunks.slice(0, embeddings.length).map((chunk, i) => ({
      id: chunk.id,
      content: chunk.content,
      embedding: embeddings[i] ?? [],
      metadata: { documentId: chunk.documentId, index: chunk.index },
    }));
    await storeFn(storeItems);
  }
  stages.push({
    stage: 'store',
    inputCount: embeddings.length,
    outputCount: embeddings.length,
    failedCount: 0,
    durationMs: Date.now() - stage4Start,
  });

  // 해시 업데이트
  for (const doc of changedDocs) {
    hashIndex.update(doc.id, doc.content);
  }

  return {
    pipelineId: `pipe-${Date.now()}`,
    stages,
    totalDocuments: documents.length,
    totalChunks: allChunks.length,
    newChunks: allChunks.length,
    updatedChunks: 0,
    skippedChunks: documents.length - changedDocs.length,
    totalDurationMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}
