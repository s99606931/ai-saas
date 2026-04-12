// AI Output Watermarking Advanced — FR-R58.1~R58.6
// Design Ref: SVC-AI-ADV-R58 DESIGN §2, §3, §4
// Plan SC: 200토큰+ 검증 정확도 ≥ 95%, 오탐률 ≤ 5%
// CSAP: D-06 감사 / AI 기본법(2026) §23 투명성
// Kirchenbauer et al. (2023) 단순화 구현

import { createHash, createHmac } from 'node:crypto';

// ── 타입 ─────────────────────────────────────────────────────────────────────

export interface WatermarkConfig {
  vocabulary: string[];
  /** green 토큰 비율 (기본 0.5) */
  gamma?: number;
  /** logit bias (기본 2.0) */
  delta?: number;
  /** 검증 z-score 임계값 (기본 4.0) */
  zThreshold?: number;
  /** HMAC 시크릿. 미지정 시 env AI_WATERMARK_SECRET 사용 */
  secret?: string;
}

export interface DetectResult {
  watermarked: boolean;
  zScore: number;
  greenRatio: number;
  tokens: number;
}

export interface WatermarkAuditEntry {
  timestamp: number;
  action:
    | 'GREEN_LIST_BUILT'
    | 'LOGITS_BIASED'
    | 'DETECT'
    | 'SIGN'
    | 'VERIFY_SIGN'
    | 'ROBUSTNESS';
  detail?: string;
}

const DEFAULT_GAMMA = 0.5;
const DEFAULT_DELTA = 2.0;
const DEFAULT_Z_THRESHOLD = 4.0;

// ── AiWatermarkAdvanced ──────────────────────────────────────────────────────

/**
 * 통계적 그린리스트 방식 워터마크 + HMAC 메타 서명.
 *
 * 그린/레드 리스트는 context 토큰과 HMAC(secret, ctx)를 시드로 사용하여
 * 결정론적으로 생성됩니다. 추론 시에는 `biasLogits`으로 녹색 토큰에
 * 가산 편향(δ)을 걸고, 검증 시에는 z-score > threshold이면 워터마크로 판정합니다.
 */
export class AiWatermarkAdvanced {
  private readonly vocabulary: readonly string[];
  private readonly vocabSet: ReadonlySet<string>;
  private readonly gamma: number;
  private readonly delta: number;
  private readonly zThreshold: number;
  private readonly secret: string;
  private readonly auditLog: WatermarkAuditEntry[] = [];

  constructor(config: WatermarkConfig) {
    if (!config.vocabulary || config.vocabulary.length === 0) {
      throw new Error('WM_EMPTY_VOCAB');
    }
    this.vocabulary = [...config.vocabulary];
    this.vocabSet = new Set(this.vocabulary);
    this.gamma = config.gamma ?? DEFAULT_GAMMA;
    this.delta = config.delta ?? DEFAULT_DELTA;
    this.zThreshold = config.zThreshold ?? DEFAULT_Z_THRESHOLD;
    const envSecret = process.env['AI_WATERMARK_SECRET'] ?? '';
    this.secret = config.secret ?? envSecret;
    if (!this.secret) {
      throw new Error('WM_MISSING_SECRET');
    }
    if (this.gamma <= 0 || this.gamma >= 1) {
      throw new Error('WM_INVALID_GAMMA');
    }
  }

  // ── FR-R58.1: 그린리스트 생성 ────────────────────────────────────────────

  buildGreenList(contextToken: string): Set<string> {
    const seed = createHmac('sha256', this.secret)
      .update(contextToken)
      .digest();
    const green = new Set<string>();
    const targetSize = Math.max(1, Math.floor(this.vocabulary.length * this.gamma));
    // 결정론적 의사 랜덤 정렬: index = hmac(secret, ctx|i)[0..3] mod vocab.length
    const used = new Set<number>();
    let i = 0;
    while (green.size < targetSize && i < this.vocabulary.length * 8) {
      const h = createHmac('sha256', this.secret)
        .update(`${contextToken}|${i}|${seed.toString('hex').slice(0, 8)}`)
        .digest();
      const idx =
        ((h[0] ?? 0) << 24 | (h[1] ?? 0) << 16 | (h[2] ?? 0) << 8 | (h[3] ?? 0)) >>>
        0;
      const pick = idx % this.vocabulary.length;
      if (!used.has(pick)) {
        used.add(pick);
        const token = this.vocabulary[pick];
        if (token !== undefined) {
          green.add(token);
        }
      }
      i += 1;
    }
    this.audit({
      timestamp: Date.now(),
      action: 'GREEN_LIST_BUILT',
      detail: `ctx=${contextToken},size=${green.size}`,
    });
    return green;
  }

