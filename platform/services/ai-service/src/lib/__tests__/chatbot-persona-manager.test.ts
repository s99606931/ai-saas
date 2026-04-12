/**
 * Unit tests for Chatbot Persona Manager — SVC-AI-ADV-R97
 */

import { describe, it, expect } from 'vitest'
import { ChatbotPersonaManager } from '../chatbot-persona-manager'

const basePersona = {
  id: 'p1',
  name: '민원봇',
  department: '시민소통과',
  tone: 'FORMAL' as const,
  glossary: { 오후: 'PM' },
  bannedWords: ['바보'],
  systemInstruction: '민원 응대 전문 챗봇',
}

describe('SVC-AI-ADV-R97 ChatbotPersonaManager', () => {
  it('[FR-R97.1] registers and gets persona', () => {
    const mgr = new ChatbotPersonaManager()
    const p = mgr.register(basePersona)
    expect(p.version).toBe(1)
    const fetched = mgr.get('p1')
    expect(fetched.name).toBe('민원봇')
    // base glossary merged
    expect(fetched.glossary.고객님).toBe('민원인')
  })

  it('[FR-R97.5] update bumps version', () => {
    const mgr = new ChatbotPersonaManager()
    mgr.register(basePersona)
    const updated = mgr.update('p1', { tone: 'FRIENDLY' })
    expect(updated.version).toBe(2)
    expect(updated.tone).toBe('FRIENDLY')
  })

  it('[FR-R97.2] buildSystemPrompt contains glossary and tone guidance', () => {
    const mgr = new ChatbotPersonaManager()
    mgr.register(basePersona)
    const prompt = mgr.buildSystemPrompt('p1', '민원 접수 중')
    expect(prompt).toContain('민원봇')
    expect(prompt).toContain('민원인')
    expect(prompt).toContain('격식')
    expect(prompt).toContain('민원 접수 중')
  })

  it('[FR-R97.3] validateResponse detects banned words', () => {
    const mgr = new ChatbotPersonaManager()
    mgr.register(basePersona)
    const result = mgr.validateResponse('p1', '당신은 바보입니다')
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.includes('바보'))).toBe(true)
  })

  it('[FR-R97.4] validateResponse suggests glossary replacements', () => {
    const mgr = new ChatbotPersonaManager()
    mgr.register(basePersona)
    const result = mgr.validateResponse('p1', '고객님 반갑습니다')
    expect(result.suggestions.고객님).toBe('민원인')
  })

  it('[FR-R97.1] duplicate id throws', () => {
    const mgr = new ChatbotPersonaManager()
    mgr.register(basePersona)
    expect(() => mgr.register(basePersona)).toThrow(/already/)
  })

  it('[FR-R97.3] banned base list includes default entries', () => {
    const mgr = new ChatbotPersonaManager()
    mgr.register({ ...basePersona, bannedWords: [] })
    const result = mgr.validateResponse('p1', '멍청하다')
    expect(result.valid).toBe(false)
  })
})
