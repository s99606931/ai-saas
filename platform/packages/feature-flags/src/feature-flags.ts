// Feature Flags -- 점진적 롤아웃 + 세그먼트 기반 토글
// Design Ref: SVC-FEATUREFLAG-R40 DESIGN
// Plan SC: FR-FF.1~FR-FF.6

export type SegmentOperator = 'equals' | 'in' | 'startsWith';

export interface Segment {
  attribute: string;
  operator: SegmentOperator;
  value: string | string[];
}

export interface FlagDefinition {
  name: string;
  enabled: boolean;
  rollout?: number;
  allowList?: string[];
  denyList?: string[];
  segments?: Segment[];
}

export interface EvaluationContext {
  /** 평가 대상자의 고유 ID (퍼센트 롤아웃 해시 입력) */
  subjectId: string;
  /** 세그먼트 매칭용 속성 */
  attributes?: Record<string, string>;
}

export interface EvaluationResult {
  flag: string;
  enabled: boolean;
  reason: string;
}

/**
 * FNV-1a 32비트 해시 (퍼센트 롤아웃용)
 * Plan SC: FR-FF.2
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 세그먼트 매칭
 * Plan SC: FR-FF.3
 */
function matchesSegment(segment: Segment, attributes: Record<string, string>): boolean {
  const attr = attributes[segment.attribute];
  if (attr === undefined) return false;

  switch (segment.operator) {
    case 'equals':
      return typeof segment.value === 'string' && attr === segment.value;
    case 'in':
      return Array.isArray(segment.value) && segment.value.includes(attr);
    case 'startsWith':
      return typeof segment.value === 'string' && attr.startsWith(segment.value);
    default:
      return false;
  }
}

/**
 * Feature Flag Manager
 */
export class FeatureFlagManager {
  private flags = new Map<string, FlagDefinition>();
  private evaluationLog: EvaluationResult[] = [];
  private readonly logLimit: number;

  constructor(initialFlags: FlagDefinition[] = [], logLimit = 1000) {
    for (const flag of initialFlags) {
      this.flags.set(flag.name, flag);
    }
    this.logLimit = logLimit;
  }

  /**
   * 플래그 평가
   * Plan SC: FR-FF.1, FR-FF.2, FR-FF.3
   */
  isEnabled(flagName: string, context: EvaluationContext): boolean {
    const result = this.evaluate(flagName, context);
    return result.enabled;
  }

  /**
   * 플래그 평가 + 이유 반환
   * Plan SC: FR-FF.5
   */
  evaluate(flagName: string, context: EvaluationContext): EvaluationResult {
    const flag = this.flags.get(flagName);
    let result: EvaluationResult;

    if (!flag) {
      result = { flag: flagName, enabled: false, reason: 'flag-not-found' };
    } else if (!flag.enabled) {
      result = { flag: flagName, enabled: false, reason: 'master-disabled' };
    } else if (flag.denyList?.includes(context.subjectId)) {
      result = { flag: flagName, enabled: false, reason: 'deny-list' };
    } else if (flag.allowList?.includes(context.subjectId)) {
      result = { flag: flagName, enabled: true, reason: 'allow-list' };
    } else if (flag.segments && flag.segments.length > 0) {
      const attrs = context.attributes ?? {};
      const matched = flag.segments.some((s) => matchesSegment(s, attrs));
      result = matched
        ? { flag: flagName, enabled: true, reason: 'segment-match' }
        : { flag: flagName, enabled: false, reason: 'segment-miss' };
    } else if (typeof flag.rollout === 'number') {
      if (flag.rollout <= 0) {
        result = { flag: flagName, enabled: false, reason: 'rollout-zero' };
      } else if (flag.rollout >= 100) {
        result = { flag: flagName, enabled: true, reason: 'rollout-full' };
      } else {
        const hash = fnv1a(`${flagName}:${context.subjectId}`);
        const bucket = hash % 100;
        result = bucket < flag.rollout
          ? { flag: flagName, enabled: true, reason: `rollout-bucket-${bucket}` }
          : { flag: flagName, enabled: false, reason: `rollout-bucket-${bucket}` };
      }
    } else {
      result = { flag: flagName, enabled: true, reason: 'default-on' };
    }

    this.recordLog(result);
    return result;
  }

  /**
   * 플래그 동적 업데이트
   * Plan SC: FR-FF.4
   */
  setFlag(flag: FlagDefinition): void {
    this.validateFlag(flag);
    this.flags.set(flag.name, flag);
  }

  removeFlag(name: string): boolean {
    return this.flags.delete(name);
  }

  getFlag(name: string): FlagDefinition | undefined {
    return this.flags.get(name);
  }

  listFlags(): FlagDefinition[] {
    return Array.from(this.flags.values());
  }

  /**
   * JSON 구성 파일에서 로드
   * Plan SC: FR-FF.6
   */
  loadFromJson(json: string): number {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      throw new Error('피처 플래그 JSON은 배열이어야 합니다.');
    }
    let count = 0;
    for (const item of parsed) {
      const flag = item as FlagDefinition;
      this.validateFlag(flag);
      this.flags.set(flag.name, flag);
      count++;
    }
    return count;
  }

  /**
   * 평가 감사 로그
   * Plan SC: FR-FF.5
   */
  getEvaluationLog(): EvaluationResult[] {
    return [...this.evaluationLog];
  }

  clearLog(): void {
    this.evaluationLog = [];
  }

  private recordLog(result: EvaluationResult): void {
    if (this.evaluationLog.length >= this.logLimit) {
      this.evaluationLog.shift();
    }
    this.evaluationLog.push(result);
  }

  private validateFlag(flag: FlagDefinition): void {
    if (!flag.name || typeof flag.name !== 'string') {
      throw new Error('flag.name은 필수 문자열입니다.');
    }
    if (typeof flag.enabled !== 'boolean') {
      throw new Error(`flag.enabled는 boolean이어야 합니다: ${flag.name}`);
    }
    if (
      flag.rollout !== undefined &&
      (flag.rollout < 0 || flag.rollout > 100)
    ) {
      throw new Error(`rollout은 0~100이어야 합니다: ${flag.name}`);
    }
  }
}