  // ── FR-R58.2: 편향 가이드 ────────────────────────────────────────────────

  /**
   * 로짓 벡터에 그린리스트 토큰 편향을 적용합니다.
   * `logits`는 vocabulary와 동일 길이·동일 순서여야 합니다.
   */
  biasLogits(logits: number[], contextToken: string): number[] {
    if (logits.length !== this.vocabulary.length) {
      throw new Error('WM_LOGITS_LENGTH_MISMATCH');
    }
    const green = this.buildGreenList(contextToken);
    const result: number[] = new Array(logits.length);
    for (let i = 0; i < logits.length; i += 1) {
      const token = this.vocabulary[i];
      const original = logits[i] ?? 0;
      if (token !== undefined && green.has(token)) {
        result[i] = original + this.delta;
      } else {
        result[i] = original;
      }
    }
    this.audit({ timestamp: Date.now(), action: 'LOGITS_BIASED' });
    return result;
  }

  // ── FR-R58.3: z-score 검증 ───────────────────────────────────────────────

  detect(tokens: string[], contextToken: string): DetectResult {
    const green = this.buildGreenList(contextToken);
    const validTokens = tokens.filter((t) => this.vocabSet.has(t));
    const T = validTokens.length;
    if (T === 0) {
      const empty: DetectResult = {
        watermarked: false,
        zScore: 0,
        greenRatio: 0,
        tokens: 0,
      };
      this.audit({ timestamp: Date.now(), action: 'DETECT', detail: 'empty' });
      return empty;
    }
    let greenCount = 0;
    for (const t of validTokens) {
      if (green.has(t)) greenCount += 1;
    }
    const expected = this.gamma * T;
    const variance = T * this.gamma * (1 - this.gamma);
    const zScore = variance > 0 ? (greenCount - expected) / Math.sqrt(variance) : 0;
    const ratio = greenCount / T;
    const result: DetectResult = {
      watermarked: zScore > this.zThreshold,
      zScore: +zScore.toFixed(4),
      greenRatio: +ratio.toFixed(4),
      tokens: T,
    };
    this.audit({
      timestamp: Date.now(),
      action: 'DETECT',
      detail: `z=${result.zScore},T=${T}`,
    });
    return result;
  }

  // ── FR-R58.4: HMAC 서명 ──────────────────────────────────────────────────

  sign(text: string, meta: string): string {
    const sig = createHmac('sha256', this.secret).update(`${text}|${meta}`).digest('hex');
    this.audit({ timestamp: Date.now(), action: 'SIGN' });
    return sig;
  }

  verifySignature(text: string, meta: string, signature: string): boolean {
    const expected = createHmac('sha256', this.secret)
      .update(`${text}|${meta}`)
      .digest('hex');
    const ok = this.constantTimeEqual(expected, signature);
    this.audit({
      timestamp: Date.now(),
      action: 'VERIFY_SIGN',
      detail: ok ? 'ok' : 'fail',
    });
    return ok;
  }

  // ── FR-R58.5: 강건성 평가 ────────────────────────────────────────────────

  assessRobustness(original: string[], modified: string[], contextToken: string): number {
    const orig = this.detect(original, contextToken);
    const mod = this.detect(modified, contextToken);
    if (orig.zScore <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, mod.zScore / orig.zScore));
    this.audit({
      timestamp: Date.now(),
      action: 'ROBUSTNESS',
      detail: `ratio=${ratio.toFixed(3)}`,
    });
    return +ratio.toFixed(3);
  }

  // ── FR-R58.6: 감사 ───────────────────────────────────────────────────────

  getAuditLog(): readonly WatermarkAuditEntry[] {
    return this.auditLog;
  }

  // ── 내부 ──────────────────────────────────────────────────────────────────

  private audit(entry: WatermarkAuditEntry): void {
    this.auditLog.push(entry);
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    // sha256 hex → 64자. 상수 시간 비교.
    const hashA = createHash('sha256').update(a).digest();
    const hashB = createHash('sha256').update(b).digest();
    let diff = 0;
    for (let i = 0; i < hashA.length; i += 1) {
      diff |= (hashA[i] ?? 0) ^ (hashB[i] ?? 0);
    }
    return diff === 0;
  }
}
