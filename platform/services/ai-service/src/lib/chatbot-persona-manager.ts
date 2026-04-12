/**
 * Chatbot Persona Manager — SVC-AI-ADV-R97
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R97.design.md
 * Plan SC: FR-R97.1 ~ FR-R97.5
 *
 * 부서/업무별 AI 응답 톤앤매너 + 공공기관 언어 표준 관리.
 */

export type Tone = 'FORMAL' | 'FRIENDLY' | 'CONCISE' | 'EMPATHETIC'

export interface Persona {
  id: string
  name: string
  department: string
  tone: Tone
  glossary: Record<string, string>
  bannedWords: string[]
  systemInstruction: string
  version: number
  updatedAt: string
}

export interface ValidationResult {
  valid: boolean
  violations: string[]
  suggestions: Record<string, string>
}

const PUBLIC_GLOSSARY_BASE: Record<string, string> = {
  고객님: '민원인',
  '저희 회사': '저희 기관',
  구매: '신청',
  상품: '서비스',
  직원: '담당자',
}

const BANNED_BASE = ['바보', '멍청', '나쁜놈']

const TONE_GUIDANCE: Record<Tone, string> = {
  FORMAL: '격식 있는 존댓말을 사용하고, 공식 문어체를 유지하세요.',
  FRIENDLY: '친근하지만 공손한 어조로, 이용자가 편안하도록 응대하세요.',
  CONCISE: '핵심만 간결하게 3문장 이내로 응답하세요.',
  EMPATHETIC: '이용자의 상황에 공감하며 정중한 어조로 응답하세요.',
}

export class ChatbotPersonaManager {
  private readonly personas = new Map<string, Persona>()

  /**
   * FR-R97.1: 페르소나 등록.
   */
  register(input: Omit<Persona, 'version' | 'updatedAt'>): Persona {
    if (this.personas.has(input.id)) {
      throw new Error(`persona already exists: ${input.id}`)
    }
    const persona: Persona = {
      ...input,
      glossary: { ...PUBLIC_GLOSSARY_BASE, ...input.glossary },
      bannedWords: [...new Set([...BANNED_BASE, ...input.bannedWords])],
      version: 1,
      updatedAt: new Date().toISOString(),
    }
    this.personas.set(persona.id, persona)
    return persona
  }

  /**
   * FR-R97.5: 페르소나 버저닝 업데이트.
   */
  update(id: string, patch: Partial<Persona>): Persona {
    const existing = this.personas.get(id)
    if (!existing) throw new Error(`persona not found: ${id}`)
    const updated: Persona = {
      ...existing,
      ...patch,
      id: existing.id,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
      glossary: {
        ...existing.glossary,
        ...(patch.glossary ?? {}),
      },
      bannedWords: patch.bannedWords
        ? [...new Set([...BANNED_BASE, ...patch.bannedWords])]
        : existing.bannedWords,
    }
    this.personas.set(id, updated)
    return updated
  }

  get(id: string): Persona {
    const p = this.personas.get(id)
    if (!p) throw new Error(`persona not found: ${id}`)
    return p
  }

  /**
   * FR-R97.2: 시스템 프롬프트 생성.
   */
  buildSystemPrompt(id: string, userContext?: string): string {
    const p = this.get(id)
    const parts = [
      `당신은 "${p.name}" (${p.department}) 페르소나입니다.`,
      `역할: ${p.systemInstruction}`,
      `어조: ${TONE_GUIDANCE[p.tone]}`,
      '공공기관 표준 용어 사용 필수:',
      ...Object.entries(p.glossary).map(([from, to]) => `  - "${from}" → "${to}"`),
      `금칙어 절대 사용 금지: ${p.bannedWords.join(', ')}`,
    ]
    if (userContext) {
      parts.push(`현재 문맥: ${userContext}`)
    }
    return parts.join('\n')
  }

  /**
   * FR-R97.3, FR-R97.4: 응답 검증 + 치환 제안.
   */
  validateResponse(id: string, text: string): ValidationResult {
    const p = this.get(id)
    const violations: string[] = []
    const suggestions: Record<string, string> = {}

    for (const banned of p.bannedWords) {
      if (text.includes(banned)) {
        violations.push(`banned word: ${banned}`)
      }
    }

    for (const [from, to] of Object.entries(p.glossary)) {
      if (text.includes(from)) {
        suggestions[from] = to
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      suggestions,
    }
  }
}
