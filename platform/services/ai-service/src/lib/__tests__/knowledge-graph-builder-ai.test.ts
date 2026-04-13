import { describe, it, expect, beforeEach } from 'vitest';
import { PermitAutoProcessor, type Application } from '../knowledge-graph-builder-ai';

describe('PermitAutoProcessor', () => {
  let processor: PermitAutoProcessor;

  beforeEach(() => {
    processor = new PermitAutoProcessor();
  });

  it('approves building application with all required docs', () => {
    const apps: Application[] = [
      {
        id: 'P1',
        type: 'building',
        applicant: 'Kim',
        documents: ['site_plan', 'structural_report', 'fire_safety', 'zoning_approval'],
      },
    ];
    const results = processor.process(apps);
    expect(results[0]!.decision).toBe('APPROVED');
    expect(results[0]!.missing).toHaveLength(0);
  });

  it('returns NEED_DOCS for business application with 1 missing doc', () => {
    const apps: Application[] = [
      {
        id: 'P2',
        type: 'business',
        applicant: 'Lee',
        documents: ['business_registration', 'tax_certificate'],
      },
    ];
    const results = processor.process(apps);
    expect(results[0]!.decision).toBe('NEED_DOCS');
    expect(results[0]!.missing).toContain('facility_inspection');
  });

  it('sends environment application to REVIEW when docs missing', () => {
    const apps: Application[] = [
      {
        id: 'P3',
        type: 'environment',
        applicant: 'Park',
        documents: ['environmental_impact'],
      },
    ];
    const results = processor.process(apps);
    expect(results[0]!.decision).toBe('REVIEW');
  });

  it('identifies all missing documents for building type', () => {
    const apps: Application[] = [
      {
        id: 'P4',
        type: 'building',
        applicant: 'Choi',
        documents: ['site_plan'],
      },
    ];
    const results = processor.process(apps);
    expect(results[0]!.missing).toContain('structural_report');
    expect(results[0]!.missing).toContain('fire_safety');
    expect(results[0]!.missing).toContain('zoning_approval');
  });

  it('processes multiple applications independently', () => {
    const apps: Application[] = [
      {
        id: 'P5',
        type: 'building',
        applicant: 'A',
        documents: ['site_plan', 'structural_report', 'fire_safety', 'zoning_approval'],
      },
      {
        id: 'P6',
        type: 'business',
        applicant: 'B',
        documents: [],
      },
    ];
    const results = processor.process(apps);
    expect(results[0]!.decision).toBe('APPROVED');
    expect(results[1]!.missing).toHaveLength(3);
  });

  it('records audit log', () => {
    processor.process([
      {
        id: 'P7',
        type: 'business',
        applicant: 'X',
        documents: ['business_registration', 'tax_certificate', 'facility_inspection'],
      },
    ]);
    const log = processor.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('permit.process');
  });
});
