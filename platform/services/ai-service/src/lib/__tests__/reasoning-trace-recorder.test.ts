/**
 * Tests — SVC-AI-ADV-R143 Reasoning Trace Recorder
 */

import { describe, it, expect } from 'vitest'
import { ReasoningTraceRecorder } from '../reasoning-trace-recorder'

function makeRecorder() {
  let t = 1_700_000_000_000
  return new ReasoningTraceRecorder({
    now: () => {
      t += 1
      return t
    },
    maxStepsPerTrace: 5,
  })
}

describe('ReasoningTraceRecorder', () => {
  it('start + addStep + close 결정론적 해시', () => {
    const r = makeRecorder()
    const id = r.start('민원 분류')
    r.addStep(id, {
      name: 'intent-detect',
      inputSummary: 'hash:abc',
      outputSummary: 'intent=complaint',
      confidence: 0.8,
      durationMs: 120,
    })
    r.addStep(id, {
      name: 'route',
      inputSummary: 'intent=complaint',
      outputSummary: 'route=dept-civil',
      confidence: 0.9,
      durationMs: 10,
    })
    const trace = r.close(id)
    expect(trace.status).toBe('CLOSED')
    expect(trace.chainHash).toBeDefined()
    expect(trace.chainHash!.length).toBe(64)
    expect(trace.avgConfidence).toBeCloseTo(0.85, 5)
  })

  it('동일 입력 결정론적 해시', () => {
    const r1 = makeRecorder()
    const r2 = makeRecorder()
    const stepA = {
      name: 'a',
      inputSummary: 'x',
      outputSummary: 'y',
      confidence: 0.7,
      durationMs: 1,
    }
    const id1 = r1.start('t')
    r1.addStep(id1, stepA)
    const id2 = r2.start('t')
    r2.addStep(id2, stepA)
    expect(r1.close(id1).chainHash).toBe(r2.close(id2).chainHash)
  })

  it('닫힌 트레이스에 추가 시 오류', () => {
    const r = makeRecorder()
    const id = r.start('t')
    r.close(id)
    expect(() =>
      r.addStep(id, {
        name: 'late',
        inputSummary: 'x',
        outputSummary: 'y',
        confidence: 0.5,
        durationMs: 1,
      }),
    ).toThrow('trace_closed')
  })

  it('존재하지 않는 trace 오류', () => {
    const r = makeRecorder()
    expect(() =>
      r.addStep('no', {
        name: 'x',
        inputSummary: '',
        outputSummary: '',
        confidence: 0.1,
        durationMs: 1,
      }),
    ).toThrow('trace_not_found')
    expect(() => r.close('missing')).toThrow('trace_not_found')
  })

  it('confidence 범위 검증', () => {
    const r = makeRecorder()
    const id = r.start('t')
    expect(() =>
      r.addStep(id, {
        name: 'x',
        inputSummary: '',
        outputSummary: '',
        confidence: 1.5,
        durationMs: 1,
      }),
    ).toThrow('invalid_confidence')
    expect(() =>
      r.addStep(id, {
        name: 'x',
        inputSummary: '',
        outputSummary: '',
        confidence: -0.1,
        durationMs: 1,
      }),
    ).toThrow('invalid_confidence')
  })

  it('duration 음수 오류', () => {
    const r = makeRecorder()
    const id = r.start('t')
    expect(() =>
      r.addStep(id, {
        name: 'x',
        inputSummary: '',
        outputSummary: '',
        confidence: 0.5,
        durationMs: -1,
      }),
    ).toThrow('invalid_duration')
  })

  it('step 수 상한 초과', () => {
    const r = makeRecorder()
    const id = r.start('t')
    for (let i = 0; i < 5; i += 1) {
      r.addStep(id, {
        name: `s${i}`,
        inputSummary: '',
        outputSummary: '',
        confidence: 0.5,
        durationMs: 1,
      })
    }
    expect(() =>
      r.addStep(id, {
        name: 'over',
        inputSummary: '',
        outputSummary: '',
        confidence: 0.5,
        durationMs: 1,
      }),
    ).toThrow('step_limit_exceeded')
  })

  it('C/S등급 차단', () => {
    const r = makeRecorder()
    expect(() => r.start('t', 'C')).toThrow('grade_blocked')
    const id = r.start('t')
    expect(() =>
      r.addStep(
        id,
        {
          name: 'x',
          inputSummary: '',
          outputSummary: '',
          confidence: 0.5,
          durationMs: 1,
        },
        'S',
      ),
    ).toThrow('grade_blocked')
  })

  it('잘못된 label', () => {
    const r = makeRecorder()
    expect(() => r.start('')).toThrow('invalid_label')
  })

  it('list + get + getAuditLog', () => {
    const r = makeRecorder()
    const id = r.start('t')
    r.addStep(id, {
      name: 's',
      inputSummary: 'i',
      outputSummary: 'o',
      confidence: 0.6,
      durationMs: 5,
    })
    r.close(id)
    expect(r.get(id)?.status).toBe('CLOSED')
    expect(r.list().length).toBe(1)
    const log = r.getAuditLog()
    expect(log.some((e) => e.event === 'trace_started')).toBe(true)
    expect(log.some((e) => e.event === 'trace_closed')).toBe(true)
  })

  it('close 멱등성', () => {
    const r = makeRecorder()
    const id = r.start('t')
    const first = r.close(id)
    const second = r.close(id)
    expect(first.chainHash).toBe(second.chainHash)
  })

  it('빈 트레이스 해시 기본값', () => {
    const r = makeRecorder()
    const id = r.start('empty')
    const trace = r.close(id)
    expect(trace.chainHash).toBeDefined()
    expect(trace.avgConfidence).toBe(0)
  })
})
