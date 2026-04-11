// 프롬프트 버전 관리 — FR-ADV9.4, FR-ADV9.5
// Design Ref: SVC-AI-ADV-R9 DESIGN §2
// Plan SC: SC-2 (프롬프트 버전 관리)
// CSAP: D-12 시스템 개발 보안, D-06 감사 로깅

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 프롬프트 버전 상태 */
export type PromptStatus = 'draft' | 'active' | 'archived';

/** 프롬프트 버전 — Design §2.1 */
export interface PromptVersion {
  /** UUID */
  id: string;
  /** 프롬프트 이름 (식별자) */
  name: string;
  /** 버전 번호 (자동 증가) */
  version: number;
  /** 프롬프트 텍스트 ({{variable}} 형식의 변수 포함) */
  template: string;
  /** 필요한 변수 목록 */
  variables: string[];
  /** 추가 메타데이터 */
  metadata: Record<string, unknown>;
  /** 상태 */
  status: PromptStatus;
  /** 생성 시각 */
  createdAt: string;
  /** 활성화 시각 */
  activatedAt?: string;
}

/** A/B 테스트 변형 */
export interface ABTestVariant {
  /** 프롬프트 버전 ID */
  promptVersionId: string;
  /** 트래픽 가중치 (0.0 ~ 1.0) */
  weight: number;
  /** 메트릭 (수집된 결과) */
  metrics: {
    impressions: number;
    avgLatencyMs: number;
    avgTokens: number;
    userSatisfaction: number; // 0.0 ~ 1.0
  };
}

/** A/B 테스트 — Design §2.2 */
export interface ABTest {
  /** UUID */
  id: string;
  /** 테스트 이름 */
  name: string;
  /** 프롬프트 이름 (테스트 대상) */
  promptName: string;
  /** 변형 목록 */
  variants: ABTestVariant[];
  /** 테스트 상태 */
  status: 'running' | 'completed' | 'cancelled';
  /** 생성 시각 */
  createdAt: string;
  /** 완료 시각 */
  completedAt?: string;
  /** 승자 변형 ID */
  winnerId?: string;
}

/** 프롬프트 렌더링 결과 */
export interface RenderedPrompt {
  text: string;
  versionId: string;
  version: number;
  abTestId?: string;
}

// ── 프롬프트 버전 관리자 ─────────────────────────────────────────────────────

/**
 * 프롬프트 버전 관리자
 *
 * Git-like 불변 버전 관리로 프롬프트를 관리합니다.
 * A/B 테스트를 통해 프롬프트 변형의 성능을 비교합니다.
 *
 * 특징:
 * - 불변 버전: 한번 생성된 버전은 수정 불가 (새 버전만 생성)
 * - 활성 버전: 프롬프트 이름당 하나의 활성 버전
 * - A/B 테스트: 가중치 기반 트래픽 분배
 * - 변수 치환: {{variable}} 패턴 지원
 */
export class PromptVersionManager {
  private readonly versions: Map<string, PromptVersion> = new Map();
  private readonly abTests: Map<string, ABTest> = new Map();

  /**
   * 새 프롬프트 버전을 등록합니다 — FR-ADV9.4
   *
   * @param name - 프롬프트 이름
   * @param template - 프롬프트 텍스트 ({{var}} 형식)
   * @param metadata - 추가 메타데이터
   * @returns 생성된 버전
   */
  createVersion(name: string, template: string, metadata?: Record<string, unknown>): PromptVersion {
    // 기존 버전 중 최대 버전 번호 찾기
    let maxVersion = 0;
    for (const v of this.versions.values()) {
      if (v.name === name && v.version > maxVersion) {
        maxVersion = v.version;
      }
    }

    // 변수 추출 ({{variable}} 패턴)
    const variables = extractVariables(template);

    const version: PromptVersion = {
      id: crypto.randomUUID(),
      name,
      version: maxVersion + 1,
      template,
      variables,
      metadata: metadata ?? {},
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    this.versions.set(version.id, version);
    return version;
  }

  /**
   * 프롬프트 버전을 활성화합니다
   * 같은 이름의 기존 활성 버전은 자동으로 archived로 변경됩니다
   */
  activateVersion(versionId: string): PromptVersion {
    const version = this.versions.get(versionId);
    if (!version) throw new Error(`프롬프트 버전을 찾을 수 없습니다: ${versionId}`);

    // 같은 이름의 기존 활성 버전 비활성화
    for (const v of this.versions.values()) {
      if (v.name === version.name && v.status === 'active') {
        v.status = 'archived';
      }
    }

    version.status = 'active';
    version.activatedAt = new Date().toISOString();
    return version;
  }

  /**
   * 프롬프트 버전을 아카이브합니다
   */
  archiveVersion(versionId: string): void {
    const version = this.versions.get(versionId);
    if (!version) throw new Error(`프롬프트 버전을 찾을 수 없습니다: ${versionId}`);
    version.status = 'archived';
  }

  /**
   * 프롬프트 이름으로 활성 버전을 조회합니다
   */
  getActiveVersion(name: string): PromptVersion | null {
    for (const v of this.versions.values()) {
      if (v.name === name && v.status === 'active') return v;
    }
    return null;
  }

  /**
   * 프롬프트 이름으로 모든 버전을 조회합니다
   */
  getVersionHistory(name: string): PromptVersion[] {
    const versions: PromptVersion[] = [];
    for (const v of this.versions.values()) {
      if (v.name === name) versions.push(v);
    }
    return versions.sort((a, b) => b.version - a.version);
  }

  /**
   * 프롬프트를 렌더링합니다 (변수 치환)
   *
   * A/B 테스트가 실행 중이면 가중치에 따라 변형을 선택합니다.
   *
   * @param name - 프롬프트 이름
   * @param variables - 치환할 변수들
   * @returns 렌더링된 프롬프트
   */
  render(name: string, variables: Record<string, string> = {}): RenderedPrompt {
    // A/B 테스트 확인 — FR-ADV9.5
    const runningTest = this.getRunningABTest(name);
    if (runningTest) {
      const selectedVariant = selectVariantByWeight(runningTest.variants);
      if (selectedVariant) {
        const version = this.versions.get(selectedVariant.promptVersionId);
        if (version) {
          selectedVariant.metrics.impressions++;
          return {
            text: renderTemplate(version.template, variables),
            versionId: version.id,
            version: version.version,
            abTestId: runningTest.id,
          };
        }
      }
    }

    // 활성 버전 사용
    const activeVersion = this.getActiveVersion(name);
    if (!activeVersion) {
      throw new Error(`활성 프롬프트를 찾을 수 없습니다: ${name}`);
    }

    return {
      text: renderTemplate(activeVersion.template, variables),
      versionId: activeVersion.id,
      version: activeVersion.version,
    };
  }

  // ── A/B 테스트 — FR-ADV9.5 ────────────────────────────────────────

  /**
   * A/B 테스트를 생성합니다
   */
  createABTest(
    name: string,
    promptName: string,
    variants: Array<{ promptVersionId: string; weight: number }>,
  ): ABTest {
    // 가중치 합계 검증 (1.0)
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(`변형 가중치 합계가 1.0이어야 합니다 (현재: ${totalWeight})`);
    }

    const test: ABTest = {
      id: crypto.randomUUID(),
      name,
      promptName,
      variants: variants.map((v) => ({
        ...v,
        metrics: { impressions: 0, avgLatencyMs: 0, avgTokens: 0, userSatisfaction: 0 },
      })),
      status: 'running',
      createdAt: new Date().toISOString(),
    };

    this.abTests.set(test.id, test);
    return test;
  }

