// Design Ref: MTU-N412 §교육훈련 AI
// Plan SC: FR-N412.1~5

export interface CompetencyDomain {
  id: string;
  name: string;
  targetLevel: number;
}

export interface Assessment {
  userId: string;
  domainScores: Record<string, { selfScore: number; testScore: number }>;
  assessedAt: string;
}

export interface LearningCourse {
  id: string;
  title: string;
  domainId: string;
  levelFrom: number;
  levelTo: number;
  hours: number;
}

export interface LearningPath {
  userId: string;
  courses: Array<{ courseId: string; order: number; reason: string }>;
  estimatedHours: number;
  expectedLevelGain: Record<string, number>;
}

export interface ProgressRecord {
  userId: string;
  courseId: string;
  progress: number;
  passed: boolean;
  completedAt?: string;
}

export interface CompletionResult {
  userId: string;
  meetsRequirements: boolean;
  completed: string[];
  missing: string[];
  totalHours: number;
}

export class TrainingAI {
  /** FR-N412.1 역량 진단 */
  diagnose(assessment: Assessment, domains: CompetencyDomain[]): Array<{
    domainId: string;
    currentLevel: number;
    gap: number;
  }> {
    return domains.map((d) => {
      const s = assessment.domainScores[d.id];
      const current = s ? +((s.selfScore * 0.3 + s.testScore * 0.7) / 20).toFixed(1) : 0;
      return {
        domainId: d.id,
        currentLevel: current,
        gap: Math.max(0, d.targetLevel - current),
      };
    });
  }

  /** FR-N412.2 학습 경로 추천 */
  recommendPath(
    userId: string,
    diagnostics: Array<{ domainId: string; currentLevel: number; gap: number }>,
    catalog: LearningCourse[],
  ): LearningPath {
    const needed = diagnostics.filter((d) => d.gap > 0).sort((a, b) => b.gap - a.gap);
    const picks: LearningPath['courses'] = [];
    const levelGain: Record<string, number> = {};
    let order = 1;
    let totalHours = 0;

    for (const d of needed) {
      const candidates = catalog
        .filter((c) => c.domainId === d.domainId && c.levelFrom <= d.currentLevel + 0.5)
        .sort((a, b) => a.levelFrom - b.levelFrom);
      let level = d.currentLevel;
      for (const c of candidates) {
        if (level >= d.currentLevel + d.gap) break;
        picks.push({
          courseId: c.id,
          order: order++,
          reason: `${d.domainId} 격차 ${d.gap.toFixed(1)} 보충`,
        });
        totalHours += c.hours;
        level = c.levelTo;
      }
      levelGain[d.domainId] = +Math.max(0, level - d.currentLevel).toFixed(1);
    }

    return { userId, courses: picks, estimatedHours: totalHours, expectedLevelGain: levelGain };
  }

  /** FR-N412.3 진도 추적 */
  updateProgress(current: ProgressRecord[], update: ProgressRecord): ProgressRecord[] {
    const filtered = current.filter(
      (r) => !(r.userId === update.userId && r.courseId === update.courseId),
    );
    return [...filtered, update];
  }

  /** FR-N412.4 수료 조건 검증 */
  verifyCompletion(
    userId: string,
    path: LearningPath,
    progress: ProgressRecord[],
    catalog: LearningCourse[],
  ): CompletionResult {
    const userProgress = progress.filter((p) => p.userId === userId);
    const completed: string[] = [];
    const missing: string[] = [];
    let totalHours = 0;
    for (const pc of path.courses) {
      const rec = userProgress.find((p) => p.courseId === pc.courseId);
      const course = catalog.find((c) => c.id === pc.courseId);
      if (rec?.passed && rec.progress >= 0.9) {
        completed.push(pc.courseId);
        if (course) totalHours += course.hours;
      } else {
        missing.push(pc.courseId);
      }
    }
    return {
      userId,
      meetsRequirements: missing.length === 0 && completed.length > 0,
      completed,
      missing,
      totalHours,
    };
  }

  /** FR-N412.5 향상도 리포트 */
  measureImprovement(
    before: Assessment,
    after: Assessment,
    domains: CompetencyDomain[],
  ): Array<{ domainId: string; delta: number; achievedTarget: boolean }> {
    const d1 = this.diagnose(before, domains);
    const d2 = this.diagnose(after, domains);
    return domains.map((d) => {
      const b = d1.find((x) => x.domainId === d.id)!;
      const a = d2.find((x) => x.domainId === d.id)!;
      return {
        domainId: d.id,
        delta: +(a.currentLevel - b.currentLevel).toFixed(1),
        achievedTarget: a.currentLevel >= d.targetLevel,
      };
    });
  }
}

export const trainingAI = new TrainingAI();
