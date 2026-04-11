// MTU-N257 단위 테스트: AI 민원 자동 분류/라우팅 엔진
// Design Ref: MTU-N257 DESIGN §1~§6
// Plan SC: FR-N257.1~FR-N257.6
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 개발 보안
// N2SF: O등급 데이터만 AI API 전송

import { describe, it, expect, beforeEach } from 'vitest';

import {
  CitizenRequestClassifier,
  createCitizenRequestClassifier,
  getDefaultDepartmentMappings,
  type CitizenRequest,
  type DepartmentMapping,
} from '../../src/lib/citizen-request-classifier.js';

// -- 헬퍼 ──────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<CitizenRequest> = {}): CitizenRequest {
  return {
    id: 'req-001',
    tenantId: 'tenant-A',
    title: '도로 신호등 점검 요청',
    content: '우리 동네 교차로 신호등이 고장났습니다.',
    submittedBy: 'citizen-1',
    submittedAt: new Date().toISOString(),
    grade: 'O',
    ...overrides,
  };
}

function makeClassifier(
  opts: {
    tenantId?: string;
    confidenceThreshold?: number;
    classifyFn?: (text: string, categories: string[]) => Promise<{ category: string; confidence: number }[]>;
  } = {},
): CitizenRequestClassifier {
  return createCitizenRequestClassifier(opts.tenantId ?? 'tenant-A', {
    confidenceThreshold: opts.confidenceThreshold ?? 0.7,
    maxSimilarResults: 5,
    similarityThreshold: 0.3, // 낮은 임계값 (테스트 편의)
    classifyFn: opts.classifyFn,
  });
}

// -- 규칙 기반 분류 -- Design §1 ───────────────────────────────────────────

describe('CitizenRequestClassifier 규칙 기반 분류 (FR-N257.1)', () => {
  let classifier: CitizenRequestClassifier;

  beforeEach(() => {
    classifier = makeClassifier();
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());
  });

  it('교통 관련 민원을 transportation으로 분류한다', async () => {
    const result = await classifier.classify(makeRequest({
      title: '도로 신호등 점검 요청',
      content: '교차로 신호등이 고장났습니다. 교통 사고 위험이 있습니다.',
    }));
    expect(result.categories[0]!.category).toBe('transportation');
    expect(result.categories[0]!.confidence).toBeGreaterThan(0.3);
  });

  it('건축 관련 민원을 construction_urban으로 분류한다', async () => {
    const result = await classifier.classify(makeRequest({
      title: '건축 허가 신청',
      content: '신규 건물 건축 허가를 신청합니다. 도시계획 구역입니다.',
    }));
    expect(result.categories[0]!.category).toBe('construction_urban');
  });

  it('복지 관련 민원을 welfare_pension으로 분류한다', async () => {
    const result = await classifier.classify(makeRequest({
      title: '기초생활 수급 문의',
      content: '기초생활 수급자 복지 혜택에 대해 문의합니다.',
    }));
    expect(result.categories[0]!.category).toBe('welfare_pension');
  });

  it('키워드 미매칭 시 general로 분류한다', async () => {
    const result = await classifier.classify(makeRequest({
      title: '안녕하세요',
      content: '특별한 키워드 없는 일반 텍스트입니다.',
    }));
    expect(result.categories[0]!.category).toBe('general');
    expect(result.categories[0]!.confidence).toBe(0.5);
  });

  it('분류 결과에 한글 레이블을 포함한다', async () => {
    const result = await classifier.classify(makeRequest({
      title: '세금 납부 문의',
      content: '재산세 납세 일정을 알려주세요.',
    }));
    expect(result.categories[0]!.label).toBe('세금/재정');
  });

  it('최대 3개 카테고리를 반환한다', async () => {
    const result = await classifier.classify(makeRequest({
      title: '복합 민원',
      content: '교통 도로 관련이면서 건축 허가 관련 문의입니다. 세금 납세 관련도 포함합니다.',
    }));
    expect(result.categories.length).toBeLessThanOrEqual(3);
  });
});

