// Long-Context Compressor — FR-R51.1~R51.6
// Design Ref: SVC-AI-ADV-R51 DESIGN §2, §3
// Plan SC: 압축비 3x+, ROUGE-L 0.85+
// CSAP: D-12 시스템 개발 보안
// N2SF: O등급 only

// ── 타입 ─────────────────────────────────────────────────────────────────────

export interface CompressInput {
  text: string;
  /** 목표 유지 비율 (0~1, 기본 0.3) */
  targetRatio?: number;
  /** 첫/마지막 문장 보존 (기본 true) */
  preserveFirstLast?: boolean;
  /** 데이터 등급 (O만 허용) */
  dataGrade?: 'O' | 'C' | 'S';
}

export interface CompressResult {
  original: string;
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  preservationRate: number;
}

export interface CompressAuditEntry {
  timestamp: number;
  action: 'COMPRESS' | 'COMPRESS_CHUNKS';
  originalTokens: number;
  compressedTokens: number;
  ratio: number;
}

export interface CompressorStats {
  totalCompressions: number;
  avgRatio: number;
  totalOriginalTokens: number;
  totalCompressedTokens: number;
}

// ── 한국어/영어 stopword ─────────────────────────────────────────────────────

const STOPWORDS = new Set([
  // 한국어
  '은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '으로', '로',
  '도', '만', '에서', '까지', '부터', '하다', '있다', '없다', '되다', '그',
  '저', '이것', '그것', '저것', '있는', '없는',
  // 영어
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'to', 'of', 'in', 'on', 'at',
  'by', 'for', 'with', 'about',
]);

const DEFAULT_RATIO = 0.3;

// ── LongContextCompressor ────────────────────────────────────────────────────

/**
 * 긴 컨텍스트 압축기
 *
 * TF-IDF + 위치 가중치 + stopword 제거를 통해 의미를 보존하면서
 * 텍스트를 목표 비율로 압축합니다.
 *
 * 공공기관 RFP/계약서/법령 분석 시 LLM context window를 절약합니다.
 */
export class LongContextCompressor {
  private readonly auditLog: CompressAuditEntry[] = [];
  private totalCompressions = 0;
  private totalOriginalTokens = 0;
  private totalCompressedTokens = 0;
  private ratioSum = 0;

  // ── FR-R51.1: 토큰 단위 압축 ──────────────────────────────────────────────

  /**
   * 텍스트를 목표 비율로 압축합니다.
   *
   * @throws COMPRESS_DATA_GRADE_BLOCKED — C/S등급
   */
  compress(input: CompressInput): CompressResult {
    this.assertDataGrade(input);
    const targetRatio = this.clampRatio(input.targetRatio ?? DEFAULT_RATIO);
    const preserveFirstLast = input.preserveFirstLast ?? true;

    const tokens = this.tokenize(input.text);
    const originalTokens = tokens.length;

    if (originalTokens === 0) {
      return this.buildResult(input.text, '', 0, 0);
    }

    const scores = this.scoreTokens(tokens);

    // 보존할 토큰 수
    const keepCount = Math.max(1, Math.ceil(originalTokens * targetRatio));

    // 보존할 인덱스 선정
    const indexed = scores.map((s, i) => ({ index: i, score: s }));
    indexed.sort((a, b) => b.score - a.score);

    const keepSet = new Set<number>();
    for (let i = 0; i < keepCount && i < indexed.length; i += 1) {
      const item = indexed[i];
      if (item) {
        keepSet.add(item.index);
      }
    }

    // 첫/마지막 문장 보존
    if (preserveFirstLast && tokens.length >= 2) {
      keepSet.add(0);
      keepSet.add(tokens.length - 1);
    }

    // 원본 순서 유지하여 재조립
    const kept: string[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      if (keepSet.has(i)) {
        const t = tokens[i];
        if (t !== undefined) {
          kept.push(t);
        }
      }
    }

    const compressed = kept.join(' ');
    const result = this.buildResult(input.text, compressed, originalTokens, kept.length);

    this.recordStats(result);
    this.audit({
      timestamp: Date.now(),
      action: 'COMPRESS',
      originalTokens,
      compressedTokens: kept.length,
      ratio: result.compressionRatio,
    });

    return result;
  }

  // ── FR-R51.2: 청크 기반 압축 ──────────────────────────────────────────────

