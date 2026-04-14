import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityPatchPrioritizerV2 } from '../security-patch-prioritizer-v2'

describe('SecurityPatchPrioritizerV2', () => {
  let prioritizer: SecurityPatchPrioritizerV2

  beforeEach(() => {
    prioritizer = new SecurityPatchPrioritizerV2()
  })

  it('패치 등록 후 조회 가능', () => {
    const patch = prioritizer.registerPatch('patch-1', 'Log4Shell', 10.0, ['sys-a', 'sys-b'])
    expect(patch.patchId).toBe('patch-1')
    expect(patch.status).toBe('pending')
  })

  it('우선순위 점수: cvssScore*10 + systems*5', () => {
    prioritizer.registerPatch('patch-1', 'Log4Shell', 9.8, ['sys-a', 'sys-b'])
    expect(prioritizer.getPriorityScore('patch-1')).toBe(9.8 * 10 + 2 * 5)
  })

  it('getPrioritizedPatches: 점수 내림차순 정렬', () => {
    prioritizer.registerPatch('patch-1', 'Low', 3.0, ['sys-a'])
    prioritizer.registerPatch('patch-2', 'High', 9.8, ['sys-a', 'sys-b', 'sys-c'])
    const sorted = prioritizer.getPrioritizedPatches()
    expect(sorted[0]!.patchId).toBe('patch-2')
    expect(sorted[1]!.patchId).toBe('patch-1')
  })

  it('패치 상태 업데이트', () => {
    prioritizer.registerPatch('patch-1', 'Log4Shell', 9.8, ['sys-a'])
    prioritizer.updateStatus('patch-1', 'applied')
    const patches = prioritizer.getPrioritizedPatches()
    const patch = patches.find((p) => p.patchId === 'patch-1')
    expect(patch?.status).toBe('applied')
  })

  it('C등급 데이터 전송 차단', () => {
    prioritizer.registerPatch('patch-1', 'Log4Shell', 9.8, ['sys-a'])
    expect(() => prioritizer.updateStatus('patch-1', 'applied', 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    prioritizer.registerPatch('patch-1', 'Log4Shell', 9.8, ['sys-a'])
    expect(() => prioritizer.updateStatus('patch-1', 'applied', 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    prioritizer.registerPatch('patch-1', 'Log4Shell', 9.8, ['sys-a'])
    prioritizer.updateStatus('patch-1', 'applied')
    const log = prioritizer.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
