// Multi-Modal RAG — FR-R69.1~R69.5
// Design Ref: SVC-AI-ADV-R69 DESIGN §모듈
// Plan SC: 텍스트+이미지+OCR 퓨전 랭킹
// CSAP: D-06 감사 / D-12 입력검증
// N2SF: N-05 등급 (EXIF GPS 차단)

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type DataGrade = 'C' | 'S' | 'O';
export type Modality = 'text' | 'image' | 'ocr';

export interface ImageMeta {
  width: number;
  height: number;
  hasExifGps: boolean;
  source: string;
}

export interface MultiModalDoc {
  id: string;
  modality: Modality;
  title: string;
  text?: string;
  imageMeta?: ImageMeta;
  grade: DataGrade;
  tags: string[];
}

export interface QueryOpts {
  text: string;
  modalities?: Modality[];
  topK: number;
  weights?: Partial<Record<Modality, number>>;
  fusion?: 'weighted' | 'rrf';
}

export interface FusionSourceEntry {
  modality: Modality;
  score: number;
  rank: number;
}

export interface FusionResult {
  docId: string;
  modality: Modality;
  score: number;
  sources: FusionSourceEntry[];
  title: string;
}

export type MMRAGAuditAction =
  | 'DOC_ADD'
  | 'DOC_BLOCK_GRADE'
  | 'DOC_BLOCK_EXIF'
  | 'QUERY'
  | 'GRADE_BLOCK';

export interface MMRAGAuditEntry {
  timestamp: string;
  action: MMRAGAuditAction;
  docId?: string;
  reason?: string;
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.!?;:()\[\]{}"']+/u)
    .filter((t) => t.length > 0);
}

function scoreText(query: string, text: string): number {
  const q = tokenize(query);
  const t = tokenize(text);
  if (q.length === 0 || t.length === 0) return 0;
  const tset = new Set(t);
  let hit = 0;
  for (const tok of q) if (tset.has(tok)) hit += 1;
  return hit / Math.sqrt(t.length + 1);
}

// ── 메인 클래스 ──────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: Record<Modality, number> = {
  text: 0.5,
  image: 0.3,
  ocr: 0.2,
};

export class MultiModalRAG {
  private readonly docs = new Map<string, MultiModalDoc>();
  private readonly byModality = new Map<Modality, MultiModalDoc[]>();
  private readonly audit: MMRAGAuditEntry[] = [];

  public constructor() {
    this.byModality.set('text', []);
    this.byModality.set('image', []);
    this.byModality.set('ocr', []);
  }

  public addDocument(doc: MultiModalDoc): void {
    if (doc.grade !== 'O') {
      this.record('DOC_BLOCK_GRADE', {
        docId: doc.id,
        reason: `grade:${doc.grade}`,
      });
      throw new Error('MMRAG_GRADE_BLOCKED');
    }
    if (doc.modality === 'image' && doc.imageMeta?.hasExifGps) {
      this.record('DOC_BLOCK_EXIF', { docId: doc.id, reason: 'exif-gps' });
      throw new Error('MMRAG_EXIF_BLOCKED');
    }
    this.docs.set(doc.id, doc);
    const list = this.byModality.get(doc.modality) ?? [];
    list.push(doc);
    this.byModality.set(doc.modality, list);
    this.record('DOC_ADD', { docId: doc.id });
  }

  public query(opts: QueryOpts): FusionResult[] {
    const modalities: Modality[] = opts.modalities ?? ['text', 'image', 'ocr'];
    const weights: Record<Modality, number> = {
      ...DEFAULT_WEIGHTS,
      ...(opts.weights ?? {}),
    };
    const fusion = opts.fusion ?? 'weighted';

    // 모달별 ranked list 생성
    const rankedByModality = new Map<Modality, { doc: MultiModalDoc; score: number; rank: number }[]>();
    for (const m of modalities) {
      const docs = this.byModality.get(m) ?? [];
      const scored = docs
        .map((d) => ({
          doc: d,
          score: this.scoreDoc(opts.text, d),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x, idx) => ({ ...x, rank: idx + 1 }));
      rankedByModality.set(m, scored);
    }

    // 퓨전
    const fused = new Map<string, FusionResult>();
    for (const [m, list] of rankedByModality.entries()) {
      const w = weights[m] ?? 0;
      for (const entry of list) {
        const contribution =
          fusion === 'rrf' ? w * (1 / (60 + entry.rank)) : w * entry.score;
        const existing = fused.get(entry.doc.id);
        if (existing) {
          existing.score += contribution;
          existing.sources.push({
            modality: m,
            score: entry.score,
            rank: entry.rank,
          });
        } else {
          fused.set(entry.doc.id, {
            docId: entry.doc.id,
            modality: entry.doc.modality,
            title: entry.doc.title,
            score: contribution,
            sources: [{ modality: m, score: entry.score, rank: entry.rank }],
          });
        }
      }
    }

    const results = [...fused.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.topK);
    this.record('QUERY', { reason: `topK:${opts.topK}` });
    return results;
  }

  public getDocumentCount(): number {
    return this.docs.size;
  }

  public getAuditLog(): MMRAGAuditEntry[] {
    return [...this.audit];
  }

  private scoreDoc(query: string, doc: MultiModalDoc): number {
    if (doc.modality === 'text' || doc.modality === 'ocr') {
      return scoreText(query, doc.text ?? '');
    }
    // image: title + tags + source 기반
    const bag = [
      doc.title,
      doc.tags.join(' '),
      doc.imageMeta?.source ?? '',
    ].join(' ');
    return scoreText(query, bag);
  }

  private record(
    action: MMRAGAuditAction,
    extra: Partial<MMRAGAuditEntry> = {},
  ): void {
    this.audit.push({
      timestamp: new Date().toISOString(),
      action,
      ...extra,
    });
  }
}
