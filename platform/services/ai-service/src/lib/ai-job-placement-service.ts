// Design Ref: §핵심 알고리즘 — 구직자-구인 매칭 점수 모델
// Plan SC: FR-R519.1~5

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

interface JobSeeker {
  seekerId: string;
  skills: string[];
  experienceYears: number;
  desiredRegion: string;
  desiredSalaryKrw: number;
}

interface JobPosting {
  postingId: string;
  requiredSkills: string[];
  minExperienceYears: number;
  region: string;
  salaryKrw: number;
}

interface MatchResult {
  postingId: string;
  seekerId: string;
  matchScore: number; // 0 ~ 100
  reason: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIJobPlacementService {
  private seekers = new Map<string, JobSeeker>();
  private postings = new Map<string, JobPosting>();
  private readonly auditLog: AuditEntry[] = [];

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R519.1
  registerSeeker(seeker: JobSeeker, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    this.seekers.set(seeker.seekerId, seeker);
    this.appendAudit('REGISTER_SEEKER', { seekerId: seeker.seekerId });
  }

  // Plan SC: FR-R519.1
  registerPosting(posting: JobPosting, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    this.postings.set(posting.postingId, posting);
    this.appendAudit('REGISTER_POSTING', { postingId: posting.postingId });
  }

  // Plan SC: FR-R519.2
  computeMatch(seekerId: string, postingId: string): MatchResult {
    const seeker = this.seekers.get(seekerId);
    const posting = this.postings.get(postingId);
    if (!seeker) throw new Error(`구직자 미등록: ${seekerId}`);
    if (!posting) throw new Error(`구인 공고 미등록: ${postingId}`);

    // 스킬 매칭 점수 (40점)
    const matchedSkills = posting.requiredSkills.filter(s => seeker.skills.includes(s));
    const skillRatio = posting.requiredSkills.length > 0
      ? matchedSkills.length / posting.requiredSkills.length
      : 1;
    const skillScore = Math.round(skillRatio * 40);

    // 경력 점수 (20점)
    let experienceScore = 0;
    if (seeker.experienceYears >= posting.minExperienceYears) {
      experienceScore = 20;
    } else if (posting.minExperienceYears > 0) {
      experienceScore = Math.round((seeker.experienceYears / posting.minExperienceYears) * 20);
    }

    // 지역 점수 (20점)
    const regionScore = seeker.desiredRegion === posting.region ? 20 : 0;

    // 급여 점수 (20점)
    let salaryScore = 0;
    if (posting.salaryKrw >= seeker.desiredSalaryKrw) {
      salaryScore = 20;
    } else if (seeker.desiredSalaryKrw > 0) {
      const ratio = posting.salaryKrw / seeker.desiredSalaryKrw;
      salaryScore = Math.round(Math.max(0, ratio) * 20);
    }

    const total = skillScore + experienceScore + regionScore + salaryScore;
    const reason = `스킬 ${matchedSkills.length}/${posting.requiredSkills.length}, 경력 ${seeker.experienceYears}년, 지역 일치 ${regionScore === 20}, 급여 ${posting.salaryKrw}/${seeker.desiredSalaryKrw}`;

    this.appendAudit('COMPUTE_MATCH', { seekerId, postingId, total });
    return { postingId, seekerId, matchScore: total, reason };
  }

  // Plan SC: FR-R519.3
  recommendForSeeker(seekerId: string, topN: number = 5): MatchResult[] {
    const results: MatchResult[] = [];
    for (const posting of this.postings.values()) {
      results.push(this.computeMatch(seekerId, posting.postingId));
    }
    return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, topN);
  }

  // Plan SC: FR-R519.4
  recommendForPosting(postingId: string, topN: number = 5): MatchResult[] {
    const results: MatchResult[] = [];
    for (const seeker of this.seekers.values()) {
      results.push(this.computeMatch(seeker.seekerId, postingId));
    }
    return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, topN);
  }

  // Plan SC: FR-R519.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