// -- 외부 LLM 분류 -- Design §1 ─────────────────────────────────────────────

describe('CitizenRequestClassifier LLM 분류 (FR-N257.1)', () => {
  it('classifyFn이 제공되면 LLM 분류를 사용한다', async () => {
    const classifier = makeClassifier({
      classifyFn: async () => [
        { category: 'health_medical', confidence: 0.92 },
        { category: 'welfare_pension', confidence: 0.45 },
      ],
    });
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());

    const result = await classifier.classify(makeRequest({
      content: '건강검진 결과 문의',
    }));
    expect(result.categories[0]!.category).toBe('health_medical');
    expect(result.categories[0]!.confidence).toBe(0.92);
  });

  it('classifyFn 결과에서 confidence 0.1 이하를 필터링한다', async () => {
    const classifier = makeClassifier({
      classifyFn: async () => [
        { category: 'health_medical', confidence: 0.8 },
        { category: 'general', confidence: 0.05 },
      ],
    });
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());

    const result = await classifier.classify(makeRequest());
    // confidence 0.05는 필터링됨
    expect(result.categories.every((c) => c.confidence > 0.1)).toBe(true);
  });
});

// -- 긴급도 판별 -- Design §3 ──────────────────────────────────────────────

describe('CitizenRequestClassifier 긴급도 판별 (FR-N257.3)', () => {
  let classifier: CitizenRequestClassifier;

  beforeEach(() => {
    classifier = makeClassifier();
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());
  });

  it('critical 키워드를 감지한다', async () => {
    const result = await classifier.classify(makeRequest({
      content: '건물이 붕괴 위험이 있어 긴급 대피가 필요합니다.',
    }));
    expect(result.urgency).toBe('critical');
    expect(result.urgencyReason).toContain('붕괴');
  });

  it('high 키워드를 감지한다', async () => {
    const result = await classifier.classify(makeRequest({
      content: '법적 소송 기한이 임박하여 즉시 처리가 필요합니다.',
    }));
    expect(result.urgency).toBe('high');
  });

  it('medium 키워드를 감지한다', async () => {
    const result = await classifier.classify(makeRequest({
      content: '주민등록 등본 발급을 신청합니다.',
    }));
    expect(result.urgency).toBe('medium');
  });

  it('low 키워드를 감지한다', async () => {
    const result = await classifier.classify(makeRequest({
      content: '시정 정책에 대한 건의 사항입니다.',
    }));
    expect(result.urgency).toBe('low');
  });

  it('특별 키워드 미감지 시 medium 기본값', async () => {
    const result = await classifier.classify(makeRequest({
      content: '특별한 키워드 없는 내용',
    }));
    expect(result.urgency).toBe('medium');
    expect(result.urgencyReason).toContain('기본 긴급도');
  });
});

// -- 부서 라우팅 -- Design §2 ──────────────────────────────────────────────

describe('CitizenRequestClassifier 부서 라우팅 (FR-N257.2)', () => {
  let classifier: CitizenRequestClassifier;

  beforeEach(() => {
    classifier = makeClassifier();
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());
  });

  it('교통 민원을 교통과로 라우팅한다', async () => {
    const result = await classifier.classify(makeRequest({
      content: '도로 교통 신호등 점검 요청',
    }));
    expect(result.department).toBe('교통과');
    expect(result.departmentId).toBe('dept-transport');
  });

  it('매핑 없는 카테고리는 민원처리과로 라우팅한다', async () => {
    classifier.setDepartmentMappings([]); // 매핑 비우기
    const result = await classifier.classify(makeRequest());
    expect(result.department).toBe('민원처리과');
    expect(result.departmentId).toBe('dept-general');
  });
});

// -- 자동 라우팅 결정 ─────────────────────────────────────────────────────

