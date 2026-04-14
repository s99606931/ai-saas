import { describe, it, expect, beforeEach } from 'vitest';
import { DigitalTwinSyncAIV2 } from '../digital-twin-sync-ai-v2';

describe('DigitalTwinSyncAIV2', () => {
  let twin: DigitalTwinSyncAIV2;

  beforeEach(() => {
    twin = new DigitalTwinSyncAIV2();
  });

  it('registers entity and reports SYNCED with no samples', () => {
    twin.registerEntity('e1', 'traffic-sensor', 50);
    const r = twin.evaluate('e1');
    expect(r.status).toBe('SYNCED');
    expect(r.samples).toBe(0);
  });

  it('classifies SYNCED when avg delta <= 0.05', () => {
    twin.registerEntity('e1', 'sensor', 10);
    twin.ingestSample('e1', 10.02);
    twin.ingestSample('e1', 10.01);
    expect(twin.evaluate('e1').status).toBe('SYNCED');
  });

  it('classifies DRIFT when avg delta between 0.05 and 0.15', () => {
    twin.registerEntity('e1', 'sensor', 10);
    twin.ingestSample('e1', 10.1);
    twin.ingestSample('e1', 10.12);
    expect(twin.evaluate('e1').status).toBe('DRIFT');
  });

  it('classifies OUT_OF_SYNC when avg delta > 0.15', () => {
    twin.registerEntity('e1', 'sensor', 10);
    twin.ingestSample('e1', 10.5);
    twin.ingestSample('e1', 10.3);
    expect(twin.evaluate('e1').status).toBe('OUT_OF_SYNC');
  });

  it('blocks C/S grade ingestion (N2SF N-05)', () => {
    twin.registerEntity('e1', 'sensor', 10);
    expect(() => twin.ingestSample('e1', 11, 'C')).toThrow('BLOCKED');
    expect(() => twin.ingestSample('e1', 11, 'S')).toThrow('BLOCKED');
  });

  it('maintains audit log for register and sample events', () => {
    twin.registerEntity('e1', 'sensor', 10);
    twin.ingestSample('e1', 10.1);
    twin.evaluate('e1');
    const log = twin.getAuditLog();
    expect(log.some((e) => e.action === 'REGISTER_ENTITY')).toBe(true);
    expect(log.some((e) => e.action === 'INGEST_SAMPLE')).toBe(true);
    expect(log.some((e) => e.action === 'EVALUATE')).toBe(true);
  });
});