  /**
   * A/B 테스트 결과를 기록합니다
   */
  recordABTestResult(
    testId: string,
    variantVersionId: string,
    result: { latencyMs: number; tokens: number; satisfaction?: number },
  ): void {
    const test = this.abTests.get(testId);
    if (!test) return;

    const variant = test.variants.find((v) => v.promptVersionId === variantVersionId);
    if (!variant) return;

    const n = variant.metrics.impressions;
    // 이동 평균 계산
    variant.metrics.avgLatencyMs = (variant.metrics.avgLatencyMs * (n - 1) + result.latencyMs) / n;
    variant.metrics.avgTokens = (variant.metrics.avgTokens * (n - 1) + result.tokens) / n;
    if (result.satisfaction !== undefined) {
      variant.metrics.userSatisfaction =
        (variant.metrics.userSatisfaction * (n - 1) + result.satisfaction) / n;
    }
  }

  /**
   * A/B 테스트를 완료하고 승자를 결정합니다
   */
  completeABTest(testId: string): ABTest {
    const test = this.abTests.get(testId);
    if (!test) throw new Error(`A/B 테스트를 찾을 수 없습니다: ${testId}`);

    // 만족도 기준 승자 결정
    let bestVariant: ABTestVariant | null = null;
    let bestScore = -1;

    for (const variant of test.variants) {
      // 종합 점수: 만족도 50% + 속도 30% + 토큰 효율 20%
      const normalizedLatency = Math.max(0, 1 - variant.metrics.avgLatencyMs / 10000);
      const normalizedTokens = Math.max(0, 1 - variant.metrics.avgTokens / 5000);
      const score =
        variant.metrics.userSatisfaction * 0.5 +
        normalizedLatency * 0.3 +
        normalizedTokens * 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestVariant = variant;
      }
    }

    test.status = 'completed';
    test.completedAt = new Date().toISOString();
    test.winnerId = bestVariant?.promptVersionId;

    return test;
  }

  /**
   * 프롬프트 이름의 실행 중인 A/B 테스트를 반환합니다
   */
  private getRunningABTest(promptName: string): ABTest | null {
    for (const test of this.abTests.values()) {
      if (test.promptName === promptName && test.status === 'running') {
        return test;
      }
    }
    return null;
  }
}

// ── 유틸리티 ─────────────────────────────────────────────────────────────────

/** {{variable}} 패턴에서 변수명 추출 */
function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  const variables = new Set<string>();
  for (const match of matches) {
    if (match[1]) variables.add(match[1]);
  }
  return Array.from(variables);
}

/** 프롬프트 템플릿 렌더링 */
function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    return variables[name] ?? `{{${name}}}`;
  });
}

/** 가중치 기반 변형 선택 (확률적) */
function selectVariantByWeight(variants: ABTestVariant[]): ABTestVariant | null {
  if (variants.length === 0) return null;

  const random = Math.random();
  let cumulative = 0;

  for (const variant of variants) {
    cumulative += variant.weight;
    if (random <= cumulative) return variant;
  }

  // 부동소수점 오차 처리
  return variants[variants.length - 1] ?? null;
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

export function createPromptVersionManager(): PromptVersionManager {
  return new PromptVersionManager();
}
