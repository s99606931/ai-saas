// SVC-AI-ADV-R495 Integrated Complaint Center AI
// Design Ref: SVC-AI-ADV-R495.design.md §통합민원실
// Plan SC: FR-495.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

const DATA_GRADE_BLOCK = ['C', 'S'] as const;

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type Channel = 'web' | 'phone' | 'visit' | 'mobile' | 'kiosk';
export type Department =
  | 'tax_dept'
  | 'welfare_dept'
  | 'urban_dept'
  | 'transport_dept'
  | 'environment_dept'
  | 'general_dept';

export interface ComplaintTicket {
  readonly ticketId: string;
  readonly channel: Channel;
  readonly subject: string;
  readonly receivedAt: string;
}

export interface RoutingResult {
  readonly ticketId: string;
  readonly assignedDepartment: Department;
  readonly priority: 'P1' | 'P2' | 'P3';
  readonly estimatedHandleMinutes: number;
}

export interface DepartmentLoad {
  readonly department: Department;
  readonly openTickets: number;
  readonly avgHandleMinutes: number;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly detail: Record<string, unknown>;
}

const ROUTING_RULES: ReadonlyArray<{ readonly keywords: readonly string[]; readonly dept: Department }> =
  [
    { keywords: ['세금', '체납', '재산세', '취득세'], dept: 'tax_dept' },
    { keywords: ['복지', '기초생활', '노인', '장애'], dept: 'welfare_dept' },
    { keywords: ['건축', '도시계획', '인허가'], dept: 'urban_dept' },
    { keywords: ['교통', '버스', '신호등', '주차'], dept: 'transport_dept' },
    { keywords: ['환경', '쓰레기', '소음', '대기오염'], dept: 'environment_dept' },
  ];

export class IntegratedComplaintCenterAi {
  private readonly auditLog: AuditEntry[] = [];
  private readonly loads: Map<Department, DepartmentLoad> = new Map();

  setLoad(load: DepartmentLoad): void {
    this.loads.set(load.department, load);
    this.appendAudit('SET_LOAD', { department: load.department, open: load.openTickets });
  }

  route(ticket: ComplaintTicket, grade: DataGrade = 'O'): RoutingResult {
    blockClassifiedData(grade);

    let assignedDepartment: Department = 'general_dept';
    for (const rule of ROUTING_RULES) {
      if (rule.keywords.some((k) => ticket.subject.includes(k))) {
        assignedDepartment = rule.dept;
        break;
      }
    }

    const priority: RoutingResult['priority'] =
      ticket.channel === 'visit' ? 'P1' : ticket.channel === 'phone' ? 'P2' : 'P3';

    const load = this.loads.get(assignedDepartment);
    const baseMin = load?.avgHandleMinutes ?? 30;
    const queueDelay = (load?.openTickets ?? 0) * 5;
    const estimatedHandleMinutes = baseMin + queueDelay;

    const result: RoutingResult = {
      ticketId: ticket.ticketId,
      assignedDepartment,
      priority,
      estimatedHandleMinutes,
    };

    this.appendAudit('ROUTE', {
      ticketId: ticket.ticketId,
      department: assignedDepartment,
      priority,
    });
    return result;
  }

  totalQueueLoad(): number {
    let total = 0;
    for (const load of this.loads.values()) {
      total += load.openTickets;
    }
    return total;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    });
  }
}
