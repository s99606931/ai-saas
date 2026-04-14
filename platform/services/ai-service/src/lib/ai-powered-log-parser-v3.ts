// Design Ref: SVC-AI-ADV-R664.design.md — AI기반 로그 자동 파싱 v3
// Plan SC: FR-R664.1~5

import { createHash } from 'crypto';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

interface ParsedLog {
  timestamp: string;
  level: LogLevel;
  message: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const VALID_LEVELS: ReadonlySet<LogLevel> = new Set([
  'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL',
]);

const LOG_REGEX = /^\[?(?<ts>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\]?\s+(?<lvl>[A-Z]+)\s+(?<msg>.+)$/;
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

function maskValue(v: string): string {
  return createHash('sha256').update(v).digest('hex').substring(0, 16);
}

function maskPII(input: string): string {
  return input
    .replace(EMAIL_REGEX, (m) => `EMAIL_${maskValue(m)}`)
    .replace(IPV4_REGEX, (m) => `IP_${maskValue(m)}`);
}

export class AIPoweredLogParserV3 {
  private auditLog: AuditEntry[] = [];

  parse(line: string, dataGrade?: string): ParsedLog {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const m = LOG_REGEX.exec(line);
    let parsed: ParsedLog;
    if (m && m.groups) {
      const rawLevel = (m.groups['lvl'] ?? 'INFO').toUpperCase();
      const level: LogLevel = VALID_LEVELS.has(rawLevel as LogLevel)
        ? (rawLevel as LogLevel)
        : 'INFO';
      parsed = {
        timestamp: m.groups['ts'] ?? new Date().toISOString(),
        level,
        message: maskPII(m.groups['msg'] ?? ''),
      };
    } else {
      parsed = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: maskPII(line),
      };
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'PARSE_LOG',
      details: { level: parsed.level },
    });
    return parsed;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
