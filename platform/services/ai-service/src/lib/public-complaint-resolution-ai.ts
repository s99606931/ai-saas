// Design Ref: §민원 유형 분류 + 해결 경로 추천
// Plan SC: FR-R612.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type ComplaintCategory = 'road' | 'noise' | 'welfare' | 'tax' | 'environment' | 'other';
type ResolutionPriority = 'critical' | 'high' | 'normal' | 'low';

interface Complaint {
  id: string;
  citizenId: string;
  category: ComplaintCategory;
  description: string;
  submittedAt: string;
  urgencyScore: number;
}

interface ResolutionPlan {
  complaintId: string;
  priority: ResolutionPriority;
  assignedDept: string;
  expectedDays: number;
  recommendedActions: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

const DEPT_MAP: Record<ComplaintCategory, string> = {
  road: '도로교통과',
  noise: '생활안전과',
  welfare: '복지지원과',
  tax: '세정과',
  environment: '환경과',
  other: '민원실',
};

export class PublicComplaintResolutionAI {
  private complaints = new Map<string, Complaint>();
  private plans = new Map<string, ResolutionPlan>();
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R612.1
  registerComplaint(c: Complaint, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (c.urgencyScore < 0 || c.urgencyScore > 100) {
      throw new Error('urgencyScore 범위는 0~100');
    }
    this.complaints.set(c.id, c);
    this.log('REGISTER_COMPLAINT', { id: c.id, category: c.category });
  }

  // Plan SC: FR-R612.2
  private derivePriority(score: number): ResolutionPriority {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'normal';
    return 'low';
  }

  // Plan SC: FR-R612.3
  private recommendActions(category: ComplaintCategory, priority: ResolutionPriority): string[] {
    const base: string[] = ['접수 확인', '담당자 배정'];
    if (priority === 'critical' || priority === 'high') {
      base.push('현장 방문', '실시간 대응');
    }
    if (category === 'welfare') base.push('복지 상담사 연계');
    if (category === 'environment') base.push('환경 모니터링 설치');
    return base;
  }

  // Plan SC: FR-R612.4
  buildPlan(complaintId: string, grade: DataGrade = DataGrade.O): ResolutionPlan {
    blockClassifiedData(grade);
    const c = this.complaints.get(complaintId);
    if (!c) throw new Error(`민원 미등록: ${complaintId}`);

    const priority = this.derivePriority(c.urgencyScore);
    const expectedDays = priority === 'critical' ? 1
      : priority === 'high' ? 3
      : priority === 'normal' ? 7 : 14;

    const plan: ResolutionPlan = {
      complaintId,
      priority,
      assignedDept: DEPT_MAP[c.category],
      expectedDays,
      recommendedActions: this.recommendActions(c.category, priority),
    };
    this.plans.set(complaintId, plan);
    this.log('BUILD_PLAN', { complaintId, priority });
    return plan;
  }

  // Plan SC: FR-R612.5
  getPlan(complaintId: string): ResolutionPlan | undefined {
    return this.plans.get(complaintId);
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
