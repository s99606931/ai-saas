// LLM 기반 로그 분석기 -- FR-ADV30.2, FR-ADV30.4, FR-ADV30.7
// Design Ref: SVC-AI-ADV-R30 DESIGN §2, §4, §7
// Plan SC: SC-1 (정확도 90%+), SC-2 (오탐률 5% 이하)
// CSAP: D-06 로그 분석 감사, D-12 보안 이벤트 분석
// N2SF: N-05 로그 내 PII 마스킹 필수

import type { AnomalySeverity, AnomalyType } from './anomaly-detector';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 로그 엔트리 */
export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

/** LLM 분석 결과 */
export interface LogAnalysisResult {
  id: string;
  isAnomaly: boolean;
  severity: AnomalySeverity;
  type: AnomalyType;
  confidence: number;
  reasoning: string;
  affectedLogs: number[];
  suggestedAction?: string;
  timestamp: string;
}

/** 패턴 정의 */
export interface LogPattern {
  id: string;
  name: string;
  pattern: RegExp;
  severity: AnomalySeverity;
  type: AnomalyType;
  description: string;
}

/** 분석기 설정 */
export interface LogAnalyzerConfig {
  /** LLM 배치 크기 (최대 로그 줄 수) */
  batchSize: number;
  /** 규칙 기반 패턴 (LLM 호출 전 1차 필터) */
  patterns: LogPattern[];
  /** PII 마스킹 활성화 (N2SF 필수) */
  enablePiiMasking: boolean;
  /** LLM 프로바이더 함수 (의존성 주입) */
  llmProvider?: (prompt: string) => Promise<string>;
}

// -- 기본 보안 패턴 (규칙 기반 1차 필터) ────────────────────────────────────────

const DEFAULT_PATTERNS: LogPattern[] = [
  {
    id: 'LP-001',
    name: 'SQL 주입 시도',
    pattern: /(?:union\s+select|or\s+1\s*=\s*1|drop\s+table|;\s*delete\s+from)/i,
    severity: 'critical',
    type: 'security_breach',
    description: 'SQL 주입 공격 패턴 감지',
  },
  {
    id: 'LP-002',
    name: '무차별 대입 공격',
    pattern: /(?:failed\s+login|authentication\s+failed|invalid\s+password).{0,50}(?:attempt|retry)/i,
    severity: 'high',
    type: 'access_pattern',
    description: '반복 인증 실패 패턴 감지',
  },
  {
    id: 'LP-003',
    name: '경로 순회 시도',
    pattern: /(?:\.\.\/|\.\.\\|%2e%2e)/i,
    severity: 'critical',
    type: 'security_breach',
    description: '디렉토리 트래버설 공격 패턴',
  },
  {
    id: 'LP-004',
    name: 'XSS 시도',
    pattern: /<script[^>]*>|javascript:|on(?:error|load|click)\s*=/i,
    severity: 'high',
    type: 'security_breach',
    description: 'Cross-Site Scripting 공격 패턴',
  },
  {
    id: 'LP-005',
    name: '대량 에러 발생',
    pattern: /(?:out\s+of\s+memory|stack\s+overflow|segmentation\s+fault|oom\s+kill)/i,
    severity: 'high',
    type: 'resource_exhaustion',
    description: '시스템 리소스 고갈 패턴',
  },
  {
    id: 'LP-006',
    name: '비인가 접근',
    pattern: /(?:unauthorized|forbidden|access\s+denied|permission\s+denied)/i,
    severity: 'medium',
    type: 'access_pattern',
    description: '비인가 접근 시도',
  },
  {
    id: 'LP-007',
    name: '데이터 유출 징후',
    pattern: /(?:bulk\s+export|mass\s+download|large\s+query\s+result|data\s+dump)/i,
    severity: 'critical',
    type: 'data_exfiltration',
    description: '대량 데이터 추출 패턴',
  },
];

// -- PII 마스킹 유틸 (N2SF 준수) ──────────────────────────────────────────────

