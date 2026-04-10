// 계층형 설정 로더
// Design Ref: SVC-CONFIG-R16 Plan
// Plan SC: FR-CFG.2
// CSAP: D-09 암호화 -- 시크릿 하드코딩 방지

/**
 * 설정 소스 우선순위 (높은 번호 = 높은 우선순위)
 */
export type ConfigSource = 'defaults' | 'environment-file' | 'env-vars' | 'runtime';

/**
 * 설정 변경 이벤트
 */
export interface ConfigChangeEvent {
  key: string;
  previousValue: unknown;
  newValue: unknown;
  source: ConfigSource;
  timestamp: string;
}

/**
 * 설정 변경 리스너
 */
export type ConfigChangeListener = (event: ConfigChangeEvent) => void;

/**
 * 계층형 설정 로더
 *
 * 우선순위: runtime > env-vars > environment-file > defaults
 * 높은 우선순위 설정이 낮은 우선순위를 덮어씁니다.
 */
export class ConfigLoader {
  private readonly layers: Map<ConfigSource, Record<string, unknown>> = new Map();
  private merged: Record<string, unknown> = {};
  private readonly listeners: ConfigChangeListener[] = [];
  private readonly changeLog: ConfigChangeEvent[] = [];

  constructor() {
    // 기본 레이어 초기화
    this.layers.set('defaults', {});
    this.layers.set('environment-file', {});
    this.layers.set('env-vars', {});
    this.layers.set('runtime', {});
  }

  /**
   * 기본 설정 로드
   */
  loadDefaults(config: Record<string, unknown>): void {
    this.layers.set('defaults', { ...config });
    this.rebuildMerged();
  }

  /**
   * 환경별 설정 로드
   */
  loadEnvironmentConfig(config: Record<string, unknown>): void {
    this.layers.set('environment-file', { ...config });
    this.rebuildMerged();
  }

  /**
   * 환경변수에서 설정 로드
   *
   * prefix가 지정되면 해당 접두사의 환경변수만 로드합니다.
   * 예: prefix='APP_' → APP_DB_HOST → db.host
   */
  loadFromEnv(prefix = '', mapping?: Record<string, string>): void {
    const envConfig: Record<string, unknown> = {};

    if (mapping) {
      // 명시적 매핑
      for (const [envKey, configKey] of Object.entries(mapping)) {
        const value = process.env[envKey];
        if (value !== undefined) {
          this.setNestedValue(envConfig, configKey, this.parseValue(value));
        }
      }
    } else if (prefix) {
      // 접두사 기반 자동 매핑
      for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith(prefix) && value !== undefined) {
          const configKey = key
            .slice(prefix.length)
            .toLowerCase()
            .replace(/_/g, '.');
          this.setNestedValue(envConfig, configKey, this.parseValue(value));
        }
      }
    }

    this.layers.set('env-vars', envConfig);
    this.rebuildMerged();
  }

  /**
   * 타입 안전한 설정 값 조회
   */
  get<T>(key: string, defaultValue?: T): T {
    const value = this.getNestedValue(this.merged, key);
    if (value === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      throw new ConfigError(`설정 키 '${key}'를 찾을 수 없습니다`);
    }
    return value as T;
  }

  /**
   * 설정 값 존재 여부 확인
   */
  has(key: string): boolean {
    return this.getNestedValue(this.merged, key) !== undefined;
  }

  /**
   * 런타임 설정 업데이트 (재시작 없이)
   */
  set(key: string, value: unknown): void {
    const previousValue = this.getNestedValue(this.merged, key);
    const runtime = this.layers.get('runtime') ?? {};
    this.setNestedValue(runtime, key, value);
    this.layers.set('runtime', runtime);
    this.rebuildMerged();

    const event: ConfigChangeEvent = {
      key,
      previousValue,
      newValue: value,
      source: 'runtime',
      timestamp: new Date().toISOString(),
    };

    this.changeLog.push(event);
    this.notifyListeners(event);
  }

  /**
   * 전체 병합된 설정 반환 (읽기 전용)
   */
  getAll(): Readonly<Record<string, unknown>> {
    return { ...this.merged };
  }

  /**
   * 설정 변경 리스너 등록
   */
  onChange(listener: ConfigChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * 변경 이력 반환
   */
  getChangeLog(): readonly ConfigChangeEvent[] {
    return this.changeLog;
  }

  /**
   * 환경변수 문자열을 적절한 타입으로 파싱
   */
  private parseValue(value: string): unknown {
    // boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // number
    const num = Number(value);
    if (!isNaN(num) && value.trim().length > 0) return num;

    // string
    return value;
  }

  /**
   * 레이어 병합 (우선순위 순서)
   */
  private rebuildMerged(): void {
    const priority: ConfigSource[] = ['defaults', 'environment-file', 'env-vars', 'runtime'];
    let result: Record<string, unknown> = {};

    for (const source of priority) {
      const layer = this.layers.get(source) ?? {};
      result = this.deepMerge(result, layer);
    }

    this.merged = result;
  }

  /**
   * 깊은 병합
   */
  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof result[key] === 'object' &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = this.deepMerge(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * dot notation으로 중첩 값 조회
   */
  private getNestedValue(obj: Record<string, unknown>, key: string): unknown {
    const parts = key.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * dot notation으로 중첩 값 설정
   */
  private setNestedValue(obj: Record<string, unknown>, key: string, value: unknown): void {
    const parts = key.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]!] = value;
  }

  /**
   * 리스너 알림
   */
  private notifyListeners(event: ConfigChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // 리스너 에러 무시 (로그 추가 가능)
      }
    }
  }
}

/**
 * 설정 에러
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
