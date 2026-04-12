/**
 * Unit tests for Multi-Tenant Model Fine-tuner — SVC-AI-ADV-R105
 */

import { describe, it, expect } from 'vitest'
import { MultiTenantModelFinetuner } from '../multi-tenant-model-finetuner'

describe('SVC-AI-ADV-R105 MultiTenantModelFinetuner', () => {
  it('[FR-R105.1] submits a fine-tune job', () => {
    const f = new MultiTenantModelFinetuner()
    const job = f.submitFineTuneJob('tenant-A', 'phi-3-mini', 'sha256:abc', 'O')
    expect(job.tenantId).toBe('tenant-A')
    expect(job.status).toBe('queued')
  })

  it('[FR-R105.1/N2SF N-05] blocks C/S grade data', () => {
    const f = new MultiTenantModelFinetuner()
    expect(() =>
      f.submitFineTuneJob('t', 'm', 'h', 'C'),
    ).toThrow(/BLOCKED/)
    expect(() =>
      f.submitFineTuneJob('t', 'm', 'h', 'S'),
    ).toThrow(/BLOCKED/)
  })

  it('[FR-R105.2] updates job status to succeeded with version tag', () => {
    const f = new MultiTenantModelFinetuner()
    const job = f.submitFineTuneJob('tenant-A', 'base', 'h', 'O')
    const updated = f.updateJobStatus(
      'tenant-A',
      job.jobId,
      'succeeded',
      'v1',
    )
    expect(updated.status).toBe('succeeded')
    expect(updated.modelVersionTag).toBe('v1')
    const versions = f.listVersions('tenant-A')
    expect(versions).toHaveLength(1)
    expect(versions[0]!.versionTag).toBe('v1')
  })

  it('[FR-R105.2] requires versionTag on succeeded', () => {
    const f = new MultiTenantModelFinetuner()
    const job = f.submitFineTuneJob('tenant-A', 'base', 'h', 'O')
    expect(() =>
      f.updateJobStatus('tenant-A', job.jobId, 'succeeded'),
    ).toThrow(/modelVersionTag required/)
  })

  it('[FR-R105] blocks tenant isolation violation', () => {
    const f = new MultiTenantModelFinetuner()
    const job = f.submitFineTuneJob('tenant-A', 'base', 'h', 'O')
    expect(() =>
      f.updateJobStatus('tenant-B', job.jobId, 'running'),
    ).toThrow(/tenant isolation/)
  })

  it('[FR-R105.3] promotes version and deactivates previous', () => {
    const f = new MultiTenantModelFinetuner()
    const j1 = f.submitFineTuneJob('tenant-A', 'b', 'h1', 'O')
    f.updateJobStatus('tenant-A', j1.jobId, 'succeeded', 'v1')
    const j2 = f.submitFineTuneJob('tenant-A', 'b', 'h2', 'O')
    f.updateJobStatus('tenant-A', j2.jobId, 'succeeded', 'v2')
    f.promoteVersion('tenant-A', 'v1')
    f.promoteVersion('tenant-A', 'v2')
    const versions = f.listVersions('tenant-A')
    const active = versions.filter((v) => v.isActive)
    expect(active).toHaveLength(1)
    expect(active[0]!.versionTag).toBe('v2')
  })

  it('[FR-R105.4] rollback switches to previous active version', () => {
    const f = new MultiTenantModelFinetuner({ idGen: () => `j${Math.random()}` })
    const j1 = f.submitFineTuneJob('tenant-A', 'b', 'h1', 'O')
    f.updateJobStatus('tenant-A', j1.jobId, 'succeeded', 'v1')
    f.promoteVersion('tenant-A', 'v1')
    // 짧은 대기 후 v2
    const j2 = f.submitFineTuneJob('tenant-A', 'b', 'h2', 'O')
    f.updateJobStatus('tenant-A', j2.jobId, 'succeeded', 'v2')
    f.promoteVersion('tenant-A', 'v2')
    const back = f.rollback('tenant-A')
    expect(back).not.toBeNull()
    expect(back!.versionTag).toBe('v1')
  })

  it('[FR-R105.4] rollback returns null when no active', () => {
    const f = new MultiTenantModelFinetuner()
    expect(f.rollback('tenant-X')).toBeNull()
  })

  it('[FR-R105.5] listVersions isolates tenants', () => {
    const f = new MultiTenantModelFinetuner()
    const a = f.submitFineTuneJob('tenant-A', 'b', 'h', 'O')
    f.updateJobStatus('tenant-A', a.jobId, 'succeeded', 'vA')
    const b = f.submitFineTuneJob('tenant-B', 'b', 'h', 'O')
    f.updateJobStatus('tenant-B', b.jobId, 'succeeded', 'vB')
    expect(f.listVersions('tenant-A').map((v) => v.versionTag)).toEqual(['vA'])
    expect(f.listVersions('tenant-B').map((v) => v.versionTag)).toEqual(['vB'])
  })

  it('[CSAP D-06] audit log records all actions', () => {
    const f = new MultiTenantModelFinetuner()
    const j = f.submitFineTuneJob('tenant-A', 'b', 'h', 'O')
    f.updateJobStatus('tenant-A', j.jobId, 'succeeded', 'v1')
    f.promoteVersion('tenant-A', 'v1')
    const actions = f.getAuditLog().map((l) => l.action)
    expect(actions).toContain('submitFineTuneJob')
    expect(actions).toContain('updateJobStatus')
    expect(actions).toContain('promoteVersion')
  })
})
