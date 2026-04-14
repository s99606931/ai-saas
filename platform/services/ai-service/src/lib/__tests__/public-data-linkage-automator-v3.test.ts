import { describe, it, expect, beforeEach } from 'vitest';
import { PublicDataLinkageAutomatorV3, type DataSource } from '../public-data-linkage-automator-v3';

describe('PublicDataLinkageAutomatorV3', () => {
  let automator: PublicDataLinkageAutomatorV3;

  beforeEach(() => {
    automator = new PublicDataLinkageAutomatorV3();
  });

  it('computes mappableFields as intersection of fields', () => {
    const a: DataSource = { sourceId: 'A', fields: ['id', 'name', 'age'], grade: 'O' };
    const b: DataSource = { sourceId: 'B', fields: ['id', 'name', 'email'], grade: 'O' };
    const mapping = automator.link(a, b);
    expect(mapping.mappableFields).toEqual(expect.arrayContaining(['id', 'name']));
    expect(mapping.mappableFields).toHaveLength(2);
  });

  it('computes missingInA as fields in B but not A', () => {
    const a: DataSource = { sourceId: 'A', fields: ['id', 'name'], grade: 'O' };
    const b: DataSource = { sourceId: 'B', fields: ['id', 'name', 'email'], grade: 'O' };
    const mapping = automator.link(a, b);
    expect(mapping.missingInA).toContain('email');
  });

  it('computes missingInB as fields in A but not B', () => {
    const a: DataSource = { sourceId: 'A', fields: ['id', 'name', 'age'], grade: 'O' };
    const b: DataSource = { sourceId: 'B', fields: ['id', 'name'], grade: 'O' };
    const mapping = automator.link(a, b);
    expect(mapping.missingInB).toContain('age');
  });

  it('throws BLOCKED for C grade source', () => {
    const a: DataSource = { sourceId: 'A', fields: ['id'], grade: 'C' };
    const b: DataSource = { sourceId: 'B', fields: ['id'], grade: 'O' };
    expect(() => automator.link(a, b)).toThrow('BLOCKED');
  });

  it('computes compatibilityScore as intersection/union * 100', () => {
    const a: DataSource = { sourceId: 'A', fields: ['id', 'name', 'age'], grade: 'O' };
    const b: DataSource = { sourceId: 'B', fields: ['id', 'name', 'email'], grade: 'O' };
    const mapping = automator.link(a, b);
    // intersection=2, union=4 → 50
    expect(mapping.compatibilityScore).toBe(50);
  });

  it('records audit log', () => {
    const a: DataSource = { sourceId: 'X', fields: ['f1'], grade: 'O' };
    const b: DataSource = { sourceId: 'Y', fields: ['f1', 'f2'], grade: 'O' };
    automator.link(a, b);
    const log = automator.getAuditLog();
    expect(log.some(e => e.action === 'linkage.analyze')).toBe(true);
  });
});
