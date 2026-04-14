import { describe, it, expect, beforeEach } from 'vitest';
import { AIPoweredLogParserV3 } from '../ai-powered-log-parser-v3';

describe('AIPoweredLogParserV3', () => {
  let parser: AIPoweredLogParserV3;

  beforeEach(() => {
    parser = new AIPoweredLogParserV3();
  });

  it('parses well-formed log line', () => {
    const r = parser.parse('2026-04-14T10:00:00Z ERROR Service down');
    expect(r.level).toBe('ERROR');
    expect(r.timestamp).toBe('2026-04-14T10:00:00Z');
    expect(r.message).toBe('Service down');
  });

  it('falls back to INFO on unknown level', () => {
    const r = parser.parse('2026-04-14T10:00:00Z VERBOSE hello');
    expect(r.level).toBe('INFO');
  });

  it('masks email and IP PII', () => {
    const r = parser.parse('2026-04-14T10:00:00Z INFO user a@b.gov from 10.0.0.1 logged in');
    expect(r.message).not.toContain('a@b.gov');
    expect(r.message).not.toContain('10.0.0.1');
    expect(r.message).toMatch(/EMAIL_[0-9a-f]{16}/);
    expect(r.message).toMatch(/IP_[0-9a-f]{16}/);
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() => parser.parse('any line', 'C')).toThrow('BLOCKED');
    expect(() => parser.parse('any line', 'S')).toThrow('BLOCKED');
  });

  it('handles unparseable line gracefully', () => {
    const r = parser.parse('totally garbage line');
    expect(r.level).toBe('INFO');
    expect(r.message).toContain('garbage');
  });

  it('records audit log', () => {
    parser.parse('2026-04-14T10:00:00Z INFO ok');
    expect(parser.getAuditLog().some((e) => e.action === 'PARSE_LOG')).toBe(true);
  });
});
