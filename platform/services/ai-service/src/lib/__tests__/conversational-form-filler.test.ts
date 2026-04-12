/**
 * Unit tests for Conversational Form Filler — SVC-AI-ADV-R106
 */

import { describe, it, expect } from 'vitest'
import {
  ConversationalFormFiller,
  type FormSchema,
} from '../conversational-form-filler'

const civilComplaint: FormSchema = {
  formId: 'civil-complaint',
  title: '민원 접수',
  fields: [
    { id: 'name', label: '성명', type: 'text', required: true },
    { id: 'phone', label: '연락처', type: 'phone', required: true, pii: true },
    { id: 'email', label: '이메일', type: 'email', required: false, pii: true },
    { id: 'category', label: '분류', type: 'enum', required: true, options: ['도로', '환경', '복지'] },
    { id: 'date', label: '발생일', type: 'date', required: true },
  ],
}

describe('SVC-AI-ADV-R106 ConversationalFormFiller', () => {
  it('[FR-R106.1] registers a form schema', () => {
    const f = new ConversationalFormFiller()
    f.registerForm(civilComplaint)
    expect(f.getAuditLog()[0]!.action).toBe('registerForm')
  })

  it('[FR-R106.1] rejects empty fields', () => {
    const f = new ConversationalFormFiller()
    expect(() =>
      f.registerForm({ formId: 'x', title: 't', fields: [] }),
    ).toThrow(/at least one field/)
  })

  it('[FR-R106.2] starts a session', () => {
    const f = new ConversationalFormFiller()
    f.registerForm(civilComplaint)
    const s = f.startSession('s1', 'civil-complaint')
    expect(s.sessionId).toBe('s1')
    expect(s.slots).toEqual({})
  })

  it('[FR-R106.3/N2SF N-05] blocks C/S grade utterance', () => {
    const f = new ConversationalFormFiller()
    f.registerForm(civilComplaint)
    f.startSession('s1', 'civil-complaint')
    expect(() => f.processUtterance('s1', 'hi', 'C')).toThrow(/BLOCKED/)
  })

  it('[FR-R106.3] extracts phone and masks PII on storage', () => {
    const f = new ConversationalFormFiller()
    f.registerForm(civilComplaint)
    f.startSession('s1', 'civil-complaint')
    const result = f.processUtterance(
      's1',
      '연락처 010-1234-5678 입니다',
      'O',
    )
    expect(result.filled).toContain('phone')
    const missing = f.getMissingRequiredFields('s1')
    expect(missing.some((m) => m.id === 'phone')).toBe(false)
    // PII 마스킹 확인
    const stored = (f as unknown as { sessions: Map<string, { slots: Record<string, string> }> }).sessions.get('s1')!
    expect(stored.slots.phone).toMatch(/010-\*{4}-5678/)
  })

  it('[FR-R106.3] extracts date in ISO format', () => {
    const f = new ConversationalFormFiller()
    f.registerForm(civilComplaint)
    f.startSession('s1', 'civil-complaint')
    f.processUtterance('s1', '발생일 2026-04-10 사건', 'O')
    const missing = f.getMissingRequiredFields('s1')
    expect(missing.some((m) => m.id === 'date')).toBe(false)
  })

  it('[FR-R106.3] extracts enum option', () => {
    const f = new ConversationalFormFiller()
    f.registerForm(civilComplaint)
    f.startSession('s1', 'civil-complaint')
    const result = f.processUtterance('s1', '분류 도로 문제입니다', 'O')
    expect(result.filled).toContain('category')
  })

  it('[FR-R106.4] reports missing required fields', () => {
    const f = new ConversationalFormFiller()
    f.registerForm(civilComplaint)
    f.startSession('s1', 'civil-complaint')
    const missing = f.getMissingRequiredFields('s1')
    expect(missing.map((m) => m.id).sort()).toEqual([
      'category',
      'date',
      'name',
      'phone',
    ])
  })

  it('[FR-R106.5] finalize throws when incomplete', () => {
    const f = new ConversationalFormFiller()
    f.registerForm(civilComplaint)
    f.startSession('s1', 'civil-complaint')
    expect(() => f.finalize('s1')).toThrow(/incomplete/)
  })

  it('[FR-R106.5] finalize returns record when complete', () => {
    const f = new ConversationalFormFiller()
    f.registerForm(civilComplaint)
    f.startSession('s1', 'civil-complaint')
    f.processUtterance('s1', '성명 홍길동', 'O')
    f.processUtterance('s1', '연락처 010-1234-5678', 'O')
    f.processUtterance('s1', '분류 도로', 'O')
    f.processUtterance('s1', '발생일 2026-04-10', 'O')
    const record = f.finalize('s1')
    expect(record.name).toBe('홍길동')
    expect(record.phone).toMatch(/010-\*{4}-5678/)
    expect(record.category).toBe('도로')
    expect(record.date).toBe('2026-04-10')
  })

  it('[CSAP D-06] audit log contains finalize action', () => {
    const f = new ConversationalFormFiller()
    f.registerForm(civilComplaint)
    f.startSession('s1', 'civil-complaint')
    f.processUtterance('s1', '성명 홍길동 연락처 010-1234-5678 분류 도로 발생일 2026-04-10', 'O')
    f.finalize('s1')
    const actions = f.getAuditLog().map((l) => l.action)
    expect(actions).toContain('finalize')
  })
})