const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\b\d{6}[-]?\d{7}\b/g, replacement: '[주민번호_마스킹]' },
  { pattern: /\b\d{3}[-.]?\d{3,4}[-.]?\d{4}\b/g, replacement: '[전화번호_마스킹]' },
  { pattern: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, replacement: '[이메일_마스킹]' },
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '[카드번호_마스킹]' },
  { pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, replacement: '[IP_마스킹]' },
];

function maskPii(text: string): string {
  let masked = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'log-analyzer',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

function generateId(): string {
  return `loganalysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// -- LogAnalyzer 메인 클래스 ──────────────────────────────────────────────────

/** LLM 기반 로그 분석기 -- Design §2 */
export class LogAnalyzer {
  private readonly config: LogAnalyzerConfig;
  private analysisHistory: LogAnalysisResult[] = [];

  constructor(config?: Partial<LogAnalyzerConfig>) {
    this.config = {
      batchSize: config?.batchSize ?? 50,
      patterns: config?.patterns ?? DEFAULT_PATTERNS,
      enablePiiMasking: config?.enablePiiMasking ?? true,
      llmProvider: config?.llmProvider,
    };
  }

  // -- 규칙 기반 분석 (1차 필터) ──────────────────────────────────────────

  /** 규칙 기반 패턴 매칭 분석 */
  analyzeByPatterns(logs: LogEntry[]): LogAnalysisResult[] {
    const results: LogAnalysisResult[] = [];

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      for (const pattern of this.config.patterns) {
        if (log && pattern.pattern.test(log.message)) {
          results.push({
            id: generateId(),
            isAnomaly: true,
            severity: pattern.severity,
            type: pattern.type,
            confidence: 0.95,
            reasoning: `규칙 ${pattern.id}: ${pattern.description}`,
            affectedLogs: [i],
            suggestedAction: `보안 이벤트 조사 필요: ${pattern.name}`,
            timestamp: new Date().toISOString(),
          });

          auditLog('pattern_match', {
            patternId: pattern.id,
            severity: pattern.severity,
            logIndex: i,
          });
        }
      }
    }

    return results;
  }

  // -- LLM 기반 분석 (2차 심층) ──────────────────────────────────────────

  /** LLM 로그 분석 -- Design §2 */
  async analyzeByLLM(logs: LogEntry[]): Promise<LogAnalysisResult | null> {
    if (!this.config.llmProvider) return null;
    if (logs.length === 0) return null;

    // PII 마스킹 (N2SF 필수)
    const sanitizedLogs = this.config.enablePiiMasking
      ? logs.map((l) => ({
          ...l,
          message: maskPii(l.message),
          metadata: undefined, // 메타데이터 제거 (안전)
        }))
      : logs;

    // 배치 크기 제한
    const batch = sanitizedLogs.slice(0, this.config.batchSize);

    const prompt = this.buildAnalysisPrompt(batch);

    try {
      const response = await this.config.llmProvider(prompt);
      const result = this.parseAnalysisResponse(response, logs.length);

      auditLog('llm_analysis_complete', {
        logCount: batch.length,
        isAnomaly: result.isAnomaly,
        severity: result.severity,
      });

      return result;
    } catch (error) {
      auditLog('llm_analysis_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /** LLM 프롬프트 생성 */
  private buildAnalysisPrompt(logs: LogEntry[]): string {
    const logText = logs
      .map(
        (l, i) =>
          `[${i}] ${l.timestamp} [${l.level.toUpperCase()}] ${l.source ?? '-'}: ${l.message}`,
      )
      .join('\n');

    return [
      '다음 시스템 로그를 분석하여 보안 이상을 판별하십시오.',
      '',
      '## 분석 기준',
      '1. 보안 침해 징후 (SQL 주입, XSS, 무차별 대입 등)',
      '2. 비정상 접근 패턴 (시간대, 빈도, 소스)',
      '3. 시스템 리소스 이상 (메모리, CPU, 디스크)',
      '4. 데이터 유출 가능성',
      '',
      '## 로그 데이터',
      logText,
      '',
      '## 응답 형식 (JSON)',
      '{',
      '  "isAnomaly": boolean,',
      '  "severity": "critical"|"high"|"medium"|"low",',
      '  "type": "이상 유형",',
      '  "confidence": 0.0~1.0,',
      '  "reasoning": "판단 근거",',
      '  "affectedLines": [해당 로그 인덱스],',
      '  "suggestedAction": "권장 조치"',
      '}',
    ].join('\n');
  }

  /** LLM 응답 파싱 */
  private parseAnalysisResponse(response: string, totalLogs: number): LogAnalysisResult {
    try {
      // JSON 블록 추출
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createDefaultResult(totalLogs);
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        isAnomaly?: boolean;
        severity?: string;
        type?: string;
        confidence?: number;
        reasoning?: string;
        affectedLines?: number[];
        suggestedAction?: string;
      };

      return {
        id: generateId(),
        isAnomaly: parsed.isAnomaly ?? false,
        severity: (parsed.severity as AnomalySeverity) ?? 'low',
        type: (parsed.type as AnomalyType) ?? 'unknown',
        confidence: parsed.confidence ?? 0.5,
        reasoning: parsed.reasoning ?? 'LLM 분석 결과',
        affectedLogs: parsed.affectedLines ?? [],
        suggestedAction: parsed.suggestedAction,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return this.createDefaultResult(totalLogs);
    }
  }

  /** 기본 결과 생성 (파싱 실패 시) */
  private createDefaultResult(_totalLogs: number): LogAnalysisResult {
    return {
      id: generateId(),
      isAnomaly: false,
      severity: 'low',
      type: 'unknown',
      confidence: 0.1,
      reasoning: 'LLM 응답 파싱 실패 - 수동 분석 필요',
      affectedLogs: [],
      timestamp: new Date().toISOString(),
    };
  }

  // -- 통합 분석 ─────────────────────────────────────────────────────────

  /** 규칙 + LLM 통합 분석 -- Design §2, §4 */
  async analyze(logs: LogEntry[]): Promise<LogAnalysisResult[]> {
    // 1차: 규칙 기반 패턴 매칭 (빠른 필터)
    const patternResults = this.analyzeByPatterns(logs);

    // 2차: LLM 심층 분석
    const llmResult = await this.analyzeByLLM(logs);

    const allResults = [...patternResults];
    if (llmResult && llmResult.isAnomaly) {
      allResults.push(llmResult);
    }

    // 분석 이력 저장
    this.analysisHistory.push(...allResults);

    auditLog('analysis_complete', {
      totalLogs: logs.length,
      patternMatches: patternResults.length,
      llmAnomaly: llmResult?.isAnomaly ?? false,
      totalAnomalies: allResults.length,
    });

    return allResults;
  }

  // -- 이력 관리 ─────────────────────────────────────────────────────────

  /** 분석 이력 조회 */
  getHistory(limit?: number): LogAnalysisResult[] {
    const history = [...this.analysisHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /** 이력 초기화 */
  clearHistory(): void {
    this.analysisHistory = [];
  }

  /** 통계 요약 */
  getSummary(): {
    totalAnalyses: number;
    anomalyCount: number;
    bySeverity: Record<AnomalySeverity, number>;
    byType: Record<string, number>;
  } {
    const bySeverity: Record<AnomalySeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const byType: Record<string, number> = {};

    for (const result of this.analysisHistory) {
      if (result.isAnomaly) {
        bySeverity[result.severity] = (bySeverity[result.severity] ?? 0) + 1;
        byType[result.type] = (byType[result.type] ?? 0) + 1;
      }
    }

    return {
      totalAnalyses: this.analysisHistory.length,
      anomalyCount: this.analysisHistory.filter((r) => r.isAnomaly).length,
      bySeverity,
      byType,
    };
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let analyzerInstance: LogAnalyzer | null = null;

export function getLogAnalyzer(
  config?: Partial<LogAnalyzerConfig>,
): LogAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new LogAnalyzer(config);
  }
  return analyzerInstance;
}

export function resetLogAnalyzer(): void {
  analyzerInstance = null;
}
