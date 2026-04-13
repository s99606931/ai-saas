// Design Ref: §환경 영향 평가 AI — 프로젝트 단위 환경 부하 점수화
// Plan SC: FR-R581.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ImpactCategory = 'air' | 'water' | 'soil' | 'noise' | 'biodiversity';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ProjectInput {
  projectId: string;
  name: string;
  areaHectare: number;
  budgetKrw: number;
  type: 'road' | 'building' | 'plant' | 'park' | 'other';
}

export interface ImpactScore {
  category: ImpactCategory;
  score: number; // 0~100
  level: RiskLevel;
}

export interface AssessmentResult {
  projectId: string;
  totalScore: number;
  level: RiskLevel;
  categories: ImpactScore[];
  mitigations: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const BASE_SCORES: Record<ProjectInput['type'], Record<ImpactCategory, number>> = {
  road: { air: 70, water: 30, soil: 40, noise: 80, biodiversity: 60 },
  building: { air: 40, water: 20, soil: 50, noise: 40, biodiversity: 30 },
  plant: { air: 85, water: 75, soil: 70, noise: 70, biodiversity: 65 },
  park: { air: 10, water: 15, soil: 10, noise: 15, biodiversity: 5 },
  other: { air: 50, water: 50, soil: 50, noise: 50, biodiversity: 50 },
};

function toLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export class EnvironmentalImpactAssessmentAI {
  private readonly audit: AuditEntry[] = [];
  private readonly projects = new Map<string, ProjectInput>();

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  registerProject(project: ProjectInput, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (project.areaHectare < 0) throw new Error('areaHectare는 0 이상이어야 함');
    this.projects.set(project.projectId, project);
    this.log('REGISTER_PROJECT', { projectId: project.projectId, type: project.type });
  }

  assess(projectId: string, grade: DataGrade = 'O'): AssessmentResult {
    blockClassifiedData(grade);
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`미등록 프로젝트: ${projectId}`);

    const base = BASE_SCORES[project.type];
    const areaFactor = Math.min(1.5, 1 + project.areaHectare / 200);
    const cats: ImpactCategory[] = ['air', 'water', 'soil', 'noise', 'biodiversity'];
    const categories: ImpactScore[] = cats.map((c) => {
      const raw = (base[c] ?? 50) * areaFactor;
      const score = Math.min(100, Math.round(raw));
      return { category: c, score, level: toLevel(score) };
    });
    const totalScore = Math.round(
      categories.reduce((s, c) => s + c.score, 0) / categories.length,
    );
    const level = toLevel(totalScore);
    const mitigations = this.deriveMitigations(categories);

    this.log('ASSESS', { projectId, totalScore, level });
    return { projectId, totalScore, level, categories, mitigations };
  }

  private deriveMitigations(categories: ImpactScore[]): string[] {
    const out: string[] = [];
    for (const c of categories) {
      if (c.level === 'critical' || c.level === 'high') {
        switch (c.category) {
          case 'air':
            out.push('대기오염 저감 장치 설치 및 미세먼지 모니터링');
            break;
          case 'water':
            out.push('하천 유입 차단벽 및 오폐수 전처리 의무화');
            break;
          case 'soil':
            out.push('토양 오염 전수 조사 및 복원 계획 수립');
            break;
          case 'noise':
            out.push('방음벽 설치 및 야간 공사 금지');
            break;
          case 'biodiversity':
            out.push('생태통로 확보 및 야생동물 이주 대책');
            break;
        }
      }
    }
    if (out.length === 0) out.push('기본 저감 계획 유지');
    return out;
  }

  listProjects(): ProjectInput[] {
    return [...this.projects.values()];
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
