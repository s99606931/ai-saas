// Design Ref: MTU-N488 §기술 부채 자동 정량화
// Plan SC: FR-TD.1~5

export interface CodeMetrics {
  file: string;
  linesOfCode: number;
  cyclomaticComplexity: number;
  duplicateLines: number;
  testCoverage: number; // 0..1
  todoCount: number;
}

export interface DebtScore {
  file: string;
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  issues: string[];
}

export interface RefactorRec {
  file: string;
  suggestion: string;
  estimatedHours: number;
}

export interface DebtTrend {
  week: string;
  totalScore: number;
}

export class TechDebtQuantifier {
  private history: DebtTrend[] = [];

  /** FR-TD.1 코드 메트릭 수집 (입력값 검증만) */
  collectMetrics(metrics: CodeMetrics[]): CodeMetrics[] {
    return metrics.filter((m) => m.linesOfCode > 0);
  }

  /** FR-TD.2 부채 스코어링 */
  scoreDebt(m: CodeMetrics): DebtScore {
    let score = 0;
    const issues: string[] = [];
    if (m.linesOfCode > 800) {
      score += 20;
      issues.push('파일 800줄 초과');
    }
    if (m.cyclomaticComplexity > 10) {
      score += 25;
      issues.push(`CC ${m.cyclomaticComplexity}`);
    }
    if (m.duplicateLines > 20) {
      score += 15;
      issues.push('중복 20줄 초과');
    }
    if (m.testCoverage < 0.6) {
      score += 20;
      issues.push(`커버리지 ${(m.testCoverage * 100).toFixed(0)}%`);
    }
    if (m.todoCount > 5) {
      score += 10;
      issues.push(`TODO ${m.todoCount}개`);
    }
    let level: DebtScore['level'] = 'low';
    if (score >= 70) level = 'critical';
    else if (score >= 45) level = 'high';
    else if (score >= 20) level = 'medium';
    return { file: m.file, score, level, issues };
  }

  /** FR-TD.3 우선순위 매트릭스 */
  prioritize(scores: DebtScore[]): DebtScore[] {
    return [...scores].sort((a, b) => b.score - a.score);
  }

  /** FR-TD.4 리팩토링 추천 */
  recommend(score: DebtScore): RefactorRec[] {
    const recs: RefactorRec[] = [];
    for (const issue of score.issues) {
      if (issue.includes('800줄')) recs.push({ file: score.file, suggestion: '파일 분리 (단일 책임)', estimatedHours: 8 });
      if (issue.includes('CC')) recs.push({ file: score.file, suggestion: '함수 분해', estimatedHours: 4 });
      if (issue.includes('중복')) recs.push({ file: score.file, suggestion: '공통 모듈 추출', estimatedHours: 3 });
      if (issue.includes('커버리지')) recs.push({ file: score.file, suggestion: '테스트 추가', estimatedHours: 6 });
    }
    return recs;
  }

  /** FR-TD.5 트렌드 */
  recordTrend(week: string, totalScore: number): void {
    this.history.push({ week, totalScore });
  }

  getTrend(): DebtTrend[] {
    return [...this.history];
  }
}

export const techDebtQuantifier = new TechDebtQuantifier();