describe('CitizenRequestClassifier 자동 라우팅 (FR-N257.2)', () => {
  it('신뢰도 >= threshold 이면 autoRouted', async () => {
    const classifier = makeClassifier({
      confidenceThreshold: 0.5,
      classifyFn: async () => [{ category: 'transportation', confidence: 0.8 }],
    });
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());

    const result = await classifier.classify(makeRequest());
    expect(result.autoRouted).toBe(true);
    expect(result.requiresManualReview).toBe(false);
  });

  it('신뢰도 < threshold 이면 수동 검토 필요', async () => {
    const classifier = makeClassifier({
      confidenceThreshold: 0.9,
      classifyFn: async () => [{ category: 'transportation', confidence: 0.5 }],
    });
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());

    const result = await classifier.classify(makeRequest());
    expect(result.autoRouted).toBe(false);
    expect(result.requiresManualReview).toBe(true);
  });
});

// -- 유사 민원 검색 -- Design §4 ──────────────────────────────────────────

describe('CitizenRequestClassifier 유사 민원 (FR-N257.4)', () => {
  it('유사 민원이 있으면 검색 결과와 자동 답변을 반환한다', async () => {
    const classifier = makeClassifier();
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());

    // 이전 처리된 민원 등록
    classifier.addResolvedRequest({
      requestId: 'prev-001',
      title: '도로 교통 신호등 고장',
      content: '교차로 신호등 고장 신고',
      category: 'transportation',
      resolution: '교통과에서 48시간 내 수리 완료',
      resolvedAt: '2026-03-01',
    });

    const result = await classifier.classify(makeRequest({
      title: '교통 신호등 고장 신고',
      content: '우리 동네 교차로 신호등 고장 신고합니다.',
    }));

    expect(result.similarRequests.length).toBeGreaterThan(0);
    expect(result.suggestedResponse).toBeTruthy();
    expect(result.suggestedResponse).toContain('prev-001');
  });

  it('유사 민원이 없으면 빈 배열과 null', async () => {
    const classifier = makeClassifier();
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());

    const result = await classifier.classify(makeRequest({
      content: '완전히 다른 주제의 민원 내용',
    }));
    expect(result.similarRequests).toHaveLength(0);
    expect(result.suggestedResponse).toBeNull();
  });
});

// -- PII 마스킹 -- N2SF, CSAP D-08 ─────────────────────────────────────────

describe('CitizenRequestClassifier PII 마스킹 (N2SF)', () => {
  let classifier: CitizenRequestClassifier;

  beforeEach(() => {
    classifier = makeClassifier({
      classifyFn: async (text) => {
        // PII가 마스킹되었는지 텍스트 내용으로 확인
        if (text.includes('900101-1234567')) {
          throw new Error('PII 마스킹 실패: 주민번호 노출');
        }
        if (text.includes('user@test.com')) {
          throw new Error('PII 마스킹 실패: 이메일 노출');
        }
        if (text.includes('010-1234-5678')) {
          throw new Error('PII 마스킹 실패: 전화번호 노출');
        }
        return [{ category: 'general', confidence: 0.5 }];
      },
    });
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());
  });

  it('주민등록번호를 마스킹한다', async () => {
    // classifyFn 내에서 PII 감지 시 에러를 던짐 → 에러 없이 통과하면 마스킹 성공
    const result = await classifier.classify(makeRequest({
      content: '주민번호 900101-1234567 입니다.',
    }));
    expect(result).toBeDefined();
  });

  it('이메일을 마스킹한다', async () => {
    const result = await classifier.classify(makeRequest({
      content: '이메일은 user@test.com 입니다.',
    }));
    expect(result).toBeDefined();
  });

  it('전화번호를 마스킹한다', async () => {
    const result = await classifier.classify(makeRequest({
      content: '연락처: 010-1234-5678',
    }));
    expect(result).toBeDefined();
  });
});

// -- 보안 검증 -- CSAP D-08 ──────────────────────────────────────────────

describe('CitizenRequestClassifier 보안 (CSAP D-08)', () => {
  let classifier: CitizenRequestClassifier;

  beforeEach(() => {
    classifier = makeClassifier();
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());
  });

  it('테넌트 불일치 시 에러를 발생시킨다', async () => {
    await expect(
      classifier.classify(makeRequest({ tenantId: 'tenant-B' })),
    ).rejects.toThrow('[SECURITY] 테넌트 불일치');
  });

  it('O등급이 아닌 데이터는 거부한다', async () => {
    await expect(
      classifier.classify(makeRequest({ grade: 'C' as 'O' })),
    ).rejects.toThrow('[N2SF]');
  });
});

