// Design Ref: §평생교육 매칭 AI — 학습자 관심사·지역 기반 강좌 추천
// Plan SC: FR-R534.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface Learner {
  learnerId: string;
  ageRange: '20s' | '30s' | '40s' | '50s' | '60s+';
  interests: string[];
  region: string;
  level: 'beginner' | 'intermediate' | 'advanced';
}

export interface Course {
  courseId: string;
  title: string;
  topics: string[];
  region: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  capacity: number;
  enrolled: number;
}

export interface Recommendation {
  courseId: string;
  score: number;
  reason: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function maskName(text: string): string {
  return text.replace(/[가-힣]{2,4}\s?님/g, '[NAME_MASKED]');
}

export class LifelongEducationMatcherAI {
  private readonly learners = new Map<string, Learner>();
  private readonly courses = new Map<string, Course>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R534.1
  registerLearner(learner: Learner, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (learner.interests.length === 0) throw new Error('관심사가 비어 있습니다');
    this.learners.set(learner.learnerId, {
      ...learner,
      interests: [...learner.interests],
    });
    this.append('REGISTER_LEARNER', { learnerId: learner.learnerId });
  }

  // Plan SC: FR-R534.2
  registerCourse(course: Course, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (course.capacity <= 0) throw new Error('수강 정원은 양수여야 합니다');
    if (course.enrolled < 0) throw new Error('등록 인원은 음수일 수 없습니다');
    this.courses.set(course.courseId, {
      ...course,
      title: maskName(course.title),
      topics: [...course.topics],
    });
    this.append('REGISTER_COURSE', { courseId: course.courseId });
  }

  // Plan SC: FR-R534.3
  recommend(learnerId: string, limit = 5): Recommendation[] {
    const learner = this.learners.get(learnerId);
    if (!learner) throw new Error(`학습자 미등록: ${learnerId}`);

    const results: Recommendation[] = [];
    for (const course of this.courses.values()) {
      if (course.enrolled >= course.capacity) continue;
      const reason: string[] = [];
      let score = 0;

      for (const interest of learner.interests) {
        if (course.topics.some(t => t.toLowerCase() === interest.toLowerCase())) {
          score += 30;
          reason.push(`interest:${interest}`);
        }
      }
      if (course.region === learner.region) {
        score += 20;
        reason.push('region-match');
      }
      if (course.level === learner.level) {
        score += 15;
        reason.push('level-match');
      }
      if (score > 0) results.push({ courseId: course.courseId, score, reason });
    }

    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, limit);
    this.append('RECOMMEND', { learnerId, count: top.length });
    return top;
  }

  // Plan SC: FR-R534.4
  enroll(learnerId: string, courseId: string): void {
    if (!this.learners.has(learnerId)) throw new Error(`학습자 미등록: ${learnerId}`);
    const course = this.courses.get(courseId);
    if (!course) throw new Error(`강좌 미등록: ${courseId}`);
    if (course.enrolled >= course.capacity) throw new Error('정원 초과');
    course.enrolled += 1;
    this.append('ENROLL', { learnerId, courseId });
  }

  // Plan SC: FR-R534.5
  listCourses(): Course[] {
    return Array.from(this.courses.values()).map(c => ({ ...c, topics: [...c.topics] }));
  }

  // Plan SC: FR-R534.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
