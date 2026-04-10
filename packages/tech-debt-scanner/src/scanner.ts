/**
 * 기술 부채 자동 측정 스캐너
 * Design Ref: MTU-N177 §3
 * Plan SC: FR-TD.1~6
 */

import { z } from 'zod';

// Design Ref: §3 - 부채 유형 정의
export enum DebtCategory {
  CodeComplexity = 'code-complexity',
  CodeDuplication = 'code-duplication',
  TodoFixme = 'todo-fixme',
  DependencyAge = 'dependency-age',
  CoverageGap = 'coverage-gap',
  SecurityVuln = 'security-vuln',
  DeadCode = 'dead-code',
}

// FR-TD.5: 부채 우선순위
export enum DebtPriority {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export interface DebtItem {
  id: string;
  category: DebtCategory;
  priority: DebtPriority;
  file: string;
  line?: number;
  description: string;
  estimatedHours: number;
  createdAt: string;
}

export interface DebtSummary {
  totalItems: number;
  totalEstimatedHours: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  score: number;  // 0-100 (낮을수록 부채 많음)
  trend: 'improving' | 'stable' | 'degrading';
}

/**
 * FR-TD.1: 코드 복잡도 분석
 */
export function analyzeComplexity(
  files: Array<{ path: string; cyclomaticComplexity: number; lines: number }>
): DebtItem[] {
  const items: DebtItem[] = [];

  for (const file of files) {
    if (file.cyclomaticComplexity > 20) {
      items.push({
        id: `CC-${file.path.replace(/\//g, '-')}`,
        category: DebtCategory.CodeComplexity,
        priority: file.cyclomaticComplexity > 40 ? DebtPriority.Critical : DebtPriority.High,
        file: file.path,
        description: `순환 복잡도 ${file.cyclomaticComplexity} (임계값: 20)`,
        estimatedHours: Math.ceil(file.cyclomaticComplexity / 10),
        createdAt: new Date().toISOString(),
      });
    }

    if (file.lines > 800) {
      items.push({
        id: `FL-${file.path.replace(/\//g, '-')}`,
        category: DebtCategory.CodeComplexity,
        priority: file.lines > 1500 ? DebtPriority.High : DebtPriority.Medium,
        file: file.path,
        description: `파일 크기 ${file.lines}줄 (임계값: 800줄)`,
        estimatedHours: Math.ceil((file.lines - 800) / 200),
        createdAt: new Date().toISOString(),
      });
    }
  }

  return items;
}

/**
 * FR-TD.2: 의존성 노후도 측정
 */
export function analyzeDependencies(
  deps: Array<{
    name: string;
    currentVersion: string;
    latestVersion: string;
    majorsBehind: number;
    eol: boolean;
  }>
): DebtItem[] {
  const items: DebtItem[] = [];

  for (const dep of deps) {
    if (dep.eol) {
      items.push({
        id: `DEP-EOL-${dep.name}`,
        category: DebtCategory.DependencyAge,
        priority: DebtPriority.Critical,
        file: 'package.json',
        description: `${dep.name} ${dep.currentVersion}: EOL (지원 종료). 최신: ${dep.latestVersion}`,
        estimatedHours: 4,
        createdAt: new Date().toISOString(),
      });
    } else if (dep.majorsBehind >= 3) {
      items.push({
        id: `DEP-OLD-${dep.name}`,
        category: DebtCategory.DependencyAge,
        priority: DebtPriority.High,
        file: 'package.json',
        description: `${dep.name} ${dep.currentVersion}: ${dep.majorsBehind}개 메이저 버전 뒤처짐. 최신: ${dep.latestVersion}`,
        estimatedHours: dep.majorsBehind * 2,
        createdAt: new Date().toISOString(),
      });
    } else if (dep.majorsBehind >= 1) {
      items.push({
        id: `DEP-UPD-${dep.name}`,
        category: DebtCategory.DependencyAge,
        priority: DebtPriority.Medium,
        file: 'package.json',
        description: `${dep.name} ${dep.currentVersion}: ${dep.majorsBehind}개 메이저 버전 뒤처짐`,
        estimatedHours: dep.majorsBehind,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return items;
}

/**
 * FR-TD.3: 테스트 커버리지 갭 분석
 */
export function analyzeCoverageGaps(
  modules: Array<{
    name: string;
    coverage: number;
    criticalPaths: number;
    coveredPaths: number;
  }>
): DebtItem[] {
  const items: DebtItem[] = [];

  for (const mod of modules) {
    if (mod.coverage < 60) {
      items.push({
        id: `COV-${mod.name}`,
        category: DebtCategory.CoverageGap,
        priority: mod.coverage < 30 ? DebtPriority.Critical : DebtPriority.High,
        file: `src/${mod.name}/`,
        description: `테스트 커버리지 ${mod.coverage}% (목표: 80%)`,
        estimatedHours: Math.ceil((80 - mod.coverage) / 5),
        createdAt: new Date().toISOString(),
      });
    } else if (mod.coverage < 80) {
      items.push({
        id: `COV-${mod.name}`,
        category: DebtCategory.CoverageGap,
        priority: DebtPriority.Medium,
        file: `src/${mod.name}/`,
        description: `테스트 커버리지 ${mod.coverage}% (목표: 80%)`,
        estimatedHours: Math.ceil((80 - mod.coverage) / 5),
        createdAt: new Date().toISOString(),
      });
    }
  }

  return items;
}

/**
 * FR-TD.5: 부채 점수 계산 (0-100)
 */
export function calculateDebtScore(items: DebtItem[]): number {
  if (items.length === 0) return 100;

  const weights: Record<DebtPriority, number> = {
    [DebtPriority.Critical]: 10,
    [DebtPriority.High]: 5,
    [DebtPriority.Medium]: 2,
    [DebtPriority.Low]: 1,
  };

  const totalPenalty = items.reduce(
    (sum, item) => sum + weights[item.priority],
    0
  );

  // 100점에서 페널티 차감 (최소 0점)
  return Math.max(0, Math.round(100 - totalPenalty));
}

/**
 * 부채 요약 생성
 */
export function generateSummary(
  items: DebtItem[],
  previousScore?: number,
): DebtSummary {
  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
  }

  const score = calculateDebtScore(items);
  const totalEstimatedHours = items.reduce((sum, i) => sum + i.estimatedHours, 0);

  let trend: 'improving' | 'stable' | 'degrading' = 'stable';
  if (previousScore !== undefined) {
    if (score > previousScore + 2) trend = 'improving';
    else if (score < previousScore - 2) trend = 'degrading';
  }

  return {
    totalItems: items.length,
    totalEstimatedHours,
    byCategory,
    byPriority,
    score,
    trend,
  };
}
