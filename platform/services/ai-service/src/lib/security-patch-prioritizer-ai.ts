// Design Ref: §핵심 알고리즘 — CVSS × 영향도 / 난이도 우선순위 점수
// Plan SC: FR-R294.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type Difficulty = 'easy' | 'medium' | 'hard';
type PatchStatus = 'pending' | 'applied';

const DIFFICULTY_FACTOR: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

interface PatchRecord {
  id: string;
  cveId: string;
  cvssScore: number;
  impactedSystems: number;
  difficulty: Difficulty;
  status: PatchStatus;
  appliedAt?: string;
}

interface PatchPriority {
  patchId: string;
  cveId: string;
  cvssScore: number;
  priorityScore: number;
  status: PatchStatus;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R294.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class SecurityPatchPrioritizerAI {
  private patches = new Map<string, PatchRecord>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R294.1
  registerPatch(id: string, cveId: string, cvssScore: number, impactedSystems: number, difficulty: Difficulty): void {
    if (cvssScore < 0 || cvssScore > 10) throw new Error('cvssScore는 0~10 범위여야 합니다');
    this.patches.set(id, { id, cveId, cvssScore, impactedSystems, difficulty, status: 'pending' });
    this.log('REGISTER_PATCH', { id, cveId, cvssScore, impactedSystems, difficulty });
  }

  // Plan SC: FR-R294.2
  calculatePriority(patchId: string): PatchPriority {
    const patch = this.patches.get(patchId);
    if (!patch) throw new Error(`패치 미등록: ${patchId}`);
    const impactScore = Math.min(100, patch.impactedSystems * 10);
    const priorityScore = Math.round((patch.cvssScore * 10 + impactScore) / DIFFICULTY_FACTOR[patch.difficulty]);
    return { patchId: patch.id, cveId: patch.cveId, cvssScore: patch.cvssScore, priorityScore, status: patch.status };
  }

  // Plan SC: FR-R294.3
  getRoadmap(): PatchPriority[] {
    return Array.from(this.patches.keys())
      .map(id => this.calculatePriority(id))
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }

  // Plan SC: FR-R294.4
  applyPatch(patchId: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    const patch = this.patches.get(patchId);
    if (!patch) throw new Error(`패치 미등록: ${patchId}`);
    patch.status = 'applied';
    patch.appliedAt = new Date().toISOString();
    this.log('APPLY_PATCH', { patchId, appliedAt: patch.appliedAt });
  }

  // Plan SC: FR-R294.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
