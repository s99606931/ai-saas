// Structured Logger -- JSON 구조화 로그
// Design Ref: SVC-LOGGER-R29 DESIGN
// Plan SC: FR-LOG.1, FR-LOG.2, FR-LOG.3, FR-LOG.4, FR-LOG.5, FR-LOG.6
// CSAP: D-06 침해사고 관리 (감사 로깅)

/**
 * 로그 레벨
 * Plan SC: FR-LOG.2
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/**
 * 로그 엔트리 구조
 * Plan SC: FR-LOG.1
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

/**
 * 로거 옵션
 */
export interface LoggerOptions {
  /** 최소 로그 레벨 (기본: info) */
  level?: LogLevel;
  /** 서비스명 */
  service?: string;
  /** 기본 컨텍스트 (모든 로그에 포함) */
  context?: Record<string, unknown>;
  /** PII 마스킹 활성화 (기본: true) */
  maskPii?: boolean;
  /** 커스텀 출력 함수 (테스트용) */
  output?: (line: string) => void;
}

/**
 * PII 마스킹 패턴
 * Plan SC: FR-LOG.5
 * CSAP D-06: 감사 로그 내 개인정보 보호
 */
const PII_PATTERNS: Array<{ pattern: RegExp; replacer: (match: string) => string }> = [
  {
    // 이메일: user@example.com → u***@e***.com
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacer: (match: string) => {
      const [local, domain] = match.split('@');
      const domainParts = domain.split('.');
      const maskedLocal = local[0] + '***';
      const maskedDomain = domainParts[0][0] + '***.' + domainParts.slice(1).join('.');
      return `${maskedLocal}@${maskedDomain}`;
    },
  },
  {
    // 전화번호: 010-1234-5678 → 010-****-5678
    pattern: /\d{2,3}-\d{3,4}-\d{4}/g,
    replacer: (match: string) => {
      const parts = match.split('-');
      return `${parts[0]}-${'*'.repeat(parts[1].length)}-${parts[parts.length - 1]}`;
    },
  },
  {
    // IP 주소: 192.168.1.100 → 192.168.*.*
    pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
    replacer: (match: string) => {
      const octets = match.split('.');
      return `${octets[0]}.${octets[1]}.*.*`;
    },
  },
];

/**
 * 문자열 내 PII를 마스킹합니다.
 * Plan SC: FR-LOG.5
 */
export function maskPiiInString(input: string): string {
  let result = input;
  for (const { pattern, replacer } of PII_PATTERNS) {
    result = result.replace(pattern, replacer);
  }
  return result;
}

/**
 * 객체 내 모든 문자열 값을 재귀적으로 PII 마스킹합니다.
 * Plan SC: FR-LOG.5
 */
function maskPiiDeep(data: unknown): unknown {
  if (typeof data === 'string') {
    return maskPiiInString(data);
  }
  if (Array.isArray(data)) {
    return data.map((item) => maskPiiDeep(item));
  }
  if (data !== null && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = maskPiiDeep(value);
    }
    return result;
  }
  return data;
}

/**
 * Structured Logger
 *
 * JSON 형식의 구조화된 로그를 출력합니다.
 * 서비스명, 테넌트ID, 요청ID 등의 컨텍스트를 바인딩하고
 * 자식 로거를 통해 컨텍스트를 상속할 수 있습니다.
 *
 * CSAP D-06: 감사 로깅 + PII 마스킹
 *
 * Plan SC: FR-LOG.1 (구조화), FR-LOG.2 (레벨), FR-LOG.3 (컨텍스트),
 *          FR-LOG.4 (자식 로거), FR-LOG.5 (PII 마스킹), FR-LOG.6 (타이머)
 */
export class StructuredLogger {
  private readonly minLevel: number;
  private readonly context: Record<string, unknown>;
  private readonly shouldMaskPii: boolean;
  private readonly outputFn: (line: string) => void;

  constructor(options: LoggerOptions = {}) {
    this.minLevel = LOG_LEVEL_PRIORITY[options.level ?? 'info'];
    this.shouldMaskPii = options.maskPii !== false;
    this.outputFn = options.output ?? ((line: string) => process.stdout.write(line + '\n'));

    this.context = { ...options.context };
    if (options.service) {
      this.context.service = options.service;
    }
  }

  /**
   * debug 레벨 로그
   * Plan SC: FR-LOG.2
   */
  debug(message: string, extra?: Record<string, unknown>): void {
    this.log('debug', message, extra);
  }

  /**
   * info 레벨 로그
   * Plan SC: FR-LOG.2
   */
  info(message: string, extra?: Record<string, unknown>): void {
    this.log('info', message, extra);
  }

  /**
   * warn 레벨 로그
   * Plan SC: FR-LOG.2
   */
  warn(message: string, extra?: Record<string, unknown>): void {
    this.log('warn', message, extra);
  }

  /**
   * error 레벨 로그
   * Plan SC: FR-LOG.2
   */
  error(message: string, extra?: Record<string, unknown>): void {
    this.log('error', message, extra);
  }

  /**
   * fatal 레벨 로그
   * Plan SC: FR-LOG.2
   */
  fatal(message: string, extra?: Record<string, unknown>): void {
    this.log('fatal', message, extra);
  }

  /**
   * 자식 로거 생성 (컨텍스트 상속)
   * Plan SC: FR-LOG.4
   */
  child(childContext: Record<string, unknown>): StructuredLogger {
    const mergedContext = { ...this.context, ...childContext };
    const logger = new StructuredLogger({
      level: this.getLevelName(),
      context: mergedContext,
      maskPii: this.shouldMaskPii,
      output: this.outputFn,
    });
    return logger;
  }

  /**
   * 성능 타이머 시작
   * Plan SC: FR-LOG.6
   *
   * 반환된 함수를 호출하면 경과 밀리초를 반환합니다.
   */
  startTimer(): () => number {
    const start = performance.now();
    return () => {
      const elapsed = performance.now() - start;
      return Math.round(elapsed * 100) / 100;
    };
  }

  // -- 내부 메서드 --

  private log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < this.minLevel) {
      return;
    }

    let entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...extra,
    };

    if (this.shouldMaskPii) {
      entry = maskPiiDeep(entry) as LogEntry;
    }

    this.outputFn(JSON.stringify(entry));
  }

  private getLevelName(): LogLevel {
    for (const [name, priority] of Object.entries(LOG_LEVEL_PRIORITY)) {
      if (priority === this.minLevel) {
        return name as LogLevel;
      }
    }
    return 'info';
  }
}
