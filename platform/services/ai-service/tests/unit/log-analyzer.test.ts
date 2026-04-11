// SVC-AI-ADV-R30 단위 테스트: LLM 기반 로그 분석기
// Design Ref: SVC-AI-ADV-R30 DESIGN §2, §4, §7
// Plan SC: FR-ADV30.2~30.7
// CSAP: D-06 로그 분석 감사, D-12 보안 이벤트 분석
// N2SF: N-05 PII 마스킹

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  LogAnalyzer,
  getLogAnalyzer,
  resetLogAnalyzer,
} from '../../src/lib/log-analyzer.js';
import type { LogEntry } from '../../src/lib/log-analyzer.js';

// ── 규칙 기반 패턴 분석 — Design §2 ────────────────────────────────────

describe('LogAnalyzer 패턴 분석 (FR-ADV30.2)', () => {
  let analyzer: LogAnalyzer;

  beforeEach(() => {
    analyzer = new LogAnalyzer();
  });

  it('SQL 주입 패턴을 감지한다', () => {
    const logs: LogEntry[] = [
      { timestamp: '2026-04-12T00:00:00Z', level: 'warn', message: "SELECT * FROM users; DROP TABLE users" },
    ];
    const results = analyzer.analyzeByPatterns(logs);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.severity).toBe('critical');
    expect(results[0]!.type).toBe('security_breach');
  });

  it('무차별 대입 공격을 감지한다', () => {
    const logs: LogEntry[] = [
      { timestamp: '2026-04-12T00:00:00Z', level: 'warn', message: 'Failed login authentication failed attempt retry' },
    ];
    const results = analyzer.analyzeByPatterns(logs);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.type).toBe('access_pattern');
  });

  it('경로 순회 공격을 감지한다', () => {
    const logs: LogEntry[] = [
      { timestamp: '2026-04-12T00:00:00Z', level: 'error', message: 'Path: ../../etc/passwd' },
    ];
    const results = analyzer.analyzeByPatterns(logs);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.severity).toBe('critical');
  });

  it('XSS 시도를 감지한다', () => {
    const logs: LogEntry[] = [
      { timestamp: '2026-04-12T00:00:00Z', level: 'warn', message: 'Input: <script>alert(1)</script>' },
    ];
    const results = analyzer.analyzeByPatterns(logs);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.type).toBe('security_breach');
  });

  it('대량 데이터 유출을 감지한다', () => {
    const logs: LogEntry[] = [
      { timestamp: '2026-04-12T00:00:00Z', level: 'info', message: 'bulk export requested for all user data' },
    ];
    const results = analyzer.analyzeByPatterns(logs);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.type).toBe('data_exfiltration');
  });

  it('정상 로그는 빈 결과', () => {
    const logs: LogEntry[] = [
      { timestamp: '2026-04-12T00:00:00Z', level: 'info', message: '사용자가 로그인했습니다.' },
      { timestamp: '2026-04-12T00:00:01Z', level: 'info', message: '요청 처리 완료: 200 OK' },
    ];
    const results = analyzer.analyzeByPatterns(logs);
    expect(results).toHaveLength(0);
  });

  it('빈 로그 목록은 빈 결과', () => {
    expect(analyzer.analyzeByPatterns([])).toHaveLength(0);
  });

  it('여러 패턴을 동시에 감지한다', () => {
    const logs: LogEntry[] = [
      { timestamp: '2026-04-12T00:00:00Z', level: 'error', message: 'SELECT * FROM x; DELETE FROM y' },
      { timestamp: '2026-04-12T00:00:01Z', level: 'warn', message: '<script>alert(1)</script>' },
    ];
    const results = analyzer.analyzeByPatterns(logs);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});

// ── LLM 기반 분석 — Design §2 ─────────────────────────────────────────

describe('LogAnalyzer LLM 분석 (FR-ADV30.2)', () => {
  it('LLM 프로바이더 없이는 null', async () => {
    const analyzer = new LogAnalyzer();
    const result = await analyzer.analyzeByLLM([
      { timestamp: '', level: 'info', message: 'test' },
    ]);
    expect(result).toBeNull();
  });

  it('빈 로그는 null', async () => {
    const analyzer = new LogAnalyzer({
      llmProvider: async () => '{"isAnomaly": false}',
    });
    const result = await analyzer.analyzeByLLM([]);
    expect(result).toBeNull();
  });

  it('LLM 응답을 파싱한다', async () => {
    const analyzer = new LogAnalyzer({
      llmProvider: async () => JSON.stringify({
        isAnomaly: true,
        severity: 'high',
        type: 'security_breach',
        confidence: 0.9,
        reasoning: 'SQL 주입 의심',
        affectedLines: [0],
        suggestedAction: '차단 필요',
      }),
    });
    const result = await analyzer.analyzeByLLM([
      { timestamp: '', level: 'warn', message: 'suspicious query' },
    ]);
    expect(result).not.toBeNull();
    expect(result!.isAnomaly).toBe(true);
    expect(result!.severity).toBe('high');
  });

  it('LLM 파싱 실패 시 기본 결과를 반환한다', async () => {
    const analyzer = new LogAnalyzer({
      llmProvider: async () => '잘못된 응답입니다.',
    });
    const result = await analyzer.analyzeByLLM([
      { timestamp: '', level: 'info', message: 'test' },
    ]);
    expect(result).not.toBeNull();
    expect(result!.isAnomaly).toBe(false);
    expect(result!.confidence).toBeLessThan(0.5);
  });

  it('LLM 오류 시 null', async () => {
    const analyzer = new LogAnalyzer({
      llmProvider: async () => { throw new Error('LLM down'); },
    });
    const result = await analyzer.analyzeByLLM([
      { timestamp: '', level: 'info', message: 'test' },
    ]);
    expect(result).toBeNull();
  });
});

// ── 이력 관리 및 통계 ────────────────────────────────────────────────────

describe('LogAnalyzer 이력 관리', () => {
  let analyzer: LogAnalyzer;

  beforeEach(() => {
    analyzer = new LogAnalyzer();
  });

  it('분석 이력을 저장한다', async () => {
    const logs: LogEntry[] = [
      { timestamp: '', level: 'error', message: 'SELECT * FROM x; DROP TABLE y' },
    ];
    await analyzer.analyze(logs);
    expect(analyzer.getHistory().length).toBeGreaterThan(0);
  });

  it('이력을 초기화한다', async () => {
    await analyzer.analyze([
      { timestamp: '', level: 'error', message: 'SELECT * FROM x; DROP TABLE y' },
    ]);
    analyzer.clearHistory();
    expect(analyzer.getHistory()).toHaveLength(0);
  });

  it('통계 요약을 반환한다', async () => {
    await analyzer.analyze([
      { timestamp: '', level: 'error', message: 'SELECT * FROM x; DROP TABLE y' },
    ]);
    const summary = analyzer.getSummary();
    expect(summary.totalAnalyses).toBeGreaterThan(0);
    expect(summary.anomalyCount).toBeGreaterThan(0);
    expect(summary.bySeverity.critical).toBeGreaterThan(0);
  });
});

// ── 팩토리 함수 ──────────────────────────────────────────────────────────

describe('LogAnalyzer 팩토리', () => {
  afterEach(() => {
    resetLogAnalyzer();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const a1 = getLogAnalyzer();
    const a2 = getLogAnalyzer();
    expect(a1).toBe(a2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const a1 = getLogAnalyzer();
    resetLogAnalyzer();
    const a2 = getLogAnalyzer();
    expect(a1).not.toBe(a2);
  });
});
