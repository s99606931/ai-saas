// Design Ref: §R561 — AI기반 공공기관 역량 강화 플랫폼
// Plan SC: SVC-AI-ADV-R561-SC01

export type SkillCategory = 'TECHNICAL' | 'SECURITY' | 'COMPLIANCE' | 'LEADERSHIP' | 'COMMUNICATION'
export type EmployeeRole = 'IT_ADMIN' | 'DEVELOPER' | 'SECURITY_OFFICER' | 'MANAGER' | 'ANALYST'

export interface Skill {
  skillId: string
  category: SkillCategory
  name: string
  currentScore: number    // 0..100
  targetScore: number     // 조직 기준 최소 점수
}

export interface Employee {
  employeeId: string
  name: string
  role: EmployeeRole
  department: string
  skills: Skill[]
  yearsOfExperience: number
}

export interface Course {
  courseId: string
  name: string
  skillCategory: SkillCategory
  durationHours: number
  difficultyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  targetRoles: EmployeeRole[]
}

export interface CapabilityAssessment {
  employeeId: string
  name: string
  overallScore: number
  gapSkills: Skill[]
  recommendedCourses: Course[]
  priorityAreas: SkillCategory[]
}

export interface ProgressRecord {
  employeeId: string
  courseId: string
  progressPct: number
  completedAt: string | null
}

export interface CapabilityReport {
  totalEmployees: number
  avgOverallScore: number
  employeesNeedingTraining: number
  topGapCategories: SkillCategory[]
  recommendations: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  employeeId: string
  detail: Record<string, unknown>
}

export class CapabilityEnhancementPlatformAI {
  private employees = new Map<string, Employee>()
  private courses = new Map<string, Course>()
  private progress = new Map<string, ProgressRecord[]>()
  private auditLog: AuditEntry[] = []

  registerEmployee(employee: Employee): void {
    this.employees.set(employee.employeeId, employee)
    this.progress.set(employee.employeeId, [])
    this.appendAudit('employee.register', employee.employeeId, { role: employee.role, department: employee.department })
  }

  registerCourse(course: Course): void {
    this.courses.set(course.courseId, course)
    this.appendAudit('course.register', course.courseId, { name: course.name, category: course.skillCategory })
  }

  assess(employeeId: string): CapabilityAssessment {
    const employee = this.employees.get(employeeId)
    if (!employee) throw new Error(`Unknown employee: ${employeeId}`)

    const gapSkills = employee.skills.filter((s) => s.currentScore < s.targetScore)
    const overallScore = employee.skills.length > 0
      ? Math.round(employee.skills.reduce((s, sk) => s + sk.currentScore, 0) / employee.skills.length)
      : 0

    const gapCategories = [...new Set(gapSkills.map((s) => s.category))]
    const recommendedCourses = this.findRecommendedCourses(employee, gapCategories)

    this.appendAudit('employee.assess', employeeId, { overallScore, gapCount: gapSkills.length })
    return {
      employeeId,
      name: employee.name,
      overallScore,
      gapSkills,
      recommendedCourses,
      priorityAreas: gapCategories,
    }
  }

  trackProgress(employeeId: string, courseId: string, progressPct: number): void {
    const records = this.progress.get(employeeId) ?? []
    const existing = records.find((r) => r.courseId === courseId)
    if (existing) {
      existing.progressPct = progressPct
      existing.completedAt = progressPct >= 100 ? new Date().toISOString() : null
    } else {
      records.push({ employeeId, courseId, progressPct, completedAt: progressPct >= 100 ? new Date().toISOString() : null })
      this.progress.set(employeeId, records)
    }
    this.appendAudit('progress.track', employeeId, { courseId, progressPct })
  }

  generateReport(): CapabilityReport {
    const allEmployees = Array.from(this.employees.values())
    const assessments = allEmployees.map((e) => this.assess(e.employeeId))
    const avgOverallScore = allEmployees.length > 0
      ? Math.round(assessments.reduce((s, a) => s + a.overallScore, 0) / allEmployees.length)
      : 0
    const employeesNeedingTraining = assessments.filter((a) => a.gapSkills.length > 0).length

    const categoryCounts = new Map<SkillCategory, number>()
    for (const a of assessments) {
      for (const cat of a.priorityAreas) {
        categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
      }
    }
    const topGapCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat)

    const recommendations: string[] = []
    if (employeesNeedingTraining > 0) {
      recommendations.push(`${employeesNeedingTraining}명 역량 강화 교육 필요`)
    }
    if (topGapCategories[0]) {
      recommendations.push(`'${topGapCategories[0]}' 분야 집중 교육 과정 도입 검토`)
    }

    this.appendAudit('report.generate', 'system', { totalEmployees: allEmployees.length, avgOverallScore })
    return {
      totalEmployees: allEmployees.length,
      avgOverallScore,
      employeesNeedingTraining,
      topGapCategories,
      recommendations,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private findRecommendedCourses(employee: Employee, gapCategories: SkillCategory[]): Course[] {
    return Array.from(this.courses.values()).filter(
      (c) => gapCategories.includes(c.skillCategory) && c.targetRoles.includes(employee.role),
    ).slice(0, 5)
  }

  private appendAudit(action: string, employeeId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, employeeId, detail })
  }
}
