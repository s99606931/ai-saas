// Design Ref: MTU-N429 §온콜 피로도
// Plan SC: FR-N429.1~5

export interface OnCallShift {
  engineerId: string;
  startAt: string;
  endAt: string;
  nightHours: number;
  incidentsHandled: number;
  pagesReceived: number;
}

export interface FatigueScore {
  engineerId: string;
  score: number;
  level: 'ok' | 'warn' | 'critical';
  reasons: string[];
}

export interface ShiftProposal {
  engineerId: string;
  startAt: string;
  endAt: string;
}

export class OnCallFatigue {
  /** FR-N429.1 피로 계산 */
  calculateFatigue(engineerId: string, shifts: OnCallShift[]): FatigueScore {
    const mine = shifts.filter((s) => s.engineerId === engineerId);
    if (mine.length === 0) {
      return { engineerId, score: 0, level: 'ok', reasons: [] };
    }
    const totalNight = mine.reduce((s, x) => s + x.nightHours, 0);
    const totalPages = mine.reduce((s, x) => s + x.pagesReceived, 0);
    const totalIncidents = mine.reduce((s, x) => s + x.incidentsHandled, 0);

    let score = 0;
    const reasons: string[] = [];
    if (totalNight > 24) {
      score += 0.3;
      reasons.push(`야간 ${totalNight}시간`);
    }
    if (totalPages > 20) {
      score += 0.3;
      reasons.push(`페이지 ${totalPages}회`);
    }
    if (totalIncidents > 10) {
      score += 0.2;
      reasons.push(`사고 대응 ${totalIncidents}건`);
    }
    if (mine.length > 5) {
      score += 0.2;
      reasons.push(`교대 ${mine.length}회`);
    }

    const finalScore = Math.min(1, score);
    const level: FatigueScore['level'] = finalScore >= 0.7 ? 'critical' : finalScore >= 0.4 ? 'warn' : 'ok';
    return { engineerId, score: +finalScore.toFixed(2), level, reasons };
  }

  /** FR-N429.2 경고 대상 */
  getWarnings(engineerIds: string[], shifts: OnCallShift[]): FatigueScore[] {
    return engineerIds
      .map((id) => this.calculateFatigue(id, shifts))
      .filter((f) => f.level !== 'ok');
  }

  /** FR-N429.3 공정한 교대 제안 (최소 피로 우선) */
  proposeFairSchedule(
    engineers: string[],
    existingShifts: OnCallShift[],
    newSlotStart: string,
    slotHours: number,
  ): ShiftProposal | null {
    if (engineers.length === 0) return null;
    const scored = engineers
      .map((id) => ({
        id,
        fatigue: this.calculateFatigue(id, existingShifts).score,
      }))
      .sort((a, b) => a.fatigue - b.fatigue);

    // 휴식 규칙 (FR-N429.4): 11시간 간격 검증
    for (const candidate of scored) {
      if (this.hasSufficientRest(candidate.id, existingShifts, newSlotStart)) {
        const end = new Date(new Date(newSlotStart).getTime() + slotHours * 3600 * 1000);
        return {
          engineerId: candidate.id,
          startAt: newSlotStart,
          endAt: end.toISOString(),
        };
      }
    }
    return null;
  }

  /** FR-N429.4 휴식 간격 검증 */
  private hasSufficientRest(engineerId: string, shifts: OnCallShift[], newStart: string): boolean {
    const newStartMs = new Date(newStart).getTime();
    const last = shifts
      .filter((s) => s.engineerId === engineerId)
      .sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime())[0];
    if (!last) return true;
    const lastEnd = new Date(last.endAt).getTime();
    const gapHours = (newStartMs - lastEnd) / (3600 * 1000);
    return gapHours >= 11;
  }

  /** FR-N429.5 팀 대시보드 */
  teamDashboard(engineerIds: string[], shifts: OnCallShift[]): {
    totalEngineers: number;
    criticalCount: number;
    warnCount: number;
    avgFatigue: number;
  } {
    const scores = engineerIds.map((id) => this.calculateFatigue(id, shifts));
    const critical = scores.filter((s) => s.level === 'critical').length;
    const warn = scores.filter((s) => s.level === 'warn').length;
    const avg = scores.reduce((s, x) => s + x.score, 0) / Math.max(1, scores.length);
    return {
      totalEngineers: engineerIds.length,
      criticalCount: critical,
      warnCount: warn,
      avgFatigue: +avg.toFixed(2),
    };
  }
}

export const oncallFatigue = new OnCallFatigue();
