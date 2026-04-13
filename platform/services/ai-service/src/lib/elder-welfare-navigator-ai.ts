// Plan SC: SVC-AI-ADV-R635
// Design Ref: §PROGRAM_MATCH — 노인 복지 프로그램 자격/욕구 매칭 알고리즘

type DataGrade = 'O' | 'C' | 'S'
type WelfareNeed = 'healthcare' | 'meal' | 'housing' | 'leisure' | 'transport'

interface WelfareProgram {
  programId: string
  name: string
  minAge: number
  maxAge: number
  needs: WelfareNeed[]
  incomeLimit: number
  slots: number
}

interface EldersProfile {
  profileId: string
  age: number
  monthlyIncome: number
  needs: WelfareNeed[]
}

interface MatchResult {
  profileId: string
  matches: Array<{ programId: string; score: number }>
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export class ElderWelfareNavigatorAI {
  private programs = new Map<string, WelfareProgram>()
  private auditLog: AuditEntry[] = []

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerProgram(program: WelfareProgram): WelfareProgram {
    this.programs.set(program.programId, program)
    this.log('program.register', `programId=${program.programId}`)
    return program
  }

  findMatches(profile: EldersProfile, grade: DataGrade = 'O'): MatchResult {
    blockClassifiedData(grade)
    const matches: Array<{ programId: string; score: number }> = []

    for (const program of this.programs.values()) {
      if (profile.age < program.minAge || profile.age > program.maxAge) continue
      if (profile.monthlyIncome > program.incomeLimit) continue
      if (program.slots <= 0) continue

      const overlap = profile.needs.filter((n) => program.needs.includes(n)).length
      if (overlap === 0) continue
      const score = Math.round((overlap / profile.needs.length) * 100)
      matches.push({ programId: program.programId, score })
    }

    matches.sort((a, b) => b.score - a.score)
    this.log(
      'matches.find',
      `profileId=${profile.profileId} matches=${matches.length}`,
    )
    return { profileId: profile.profileId, matches }
  }

  reserveSlot(programId: string): boolean {
    const p = this.programs.get(programId)
    if (!p || p.slots <= 0) return false
    p.slots -= 1
    this.log('slot.reserve', `programId=${programId} remaining=${p.slots}`)
    return true
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
