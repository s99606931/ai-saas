import { describe, it, expect, beforeEach } from 'vitest'
import { ApiVersionMigrationV2 } from '../api-version-migration-v2'

describe('ApiVersionMigrationV2', () => {
  let migrator: ApiVersionMigrationV2

  beforeEach(() => { migrator = new ApiVersionMigrationV2() })

  it('should register a version', () => {
    migrator.registerVersion('v1', 'user-api', '1.0', 10)
    expect(migrator.getDeprecatedVersions()).toHaveLength(0)
  })

  it('should deprecate a version', () => {
    migrator.registerVersion('v1', 'user-api', '1.0', 10)
    migrator.deprecateVersion('v1')
    expect(migrator.getDeprecatedVersions()).toHaveLength(1)
  })

  it('should compute migration progress as migratedEndpoints/totalEndpoints*100', () => {
    migrator.registerVersion('v1', 'user-api', '1.0', 10)
    migrator.registerVersion('v2', 'user-api', '2.0', 10)
    migrator.recordMigration('m1', 'v1', 'v2', 6, 10)
    expect(migrator.getMigrationProgress('m1')).toBe(60)
  })

  it('should return 0 for unknown migration', () => {
    expect(migrator.getMigrationProgress('unknown')).toBe(0)
  })

  it('should block C grade data', () => {
    migrator.registerVersion('v1', 'api', '1.0', 5)
    migrator.registerVersion('v2', 'api', '2.0', 5)
    expect(() => migrator.recordMigration('m1', 'v1', 'v2', 2, 5, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    migrator.registerVersion('v1', 'api', '1.0', 5)
    migrator.registerVersion('v2', 'api', '2.0', 5)
    expect(() => migrator.recordMigration('m1', 'v1', 'v2', 2, 5, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    migrator.registerVersion('v1', 'api', '1.0', 5)
    migrator.deprecateVersion('v1')
    expect(migrator.getAuditLog().length).toBeGreaterThan(0)
  })
})
