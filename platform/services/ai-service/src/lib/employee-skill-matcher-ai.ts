// Design Ref: §R413 — AI기반 공공기관 직원 역량 자동 매칭
// Plan SC: SC-R413

export interface EmployeeProfile {
  employeeId: string
  name: string
  skills: string[]
  yearsOfExperience: number
  department: string
}

export interface ProjectRequirement {
  projectId: string
  requiredSkills: string[]
  minExperienceYears: number
}

export interface EmployeeMatch {
  employeeId: string
  maskedEmployeeId: string
  name: string
  matchScore: number
  matchedSkills: string[]
  meetsExperience: boolean
}

export interface SkillMatchResult {
  projectId: string
  totalCandidates: number
  matches: EmployeeMatch[]
  topCandidate: string | null
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskEmployeeId(employeeId: string): string {
  if (employeeId.length <= 3) return '*'.repeat(employeeId.length)
  return employeeId.slice(0, 2) + '*'.repeat(employeeId.length - 4) + employeeId.slice(-2)
}

export class EmployeeSkillMatcherAi {
  private employees = new Map<string, EmployeeProfile>()
  private auditLog: AuditEntry[] = []

  registerEmployee(employee: EmployeeProfile): void {
    this.employees.set(employee.employeeId, employee)
    this.auditLog.push({ action: 'employee.register', timestamp: new Date().toISOString(), detail: maskEmployeeId(employee.employeeId) })
  }

  match(requirement: ProjectRequirement, matchCount = 3): SkillMatchResult {
    const matches: EmployeeMatch[] = []

    for (const employee of this.employees.values()) {
      const matchedSkills = employee.skills.filter((s) => requirement.requiredSkills.includes(s))
      if (matchedSkills.length === 0) continue

      const baseScore = Math.round((matchedSkills.length / requirement.requiredSkills.length) * 100)
      const experienceBonus = employee.yearsOfExperience >= 5 ? 10 : 0
      const matchScore = Math.min(100, baseScore + experienceBonus)
      const meetsExperience = employee.yearsOfExperience >= requirement.minExperienceYears

      matches.push({
        employeeId: employee.employeeId,
        maskedEmployeeId: maskEmployeeId(employee.employeeId),
        name: employee.name,
        matchScore,
        matchedSkills,
        meetsExperience,
      })
    }

    matches.sort((a, b) => b.matchScore - a.matchScore)
    const topMatches = matches.slice(0, matchCount)
    const topCandidate = topMatches.length > 0 ? topMatches[0]!.maskedEmployeeId : null

    this.auditLog.push({ action: 'skill.match', timestamp: new Date().toISOString(), detail: `${requirement.projectId}:${topMatches.length}명` })
    return {
      projectId: requirement.projectId,
      totalCandidates: matches.length,
      matches: topMatches,
      topCandidate,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
