// Design Ref: MTU-N415 §공공 인사 AI
// Plan SC: FR-N415.1~5
// N2SF: PII 마스킹 필수, C등급 데이터 내부 처리만

export interface EmployeeProfile {
  employeeId: string;
  department: string;
  position: string;
  yearsOfService: number;
  gender?: 'M' | 'F' | 'U';
}

export interface KPIScore {
  employeeId: string;
  period: string;
  kpi: Record<string, number>;
  weights: Record<string, number>;
}

export interface Feedback360 {
  employeeId: string;
  role: 'peer' | 'subordinate' | 'supervisor';
  scores: Record<string, number>;
}

export interface PerformanceResult {
  employeeId: string;
  kpiTotal: number;
  feedbackTotal: number;
  finalScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
}

export interface BiasReport {
  dimension: 'gender' | 'department' | 'tenure';
  groups: Array<{ key: string; meanScore: number; count: number }>;
  maxGap: number;
  biasSuspected: boolean;
}

export class PublicHRAI {
  /** FR-N415.1 성과평가 */
  evaluatePerformance(kpi: KPIScore, feedbacks: Feedback360[]): PerformanceResult {
    const kpiTotal = this.weightedSum(kpi.kpi, kpi.weights);
    const fbScores = feedbacks
      .filter((f) => f.employeeId === kpi.employeeId)
      .map((f) => this.avg(Object.values(f.scores)));
    const feedbackTotal = fbScores.length > 0 ? this.avg(fbScores) : 0;
    const finalScore = +(kpiTotal * 0.7 + feedbackTotal * 0.3).toFixed(2);
    const grade = this.toGrade(finalScore);
    return { employeeId: kpi.employeeId, kpiTotal, feedbackTotal, finalScore, grade };
  }

  private weightedSum(values: Record<string, number>, weights: Record<string, number>): number {
    let s = 0;
    let w = 0;
    for (const [k, v] of Object.entries(values)) {
      const wt = weights[k] ?? 0;
      s += v * wt;
      w += wt;
    }
    return w > 0 ? +(s / w).toFixed(2) : 0;
  }

  private avg(nums: number[]): number {
    if (nums.length === 0) return 0;
    return +(nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(2);
  }

  private toGrade(score: number): PerformanceResult['grade'] {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 75) return 'B';
    if (score >= 65) return 'C';
    return 'D';
  }

  /** FR-N415.2 편향 탐지 */
  detectBias(
    results: PerformanceResult[],
    profiles: EmployeeProfile[],
    dimension: BiasReport['dimension'],
  ): BiasReport {
    const map = new Map<string, { sum: number; count: number }>();
    for (const r of results) {
      const p = profiles.find((x) => x.employeeId === r.employeeId);
      if (!p) continue;
      let key = 'unknown';
      if (dimension === 'gender') key = p.gender ?? 'U';
      else if (dimension === 'department') key = p.department;
      else key = p.yearsOfService < 5 ? 'junior' : p.yearsOfService < 15 ? 'mid' : 'senior';
      const cur = map.get(key) ?? { sum: 0, count: 0 };
      cur.sum += r.finalScore;
      cur.count++;
      map.set(key, cur);
    }
    const groups = Array.from(map.entries()).map(([key, v]) => ({
      key,
      meanScore: +(v.sum / v.count).toFixed(2),
      count: v.count,
    }));
    const means = groups.map((g) => g.meanScore);
    const maxGap = means.length > 1 ? +(Math.max(...means) - Math.min(...means)).toFixed(2) : 0;
    return { dimension, groups, maxGap, biasSuspected: maxGap > 10 };
  }

  /** FR-N415.3 승진 후보 */
  selectPromotionCandidates(
    results: PerformanceResult[],
    profiles: EmployeeProfile[],
    minYears = 3,
  ): string[] {
    return results
      .filter((r) => r.grade === 'S' || r.grade === 'A')
      .filter((r) => {
        const p = profiles.find((x) => x.employeeId === r.employeeId);
        return p ? p.yearsOfService >= minYears : false;
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .map((r) => r.employeeId);
  }

  /** FR-N415.4 역량 개발 제안 */
  suggestDevelopment(result: PerformanceResult, weakAreas: string[]): string[] {
    const suggestions: string[] = [];
    if (result.grade === 'C' || result.grade === 'D') {
      suggestions.push('기본 직무 교육 재이수');
    }
    for (const area of weakAreas) {
      suggestions.push(`${area} 영역 심화 코스`);
    }
    if (result.grade === 'S' || result.grade === 'A') {
      suggestions.push('리더십 과정 추천');
    }
    return suggestions;
  }

  /** FR-N415.5 PII 마스킹 */
  maskProfile(p: EmployeeProfile): EmployeeProfile {
    return {
      employeeId: this.hash(p.employeeId),
      department: p.department,
      position: p.position,
      yearsOfService: p.yearsOfService,
      gender: p.gender,
    };
  }

  private hash(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return `H-${Math.abs(h).toString(16)}`;
  }
}

export const publicHRAI = new PublicHRAI();
