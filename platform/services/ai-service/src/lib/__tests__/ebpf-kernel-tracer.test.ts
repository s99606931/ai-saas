import { describe, it, expect } from 'vitest';
import { EbpfKernelTracer, type SyscallEvent, type ProcessMapping } from '../ebpf-kernel-tracer';

describe('EbpfKernelTracer', () => {
  const svc = new EbpfKernelTracer();

  const events: SyscallEvent[] = [
    { timestamp: 1000, pid: 101, syscall: 'open', args: { path: '/etc/passwd' }, returnCode: 0, latencyNs: 500 },
    { timestamp: 1001, pid: 101, syscall: 'open', args: { path: '/etc/shadow' }, returnCode: 0, latencyNs: 1200 },
    { timestamp: 1002, pid: 102, syscall: 'exec', args: { path: '/usr/bin/sudo' }, returnCode: 0, latencyNs: 800 },
    { timestamp: 1003, pid: 101, syscall: 'read', args: {}, returnCode: 0, latencyNs: 2_000_000_000 },
  ];

  const mappings: ProcessMapping[] = [
    { pid: 101, containerId: 'c1', serviceName: 'svc-a', namespace: 'default' },
    { pid: 102, containerId: 'c2', serviceName: 'svc-b', namespace: 'default' },
  ];

  it('ingests valid events', () => {
    const valid = svc.ingestEvents(events);
    expect(valid.length).toBe(4);
  });

  it('maps PID to service', () => {
    const mapped = svc.mapToServices(events, mappings);
    expect(mapped.length).toBe(4);
    expect(mapped[0]?.service).toBe('svc-a');
    expect(mapped[2]?.service).toBe('svc-b');
  });

  it('detects anomalies', () => {
    const mapped = svc.mapToServices(events, mappings);
    const flags = svc.detectAnomalies(mapped);
    expect(flags.length).toBeGreaterThanOrEqual(3);
    expect(flags.some((f) => f.severity === 'high')).toBe(true);
  });

  it('converts to OTel spans', () => {
    const mapped = svc.mapToServices(events, mappings);
    const spans = svc.toOtelSpans(mapped, 'trace-1');
    expect(spans.length).toBe(4);
    expect(spans[0]?.traceId).toBe('trace-1');
    expect(spans[0]?.name).toContain('syscall.');
  });

  it('produces audit entries from flags', () => {
    const mapped = svc.mapToServices(events, mappings);
    const flags = svc.detectAnomalies(mapped);
    const audits = svc.toAuditEntries(mapped, flags);
    expect(audits.length).toBe(flags.length);
    expect(audits[0]?.actor).toContain('pid:');
  });
});
