// 구조화 로거 (JSON 형식)
// Design Ref: SVC-OBSERVE-R15 Plan
// Plan SC: FR-OBS.2
// CSAP: D-06 침해사고 관리

/**
 * 로그 레벨 정의
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** 로그 레벨 숫자 매핑 (pino 호환) */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * 로그 엔트리 인터페이스
 */
export interface LogEntry {
  /** ISO 타임스탬프 */
  timestamp: string;
  /** 로그 레벨 */
  level: LogLevel;
  /** 로그 레벨 숫자 (pino 호환) */
  levelValue: number;
  /** 서비스 이름 */
  service: string;
  /** 로그 메시지 */
  message: string;
  /** 테넌트 ID (있으면) */
  tenantId?: string;
  /** 요청 ID (있으면) */
  requestId?: string;
  /** 추가 컨텍스트 */
  context?: Record<string, unknown>;
  /** 에러 정보 (있으면) */
  error?: { name: string; message: string; stack?: string };
}

/**
 * PII 마스킹 대상 필드
 */
const PII_FIELDS = [
  'password', 'secret', 'token', 'apiKey', 'api_key',
  'ssn', 'email', 'phone', 'creditCard', 'credit_card',
  'accountNumber', 'account_number',
];

/**
 * 구조화 로거 옵션
 */
export interface StructuredLoggerOptions {
  /** 서비스 이름 (필수) */
  service: string;
  /** 최소 로그 레벨 (기본: 'info') */
  level?: LogLevel;
  /** PII 자동 마스킹 활성화 (기본: true) */
  maskPii?: boolean;
  /** 출력 함수 (기본: process.stdout.write) */
  output?: (entry: LogEntry) => void;
}

/**
 * 구조화 로거
 *
 * JSON 형식의 구조화된 로그를 출력합니다.
 * pino 호환 인터페이스를 제공하며, 테넌트 ID/요청 ID 자동 포함,
 * PII 자동 마스킹 기능을 지원합니다.
 */
export class StructuredLogger {
  private readonly service: string;
  private readonly minLevel: number;
  private readonly maskPii: boolean;
  private readonly output: (entry: LogEntry) => void;
  private tenantId?: string;
  private requestId?: string;

  constructor(options: StructuredLoggerOptions) {
    this.service = options.service;
    this.minLevel = LOG_LEVEL_VALUES[options.level ?? 'info'];
    this.maskPii = options.maskPii !== false;
    this.output = options.output ?? ((entry) => {
      process.stdout.write(JSON.stringify(entry) + '\n');
    });
  }

  /**
   * 테넌트/요청 컨텍스트 설정
   */
  setContext(tenantId?: string, requestId?: string): void {
    this.tenantId = tenantId;
    this.requestId = requestId;
  }

  /**
   * 자식 로거 생성 (추가 컨텍스트 포함)
   */
  child(context: { tenantId?: string; requestId?: string }): StructuredLogger {
    const child = new StructuredLogger({
      service: this.service,
      level: this.getLevelName(this.minLevel),
      maskPii: this.maskPii,
      output: this.output,
    });
    child.setContext(
      context.tenantId ?? this.tenantId,
      context.requestId ?? this.requestId,
    );
    return child;
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.log('trace', message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>, err?: Error): void {
    this.log('error', message, context, err);
  }

  fatal(message: string, context?: Record<string, unknown>, err?: Error): void {
    this.log('fatal', message, context, err);
  }

  /**
   * 모든 로그 엔트리의 수집 (테스트용)
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>, err?: Error): void {
    const levelValue = LOG_LEVEL_VALUES[level];
    if (levelValue < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      levelValue,
      service: this.service,
      message,
    };

    if (this.tenantId) entry.tenantId = this.tenantId;
    if (this.requestId) entry.requestId = this.requestId;

    if (context) {
      entry.context = this.maskPii ? this.maskPiiFields(context) : context;
    }

    if (err) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    }

    this.output(entry);
  }

  /**
   * PII 필드 마스킹
   */
  private maskPiiFields(obj: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (PII_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
        masked[key] = '***MASKED***';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        masked[key] = this.maskPiiFields(value as Record<string, unknown>);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  /**
   * 숫자 레벨에서 이름 반환
   */
  private getLevelName(value: number): LogLevel {
    for (const [name, v] of Object.entries(LOG_LEVEL_VALUES)) {
      if (v === value) return name as LogLevel;
    }
    return 'info';
  }
}
