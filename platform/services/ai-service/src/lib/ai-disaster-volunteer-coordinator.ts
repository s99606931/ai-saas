// Design Ref: §재난 자원봉사 코디네이터 — 스킬/위치 기반 매칭
// Plan SC: FR-R609.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type DisasterType = 'flood' | 'earthquake' | 'fire' | 'typhoon' | 'snow';
export type VolunteerSkill = 'medical' | 'search_rescue' | 'logistics' | 'translation' | 'psychological';

export interface Volunteer {
  volunteerId: string;
  skills: VolunteerSkill[];
  regionCode: string;
  availableHours: number;
}

export interface DisasterTask {
  taskId: string;
  disasterType: DisasterType;
  regionCode: string;
  requiredSkills: VolunteerSkill[];
  requiredVolunteers: number;
  estimatedHours: number;
}

export interface Assignment {
  taskId: string;
  volunteerIds: string[];
  coverageRate: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIDisasterVolunteerCoordinator {
  private volunteers = new Map<string, Volunteer>();
  private tasks = new Map<string, DisasterTask>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R609.1
  registerVolunteer(v: Volunteer, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (v.availableHours < 0) throw new Error('가용 시간은 0 이상이어야 합니다');
    if (v.skills.length === 0) throw new Error('최소 1개 이상의 스킬이 필요합니다');
    this.volunteers.set(v.volunteerId, { ...v, skills: [...v.skills] });
    this.append('REGISTER_VOLUNTEER', { volunteerId: v.volunteerId });
  }

  // Plan SC: FR-R609.2
  registerTask(task: DisasterTask, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (task.requiredVolunteers < 1) throw new Error('요청 봉사자 수는 1 이상이어야 합니다');
    if (task.estimatedHours < 0) throw new Error('예상 소요 시간은 0 이상이어야 합니다');
    this.tasks.set(task.taskId, { ...task, requiredSkills: [...task.requiredSkills] });
    this.append('REGISTER_TASK', { taskId: task.taskId, disasterType: task.disasterType });
  }

  // Plan SC: FR-R609.3
  assign(taskId: string, grade: DataGrade = 'O'): Assignment {
    blockClassifiedData(grade);
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`업무 미등록: ${taskId}`);

    const candidates: Array<{ id: string; score: number }> = [];
    for (const v of this.volunteers.values()) {
      if (v.availableHours < task.estimatedHours) continue;
      const regionMatch = v.regionCode === task.regionCode ? 50 : 0;
      const skillMatches = task.requiredSkills.filter(s => v.skills.includes(s)).length;
      if (task.requiredSkills.length > 0 && skillMatches === 0) continue;
      const skillScore = task.requiredSkills.length === 0 ? 30 : (skillMatches / task.requiredSkills.length) * 50;
      candidates.push({ id: v.volunteerId, score: regionMatch + skillScore });
    }
    candidates.sort((a, b) => b.score - a.score);
    const selected = candidates.slice(0, task.requiredVolunteers).map(c => c.id);
    const coverageRate = Math.round((selected.length / task.requiredVolunteers) * 10000) / 100;

    this.append('ASSIGN', { taskId, assigned: selected.length, coverageRate });
    return { taskId, volunteerIds: selected, coverageRate };
  }

  // Plan SC: FR-R609.4
  countBySkill(): Record<VolunteerSkill, number> {
    const counts: Record<VolunteerSkill, number> = {
      medical: 0,
      search_rescue: 0,
      logistics: 0,
      translation: 0,
      psychological: 0,
    };
    for (const v of this.volunteers.values()) {
      for (const s of v.skills) counts[s]++;
    }
    return counts;
  }

  // Plan SC: FR-R609.5
  listTasks(disasterType?: DisasterType): DisasterTask[] {
    return Array.from(this.tasks.values())
      .filter(t => !disasterType || t.disasterType === disasterType)
      .map(t => ({ ...t, requiredSkills: [...t.requiredSkills] }));
  }

  // Plan SC: FR-R609.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