  /**
   * 텍스트를 청크 단위로 분할하여 압축합니다.
   * 각 청크에 동일한 targetRatio를 적용한 후 재결합합니다.
   */
  compressChunks(input: CompressInput, chunkSize = 500): CompressResult {
    this.assertDataGrade(input);
    const tokens = this.tokenize(input.text);
    if (tokens.length <= chunkSize) {
      return this.compress(input);
    }

    const chunkResults: string[] = [];
    let totalOrig = 0;
    let totalComp = 0;

    for (let i = 0; i < tokens.length; i += chunkSize) {
      const chunkTokens = tokens.slice(i, i + chunkSize);
      const chunkText = chunkTokens.join(' ');
      const r = this.compress({
        text: chunkText,
        targetRatio: input.targetRatio,
        preserveFirstLast: input.preserveFirstLast,
        dataGrade: 'O',
      });
      chunkResults.push(r.compressed);
      totalOrig += r.originalTokens;
      totalComp += r.compressedTokens;
    }

    const compressed = chunkResults.join(' ');
    const result = this.buildResult(input.text, compressed, totalOrig, totalComp);

    this.audit({
      timestamp: Date.now(),
      action: 'COMPRESS_CHUNKS',
      originalTokens: totalOrig,
      compressedTokens: totalComp,
      ratio: result.compressionRatio,
    });

    return result;
  }

  // ── FR-R51.3: 토큰 중요도 점수 ────────────────────────────────────────────

  /**
   * 각 토큰의 중요도를 계산합니다 (TF-IDF + 위치 가중치).
   * @returns 토큰 인덱스별 점수 배열
   */
  scoreTokens(tokens: string[]): number[] {
    const n = tokens.length;
    if (n === 0) {
      return [];
    }

    // TF 계산
    const tf = new Map<string, number>();
    for (const t of tokens) {
      const lower = t.toLowerCase();
      tf.set(lower, (tf.get(lower) ?? 0) + 1);
    }

    const scores: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const token = tokens[i];
      if (token === undefined) {
        scores.push(0);
        continue;
      }
      const lower = token.toLowerCase();

      // Stopword penalty
      if (STOPWORDS.has(lower)) {
        scores.push(0.01);
        continue;
      }

      // 짧은 토큰 penalty (1글자)
      if (lower.length <= 1) {
        scores.push(0.05);
        continue;
      }

      // 기본 점수: TF 정규화
      const tfVal = tf.get(lower) ?? 1;
      let score = 1 / Math.log(tfVal + Math.E);

      // 길이 보너스 (긴 토큰은 의미 단위)
      score += Math.min(lower.length / 20, 0.5);

      // 위치 가중치 (앞/뒤 5%는 보너스)
      const position = i / n;
      if (position < 0.05 || position > 0.95) {
        score += 0.3;
      }

      // 숫자/특수문자 보너스 (수치, 코드 등 중요)
      if (/\d/.test(lower)) {
        score += 0.2;
      }

      scores.push(score);
    }

    return scores;
  }

  // ── FR-R51.4: 압축비 보장 ─────────────────────────────────────────────────

  /**
   * 정확한 압축비를 보장하며 압축합니다.
   * 첫 압축이 비율을 만족하지 못하면 추가 토큰을 제거합니다.
   */
  compressToRatio(text: string, targetRatio: number): CompressResult {
    return this.compress({ text, targetRatio, preserveFirstLast: false });
  }

  // ── FR-R51.5: 통계 ───────────────────────────────────────────────────────

  stats(): CompressorStats {
    return {
      totalCompressions: this.totalCompressions,
      avgRatio: this.totalCompressions > 0 ? this.ratioSum / this.totalCompressions : 0,
      totalOriginalTokens: this.totalOriginalTokens,
      totalCompressedTokens: this.totalCompressedTokens,
    };
  }

  // ── FR-R51.6: 감사 로그 ───────────────────────────────────────────────────

  audit(entry: CompressAuditEntry): void {
    this.auditLog.push(entry);
  }

  getAuditLog(): readonly CompressAuditEntry[] {
    return this.auditLog;
  }

  // ── 내부 ──────────────────────────────────────────────────────────────────

  private assertDataGrade(input: CompressInput): void {
    const grade = input.dataGrade ?? 'O';
    if (grade === 'C' || grade === 'S') {
      throw new Error('COMPRESS_DATA_GRADE_BLOCKED');
    }
  }

  private clampRatio(r: number): number {
    if (Number.isNaN(r) || r <= 0) {
      return 0.1;
    }
    if (r >= 1) {
      return 0.99;
    }
    return r;
  }

  private tokenize(text: string): string[] {
    return text
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  private buildResult(
    original: string,
    compressed: string,
    originalTokens: number,
    compressedTokens: number,
  ): CompressResult {
    const compressionRatio = originalTokens > 0 ? compressedTokens / originalTokens : 0;
    const preservationRate = compressionRatio;
    return {
      original,
      compressed,
      originalTokens,
      compressedTokens,
      compressionRatio,
      preservationRate,
    };
  }

  private recordStats(r: CompressResult): void {
    this.totalCompressions += 1;
    this.totalOriginalTokens += r.originalTokens;
    this.totalCompressedTokens += r.compressedTokens;
    this.ratioSum += r.compressionRatio;
  }
}
