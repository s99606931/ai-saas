import { describe, it, expect, beforeEach } from 'vitest'
import { ComplaintAutoRouterV2 } from '../complaint-auto-router-v2'

describe('ComplaintAutoRouterV2', () => {
  let router: ComplaintAutoRouterV2

  beforeEach(() => {
    router = new ComplaintAutoRouterV2()
  })

  it('should register a department', () => {
    router.registerDepartment('d1', 'Tax Office', ['tax', 'finance'])
    expect(router.getAuditLog().length).toBeGreaterThan(0)
  })

  it('should route complaint to matching department', () => {
    router.registerDepartment('d1', 'Tax Office', ['tax', 'finance'])
    router.receiveComplaint('c1', 'citizen-001', 'tax')
    expect(router.getAssignedDepartment('c1')).toBe('d1')
  })

  it('should return null for unroutable category', () => {
    router.registerDepartment('d1', 'Tax', ['tax'])
    router.receiveComplaint('c1', 'citizen-001', 'environment')
    expect(router.getAssignedDepartment('c1')).toBeNull()
  })

  it('should mask citizenId with SHA-256 16-char hex', () => {
    router.registerDepartment('d1', 'Tax', ['tax'])
    router.receiveComplaint('c1', 'citizen-xyz', 'tax')
    const log = router.getAuditLog()
    const entry = log.find((e: { action: string }) => e.action === 'RECEIVE_COMPLAINT')
    expect(entry?.details?.maskedCitizenId).not.toBe('citizen-xyz')
    expect(entry?.details?.maskedCitizenId).toHaveLength(16)
  })

  it('should return pending (unresolved) complaints', () => {
    router.registerDepartment('d1', 'Tax', ['tax'])
    router.receiveComplaint('c1', 'u1', 'tax')
    router.receiveComplaint('c2', 'u2', 'tax')
    expect(router.getPendingComplaints()).toHaveLength(2)
  })

  it('should block C grade data', () => {
    router.registerDepartment('d1', 'X', ['x'])
    expect(() => router.receiveComplaint('c1', 'u1', 'x', 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    router.registerDepartment('d1', 'X', ['x'])
    expect(() => router.receiveComplaint('c1', 'u1', 'x', 'S')).toThrow('BLOCKED')
  })
})