// -- 피드백 -- Design §5 ─────────────────────────────────────────────────

describe('CitizenRequestClassifier 피드백 (FR-N257.5)', () => {
  let classifier: CitizenRequestClassifier;

  beforeEach(() => {
    classifier = makeClassifier();
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());
  });

  it('피드백을 기록한다', () => {
    classifier.recordFeedback({
      requestId: 'req-001',
      originalCategory: 'transportation',
      correctedCategory: 'construction_urban',
      correctedBy: 'admin-1',
      correctedAt: new Date().toISOString(),
      reason: '건축 관련 민원이었음',
    });

    const history = classifier.getFeedbackHistory();
    expect(history).toHaveLength(1);
    expect(history[0]!.correctedCategory).toBe('construction_urban');
  });

  it('피드백이 정확도 메트릭에 반영된다', async () => {
    await classifier.classify(makeRequest());
    classifier.recordFeedback({
      requestId: 'req-001',
      originalCategory: 'transportation',
      correctedCategory: 'general',
      correctedBy: 'admin-1',
      correctedAt: new Date().toISOString(),
    });

    const metrics = classifier.getMetrics();
    expect(metrics.corrected).toBe(1);
    expect(metrics.accuracy).toBeLessThan(100);
  });
});

// -- 메트릭 -- Design §5 ─────────────────────────────────────────────────

describe('CitizenRequestClassifier 메트릭 (FR-N257.6)', () => {
  let classifier: CitizenRequestClassifier;

  beforeEach(() => {
    classifier = makeClassifier();
    classifier.setDepartmentMappings(getDefaultDepartmentMappings());
  });

  it('초기 메트릭은 0', () => {
    const metrics = classifier.getMetrics();
    expect(metrics.totalClassified).toBe(0);
    expect(metrics.autoRouted).toBe(0);
    expect(metrics.accuracy).toBe(100);
    expect(metrics.averageProcessingTimeMs).toBe(0);
  });

  it('분류 후 메트릭이 증가한다', async () => {
    await classifier.classify(makeRequest());
    const metrics = classifier.getMetrics();
    expect(metrics.totalClassified).toBe(1);
    expect(metrics.averageProcessingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('카테고리 분포를 추적한다', async () => {
    await classifier.classify(makeRequest({
      content: '교통 도로 신호등 관련 민원',
    }));
    const metrics = classifier.getMetrics();
    expect(metrics.categoryDistribution['transportation']).toBe(1);
  });

  it('긴급도 분포를 추적한다', async () => {
    await classifier.classify(makeRequest({
      content: '화재 발생 긴급 상황입니다.',
    }));
    const metrics = classifier.getMetrics();
    expect(metrics.urgencyDistribution['critical']).toBe(1);
  });

  it('분류 이력을 조회한다', async () => {
    await classifier.classify(makeRequest());
    const history = classifier.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]!.requestId).toBe('req-001');
  });
});

// -- 팩토리 / 기본 매핑 ─────────────────────────────────────────────────────

describe('createCitizenRequestClassifier 팩토리', () => {
  it('기본 설정으로 분류기를 생성한다', () => {
    const classifier = createCitizenRequestClassifier('tenant-A');
    expect(classifier).toBeInstanceOf(CitizenRequestClassifier);
  });
});

describe('getDefaultDepartmentMappings', () => {
  it('20개 기본 부서 매핑을 반환한다', () => {
    const mappings = getDefaultDepartmentMappings();
    expect(mappings).toHaveLength(20);
  });

  it('모든 매핑에 departmentId와 departmentName이 있다', () => {
    const mappings = getDefaultDepartmentMappings();
    for (const mapping of mappings) {
      expect(mapping.departmentId).toBeTruthy();
      expect(mapping.departmentName).toBeTruthy();
    }
  });
});
