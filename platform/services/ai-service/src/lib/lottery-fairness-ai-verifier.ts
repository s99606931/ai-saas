// Design Ref: §추첨 공정성 — 카이제곱 적합도 + 엔트로피 기반 검증
// Plan SC: FR-R541.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface LotteryDraw {
  drawId: string;
  candidates: string[];
  winners: string[];
  seedHash: string;
}

export interface FairnessReport {
  drawId: string;
  uniformityScore: number; // 0~100
  entropyBits: number;
  chiSquare: number;
  verdict: 'fair' | 'suspicious' | 'biased';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class LotteryFairnessAIVerifier {
  private draws = new Map<string, LotteryDraw>();
  private frequency = new Map<string, number>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R541.1
  recordDraw(draw: LotteryDraw, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (draw.candidates.length === 0) throw new Error('후보자 목록이 비어 있습니다');
    if (draw.winners.length === 0) throw new Error('당첨자 목록이 비어 있습니다');
    for (const w of draw.winners) {
      if (!draw.candidates.includes(w)) throw new Error(`당첨자가 후보자 목록에 없음: ${w}`);
    }
    this.draws.set(draw.drawId, { ...draw, candidates: [...draw.candidates], winners: [...draw.winners] });
    for (const w of draw.winners) {
      this.frequency.set(w, (this.frequency.get(w) ?? 0) + 1);
    }
    this.append('RECORD_DRAW', { drawId: draw.drawId, n: draw.winners.length });
  }

  // Plan SC: FR-R541.2
  computeEntropy(drawId: string): number {
    const d = this.draws.get(drawId);
    if (!d) throw new Error(`추첨 미등록: ${drawId}`);
    const counts = new Map<string, number>();
    for (const w of d.winners) counts.set(w, (counts.get(w) ?? 0) + 1);
    const total = d.winners.length;
    let h = 0;
    for (const [, c] of counts) {
      const p = c / total;
      h -= p * Math.log2(p);
    }
    return Math.round(h * 1000) / 1000;
  }

  // Plan SC: FR-R541.3
  chiSquareTest(drawId: string): number {
    const d = this.draws.get(drawId);
    if (!d) throw new Error(`추첨 미등록: ${drawId}`);
    const expected = d.winners.length / d.candidates.length;
    const observed = new Map<string, number>();
    for (const c of d.candidates) observed.set(c, 0);
    for (const w of d.winners) observed.set(w, (observed.get(w) ?? 0) + 1);
    let chi = 0;
    for (const [, o] of observed) {
      chi += Math.pow(o - expected, 2) / (expected || 1);
    }
    return Math.round(chi * 1000) / 1000;
  }

  // Plan SC: FR-R541.4
  verify(drawId: string, grade: DataGrade = 'O'): FairnessReport {
    blockClassifiedData(grade);
    const d = this.draws.get(drawId);
    if (!d) throw new Error(`추첨 미등록: ${drawId}`);
    const entropyBits = this.computeEntropy(drawId);
    const chiSquare = this.chiSquareTest(drawId);
    const maxEntropy = Math.log2(Math.max(d.winners.length, 1));
    const uniformityScore = maxEntropy === 0 ? 100 : Math.round((entropyBits / maxEntropy) * 10000) / 100;
    const verdict: 'fair' | 'suspicious' | 'biased' =
      chiSquare < 3.84 ? 'fair' : chiSquare < 10.83 ? 'suspicious' : 'biased';
    const report: FairnessReport = { drawId, uniformityScore, entropyBits, chiSquare, verdict };
    this.append('VERIFY', { drawId, verdict });
    return report;
  }

  // Plan SC: FR-R541.5
  getFrequency(winnerId: string): number {
    return this.frequency.get(winnerId) ?? 0;
  }

  // Plan SC: FR-R541.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
