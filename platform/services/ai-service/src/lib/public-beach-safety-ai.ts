// Design Ref: §공공 해변 안전 — 파고/조류/인파 기반 수영 허용 판단
// Plan SC: FR-R566.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface BeachConditions {
  beachId: string;
  waveHeightMeters: number;
  ripCurrentRisk: 0 | 1 | 2 | 3 | 4 | 5;
  waterTempC: number;
  windKph: number;
  visitorCount: number;
  lifeguardCount: number;
  jellyfishAlert: boolean;
}

export interface SafetyDecision {
  beachId: string;
  flag: 'green' | 'yellow' | 'red' | 'black';
  allowSwim: boolean;
  warnings: string[];
  requiredLifeguards: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class PublicBeachSafetyAI {
  private readonly decisions: SafetyDecision[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R566.1
  evaluate(cond: BeachConditions, grade: DataGrade = 'O'): SafetyDecision {
    blockClassifiedData(grade);
    if (cond.waveHeightMeters < 0) throw new Error('파고는 0 이상이어야 합니다');
    if (cond.visitorCount < 0) throw new Error('방문자 수는 0 이상이어야 합니다');
    if (cond.lifeguardCount < 0) throw new Error('구조요원 수는 0 이상이어야 합니다');

    const warnings: string[] = [];
    let risk = 0;

    if (cond.waveHeightMeters >= 3) {
      risk += 3;
      warnings.push('고파랑 경보');
    } else if (cond.waveHeightMeters >= 2) {
      risk += 2;
      warnings.push('파고 주의');
    } else if (cond.waveHeightMeters >= 1.2) {
      risk += 1;
    }

    if (cond.ripCurrentRisk >= 4) {
      risk += 3;
      warnings.push('이안류 위험');
    } else if (cond.ripCurrentRisk >= 2) {
      risk += 1;
    }

    if (cond.windKph >= 40) {
      risk += 2;
      warnings.push('강풍 경보');
    } else if (cond.windKph >= 25) {
      risk += 1;
    }

    if (cond.waterTempC < 15) {
      risk += 2;
      warnings.push('저수온 위험');
    }
    if (cond.jellyfishAlert) {
      risk += 1;
      warnings.push('해파리 출몰 경보');
    }

    const flag: SafetyDecision['flag'] =
      risk >= 7 ? 'black' : risk >= 5 ? 'red' : risk >= 3 ? 'yellow' : 'green';
    const allowSwim = flag === 'green' || flag === 'yellow';

    const requiredLifeguards = Math.max(
      1,
      Math.ceil(cond.visitorCount / 200) + (risk >= 5 ? 2 : 0),
    );
    if (cond.lifeguardCount < requiredLifeguards) {
      warnings.push(`구조요원 부족: ${cond.lifeguardCount}/${requiredLifeguards}`);
    }

    const decision: SafetyDecision = {
      beachId: cond.beachId,
      flag,
      allowSwim,
      warnings,
      requiredLifeguards,
    };
    this.decisions.push(decision);
    this.append('EVALUATE', { beachId: cond.beachId, flag, risk });
    return decision;
  }

  // Plan SC: FR-R566.2
  batchEvaluate(list: BeachConditions[]): SafetyDecision[] {
    return list.map(c => this.evaluate(c));
  }

  // Plan SC: FR-R566.3
  summarizeByFlag(): Record<SafetyDecision['flag'], number> {
    const summary: Record<SafetyDecision['flag'], number> = {
      green: 0, yellow: 0, red: 0, black: 0,
    };
    for (const d of this.decisions) summary[d.flag] += 1;
    return summary;
  }

  // Plan SC: FR-R566.4
  listDecisions(flag?: SafetyDecision['flag']): SafetyDecision[] {
    return flag ? this.decisions.filter(d => d.flag === flag) : [...this.decisions];
  }

  // Plan SC: FR-R566.5
  clearDecisions(): void {
    this.decisions.length = 0;
    this.append('CLEAR', {});
  }

  // Plan SC: FR-R566.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
