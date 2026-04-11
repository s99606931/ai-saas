// AI 기반 민원 자동 분류/라우팅 엔진 -- FR-N257.1~FR-N257.6
// Design Ref: MTU-N257 DESIGN §1~§6
// Plan SC: SC-1 (정확도 90%+), SC-2 (처리 <3초), SC-3 (PII 100%), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 개발 보안
// N2SF: O등급 데이터만 AI API 전송, PII 마스킹 필수

// NOTE: randomUUID 사용 예정 -- 현재 규칙 기반 폴백은 UUID 미사용
// import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 공공기관 표준 민원 카테고리 -- Design §1 */
export type CitizenRequestCategory =
  | 'construction_urban'    // 건축/도시
  | 'transportation'        // 교통/도로
  | 'education'             // 교육/학교
  | 'defense_veterans'      // 국방/보훈
  | 'labor_employment'      // 노동/고용
  | 'agriculture'           // 농림/축산
  | 'culture_tourism'       // 문화/관광
  | 'health_medical'        // 보건/의료
  | 'welfare_pension'       // 복지/연금
  | 'industry_economy'      // 산업/경제
  | 'tax_finance'           // 세금/재정
  | 'fire_safety'           // 소방/안전
  | 'water_sewage'          // 수도/하수
  | 'energy_environment'    // 에너지/환경
  | 'women_family'          // 여성/가족
  | 'ict'                   // 정보통신
  | 'resident_registration' // 주민등록
  | 'regional_development'  // 지역개발
  | 'sanitation'            // 청소/환경
  | 'general';              // 기타/일반

/** 긴급도 -- Design §3 */
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

/** 분류 결과 */
export interface ClassificationResult {
  requestId: string;
  categories: Array<{
    category: CitizenRequestCategory;
    confidence: number;
    label: string;
  }>;
  urgency: UrgencyLevel;
  urgencyReason: string;
  department: string;
  departmentId: string;
  autoRouted: boolean;
  requiresManualReview: boolean;
  similarRequests: SimilarRequest[];
  suggestedResponse: string | null;
  processedAt: string;
  processingTimeMs: number;
}

/** 유사 민원 -- Design §4 */
export interface SimilarRequest {
  requestId: string;
  title: string;
  category: CitizenRequestCategory;
  similarity: number;
  resolution: string;
  resolvedAt: string;
}

/** 민원 접수 데이터 */
export interface CitizenRequest {
  id: string;
  tenantId: string;
  title: string;
  content: string;
  submittedBy: string;
  submittedAt: string;
  attachments?: string[];
  grade: 'O';
}

/** 부서 매핑 설정 -- Design §2 */
export interface DepartmentMapping {
  category: CitizenRequestCategory;
  departmentId: string;
  departmentName: string;
  escalationDepartmentId?: string;
}

/** 피드백 기록 -- Design §5 */
export interface ClassificationFeedback {
  requestId: string;
  originalCategory: CitizenRequestCategory;
  correctedCategory: CitizenRequestCategory;
  correctedBy: string;
  correctedAt: string;
  reason?: string;
}

/** 분류기 메트릭 */
export interface ClassifierMetrics {
  totalClassified: number;
  autoRouted: number;
  manualReview: number;
  corrected: number;
  accuracy: number;
  averageProcessingTimeMs: number;
  categoryDistribution: Record<CitizenRequestCategory, number>;
  urgencyDistribution: Record<UrgencyLevel, number>;
}

// -- 카테고리 메타데이터 ─────────────────────────────────────────────────────

/** 카테고리 한글 레이블 매핑 */
const CATEGORY_LABELS: Record<CitizenRequestCategory, string> = {
  construction_urban: '건축/도시',
  transportation: '교통/도로',
  education: '교육/학교',
  defense_veterans: '국방/보훈',
  labor_employment: '노동/고용',
  agriculture: '농림/축산',
  culture_tourism: '문화/관광',
  health_medical: '보건/의료',
  welfare_pension: '복지/연금',
  industry_economy: '산업/경제',
  tax_finance: '세금/재정',
  fire_safety: '소방/안전',
  water_sewage: '수도/하수',
  energy_environment: '에너지/환경',
  women_family: '여성/가족',
  ict: '정보통신',
  resident_registration: '주민등록',
  regional_development: '지역개발',
  sanitation: '청소/환경',
  general: '기타/일반',
};

/** 긴급 키워드 사전 -- Design §3 */
const URGENCY_KEYWORDS: Record<UrgencyLevel, string[]> = {
  critical: [
    '사망', '인명피해', '붕괴', '폭발', '화재', '가스누출', '재난', '긴급',
    '위험', '생명', '구조', '대피', '응급', '비상',
  ],
  high: [
    '기한', '마감', '소송', '법적', '신고', '고발', '피해', '위반',
    '즉시', '시급', '급히', '빠른', '지체', '연체',
  ],
  medium: [
    '민원', '요청', '신청', '문의', '처리', '확인', '변경', '수정',
    '등록', '발급', '조회',
  ],
  low: [
    '건의', '제안', '칭찬', '감사', '의견', '참고', '궁금', '알고',
  ],
};

// -- 분류기 엔진 ──────────────────────────────────────────────────────────────

/** AI 민원 분류기 -- Design §1~§6 */
export class CitizenRequestClassifier {
  private departmentMappings: DepartmentMapping[] = [];
  private feedbackHistory: ClassificationFeedback[] = [];
  private classificationHistory: ClassificationResult[] = [];
  private similarRequestsDb: Array<{
    requestId: string;
    title: string;
    content: string;
    category: CitizenRequestCategory;
    resolution: string;
    resolvedAt: string;
    embedding?: number[];
  }> = [];

  // 메트릭 카운터
  private metrics = {
    totalClassified: 0,
    autoRouted: 0,
    manualReview: 0,
    corrected: 0,
    processingTimes: [] as number[],
    categoryCount: {} as Record<string, number>,
    urgencyCount: {} as Record<string, number>,
  };

  constructor(
    private readonly config: {
      tenantId: string;
      confidenceThreshold: number;    // 자동 라우팅 신뢰도 임계값 (기본 0.7)
      maxSimilarResults: number;       // 유사 민원 최대 결과 수 (기본 5)
      similarityThreshold: number;     // 유사도 임계값 (기본 0.8)
      classifyFn?: (text: string, categories: string[]) => Promise<{
        category: string;
        confidence: number;
      }[]>;
      embedFn?: (text: string) => Promise<number[]>;
    },
  ) {}

  /** 부서 매핑 설정 -- Design §2 */
  setDepartmentMappings(mappings: DepartmentMapping[]): void {
    this.departmentMappings = mappings;
  }

  /** 유사 민원 DB에 이력 추가 -- Design §4 */
  addResolvedRequest(request: {
    requestId: string;
    title: string;
    content: string;
    category: CitizenRequestCategory;
    resolution: string;
    resolvedAt: string;
  }): void {
    this.similarRequestsDb.push(request);
  }

  /** 민원 분류 실행 -- Design §1, §2, §3, §4 */
  async classify(request: CitizenRequest): Promise<ClassificationResult> {
    const startTime = Date.now();

    // CSAP D-08: 테넌트 격리 검증
    if (request.tenantId !== this.config.tenantId) {
      throw new Error(`[SECURITY] 테넌트 불일치: 예상 ${this.config.tenantId}, 실제 ${request.tenantId}`);
    }

    // N2SF: O등급 검증
    if (request.grade !== 'O') {
      throw new Error(`[N2SF] ${request.grade}등급 데이터는 AI 분류 금지`);
    }

    // PII 마스킹 (분류 전)
    const maskedContent = this.maskPII(request.content);
    const maskedTitle = this.maskPII(request.title);
    const fullText = `${maskedTitle}\n${maskedContent}`;

    // §1: 카테고리 분류
    const categories = await this.classifyCategory(fullText);

    // §3: 긴급도 판별
    const { urgency, reason } = this.assessUrgency(request.content);

    // §2: 담당 부서 라우팅
    const primaryCategory = categories[0]?.category ?? 'general';
    const { department, departmentId } = this.routeToDepartment(primaryCategory);

    // §4: 유사 민원 검색
    const similarRequests = await this.findSimilarRequests(fullText);

    // 자동 라우팅 결정
    const firstCategory = categories[0];
    const autoRouted = firstCategory !== undefined && firstCategory.confidence >= this.config.confidenceThreshold;
    const requiresManualReview = !autoRouted;

    // 자동 답변 초안 (유사 사례 기반)
    const firstSimilar = similarRequests[0];
    const suggestedResponse = firstSimilar !== undefined
      ? this.generateSuggestedResponse(firstSimilar)
      : null;

    const processingTimeMs = Date.now() - startTime;

    const result: ClassificationResult = {
      requestId: request.id,
      categories: categories.map((c) => ({
        ...c,
        label: CATEGORY_LABELS[c.category] || c.category,
      })),
      urgency,
      urgencyReason: reason,
      department,
      departmentId,
      autoRouted,
      requiresManualReview,
      similarRequests,
      suggestedResponse,
      processedAt: new Date().toISOString(),
      processingTimeMs,
    };

    // 메트릭 업데이트
    this.updateMetrics(result);

    // 이력 저장
    this.classificationHistory.push(result);

    return result;
  }

  /** 분류 피드백 기록 -- Design §5 */
  recordFeedback(feedback: ClassificationFeedback): void {
    this.feedbackHistory.push(feedback);
    this.metrics.corrected += 1;
  }

  /** 분류기 메트릭 조회 -- Design §5 */
  getMetrics(): ClassifierMetrics {
    const avgProcessingTime = this.metrics.processingTimes.length > 0
      ? this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length
      : 0;

    const accuracy = this.metrics.totalClassified > 0
      ? ((this.metrics.totalClassified - this.metrics.corrected) / this.metrics.totalClassified) * 100
      : 100;

    return {
      totalClassified: this.metrics.totalClassified,
      autoRouted: this.metrics.autoRouted,
      manualReview: this.metrics.manualReview,
      corrected: this.metrics.corrected,
      accuracy: Math.round(accuracy * 100) / 100,
      averageProcessingTimeMs: Math.round(avgProcessingTime * 100) / 100,
      categoryDistribution: this.metrics.categoryCount as Record<CitizenRequestCategory, number>,
      urgencyDistribution: this.metrics.urgencyCount as Record<UrgencyLevel, number>,
    };
  }

  /** 분류 이력 조회 */
  getHistory(limit = 100): ClassificationResult[] {
    return this.classificationHistory.slice(-limit);
  }

  /** 피드백 이력 조회 */
  getFeedbackHistory(limit = 100): ClassificationFeedback[] {
    return this.feedbackHistory.slice(-limit);
  }

  // -- 내부 메서드 ──────────────────────────────────────────────────────────

  /** 카테고리 분류 -- Design §1 */
  private async classifyCategory(
    text: string,
  ): Promise<Array<{ category: CitizenRequestCategory; confidence: number }>> {
    // 외부 LLM 분류 함수가 제공된 경우
    if (this.config.classifyFn) {
      const categories = Object.keys(CATEGORY_LABELS);
      const results = await this.config.classifyFn(text, categories);
      return results
        .filter((r) => r.confidence > 0.1)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3)
        .map((r) => ({
          category: r.category as CitizenRequestCategory,
          confidence: r.confidence,
        }));
    }

    // 규칙 기반 폴백 분류
    return this.ruleBasedClassify(text);
  }

  /** 규칙 기반 분류 (LLM 폴백) */
  private ruleBasedClassify(
    text: string,
  ): Array<{ category: CitizenRequestCategory; confidence: number }> {
    const categoryKeywords: Record<CitizenRequestCategory, string[]> = {
      construction_urban: ['건축', '건물', '허가', '도시계획', '재개발', '주택', '아파트', '리모델링'],
      transportation: ['교통', '도로', '주차', '신호등', '버스', '지하철', '보도', '횡단보도'],
      education: ['학교', '교육', '학생', '입학', '졸업', '교과', '학원', '방과후'],
      defense_veterans: ['국방', '군대', '보훈', '참전', '제대', '병역'],
      labor_employment: ['노동', '고용', '급여', '임금', '해고', '근로', '실업', '취업'],
      agriculture: ['농업', '축산', '농산물', '가축', '농지', '귀농'],
      culture_tourism: ['문화', '관광', '축제', '공연', '전시', '여행', '박물관'],
      health_medical: ['병원', '의료', '건강', '보건', '진료', '약국', '의약'],
      welfare_pension: ['복지', '연금', '장애', '기초생활', '돌봄', '보육', '어르신'],
      industry_economy: ['산업', '경제', '기업', '창업', '투자', '수출', '무역'],
      tax_finance: ['세금', '납세', '과세', '재정', '예산', '세무', '부과'],
      fire_safety: ['소방', '화재', '안전', '소화기', '비상구', '대피', '119'],
      water_sewage: ['수도', '하수', '상수도', '하수도', '급수', '배수', '정수'],
      energy_environment: ['에너지', '전기', '가스', '환경', '오염', '폐기물', '재활용'],
      women_family: ['여성', '가족', '양성평등', '출산', '육아', '가정폭력'],
      ict: ['정보통신', '인터넷', '전산', 'IT', '디지털', '온라인', '시스템'],
      resident_registration: ['주민등록', '전입신고', '인감', '등본', '초본', '신분증'],
      regional_development: ['지역개발', '도시재생', '개발사업', '택지', '용도지역'],
      sanitation: ['청소', '쓰레기', '분리수거', '미화', '악취', '방역', '소독'],
      general: [],
    };

    const scores: Array<{ category: CitizenRequestCategory; confidence: number }> = [];
    const normalizedText = text.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.length === 0) continue;
      const matchCount = keywords.filter((kw) => normalizedText.includes(kw)).length;
      if (matchCount > 0) {
        const confidence = Math.min(matchCount / keywords.length + 0.3, 0.95);
        scores.push({
          category: category as CitizenRequestCategory,
          confidence: Math.round(confidence * 100) / 100,
        });
      }
    }

    if (scores.length === 0) {
      scores.push({ category: 'general', confidence: 0.5 });
    }

    return scores.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /** 긴급도 판별 -- Design §3 */
  private assessUrgency(content: string): { urgency: UrgencyLevel; reason: string } {
    const normalizedContent = content.toLowerCase();

    // 키워드 기반 판별 (높은 긴급도부터 검사)
    for (const level of ['critical', 'high', 'medium', 'low'] as UrgencyLevel[]) {
      const keywords = URGENCY_KEYWORDS[level];
      const matched = keywords.filter((kw) => normalizedContent.includes(kw));
      if (matched.length > 0) {
        return {
          urgency: level,
          reason: `키워드 감지: ${matched.slice(0, 3).join(', ')}`,
        };
      }
    }

    return { urgency: 'medium', reason: '기본 긴급도 (특별 키워드 미감지)' };
  }

  /** 담당 부서 라우팅 -- Design §2 */
  private routeToDepartment(category: CitizenRequestCategory): {
    department: string;
    departmentId: string;
  } {
    const mapping = this.departmentMappings.find((m) => m.category === category);
    if (mapping) {
      return {
        department: mapping.departmentName,
        departmentId: mapping.departmentId,
      };
    }

    // 기본 부서 (매핑 없는 경우)
    return {
      department: '민원처리과',
      departmentId: 'dept-general',
    };
  }

  /** 유사 민원 검색 -- Design §4 */
  private async findSimilarRequests(text: string): Promise<SimilarRequest[]> {
    if (this.similarRequestsDb.length === 0) {
      return [];
    }

    // 임베딩 기반 검색이 가능한 경우
    if (this.config.embedFn) {
      // 임베딩 기반 유사도 검색 (실제 구현)
      // 여기서는 간단한 텍스트 유사도 폴백 사용
    }

    // 텍스트 유사도 기반 검색 (폴백)
    const results = this.similarRequestsDb
      .map((req) => ({
        requestId: req.requestId,
        title: req.title,
        category: req.category,
        similarity: this.textSimilarity(text, `${req.title} ${req.content}`),
        resolution: req.resolution,
        resolvedAt: req.resolvedAt,
      }))
      .filter((r) => r.similarity >= this.config.similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.config.maxSimilarResults);

    return results;
  }

  /** 텍스트 유사도 (자카드 계수) */
  private textSimilarity(textA: string, textB: string): number {
    const tokensA = new Set(textA.split(/\s+/).filter((t) => t.length > 1));
    const tokensB = new Set(textB.split(/\s+/).filter((t) => t.length > 1));

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) intersection += 1;
    }

    const union = tokensA.size + tokensB.size - intersection;
    return union > 0 ? Math.round((intersection / union) * 100) / 100 : 0;
  }

  /** 자동 답변 초안 생성 -- Design §4 */
  private generateSuggestedResponse(similar: SimilarRequest): string {
    return `유사 민원 [${similar.requestId}] "${similar.title}" 처리 이력을 참고하세요.\n` +
      `처리 결과: ${similar.resolution}\n` +
      `처리일: ${similar.resolvedAt}`;
  }

  /** PII 마스킹 -- N2SF, CSAP D-08 */
  private maskPII(text: string): string {
    return text
      .replace(/\d{6}-[1-4]\d{6}/g, '******-*******')          // 주민등록번호
      .replace(/01[016789]-?\d{3,4}-?\d{4}/g, '010-****-****') // 휴대전화
      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '***@***.***')         // 이메일
      .replace(/\d{3}-\d{2}-\d{5}/g, '***-**-*****');          // 사업자등록번호
  }

  /** 메트릭 업데이트 */
  private updateMetrics(result: ClassificationResult): void {
    this.metrics.totalClassified += 1;
    if (result.autoRouted) {
      this.metrics.autoRouted += 1;
    } else {
      this.metrics.manualReview += 1;
    }
    this.metrics.processingTimes.push(result.processingTimeMs);
    if (this.metrics.processingTimes.length > 1000) {
      this.metrics.processingTimes = this.metrics.processingTimes.slice(-1000);
    }

    // 카테고리 분포
    const primaryCat = result.categories[0]?.category ?? 'general';
    this.metrics.categoryCount[primaryCat] = (this.metrics.categoryCount[primaryCat] || 0) + 1;

    // 긴급도 분포
    this.metrics.urgencyCount[result.urgency] = (this.metrics.urgencyCount[result.urgency] || 0) + 1;
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

/** 기본 설정 민원 분류기 생성 */
export function createCitizenRequestClassifier(
  tenantId: string,
  options?: {
    confidenceThreshold?: number;
    maxSimilarResults?: number;
    similarityThreshold?: number;
    classifyFn?: (text: string, categories: string[]) => Promise<{ category: string; confidence: number }[]>;
    embedFn?: (text: string) => Promise<number[]>;
  },
): CitizenRequestClassifier {
  return new CitizenRequestClassifier({
    tenantId,
    confidenceThreshold: options?.confidenceThreshold ?? 0.7,
    maxSimilarResults: options?.maxSimilarResults ?? 5,
    similarityThreshold: options?.similarityThreshold ?? 0.8,
    classifyFn: options?.classifyFn,
    embedFn: options?.embedFn,
  });
}

/** 기본 부서 매핑 프리셋 (공공기관 표준) */
export function getDefaultDepartmentMappings(): DepartmentMapping[] {
  return [
    { category: 'construction_urban', departmentId: 'dept-construction', departmentName: '건축과' },
    { category: 'transportation', departmentId: 'dept-transport', departmentName: '교통과' },
    { category: 'education', departmentId: 'dept-education', departmentName: '교육지원과' },
    { category: 'defense_veterans', departmentId: 'dept-veterans', departmentName: '보훈과' },
    { category: 'labor_employment', departmentId: 'dept-labor', departmentName: '일자리정책과' },
    { category: 'agriculture', departmentId: 'dept-agriculture', departmentName: '농업기술과' },
    { category: 'culture_tourism', departmentId: 'dept-culture', departmentName: '문화관광과' },
    { category: 'health_medical', departmentId: 'dept-health', departmentName: '보건소' },
    { category: 'welfare_pension', departmentId: 'dept-welfare', departmentName: '복지정책과' },
    { category: 'industry_economy', departmentId: 'dept-industry', departmentName: '경제정책과' },
    { category: 'tax_finance', departmentId: 'dept-tax', departmentName: '세무과' },
    { category: 'fire_safety', departmentId: 'dept-fire', departmentName: '소방안전과' },
    { category: 'water_sewage', departmentId: 'dept-water', departmentName: '상하수도과' },
    { category: 'energy_environment', departmentId: 'dept-environment', departmentName: '환경과' },
    { category: 'women_family', departmentId: 'dept-family', departmentName: '여성가족과' },
    { category: 'ict', departmentId: 'dept-ict', departmentName: '정보화담당관' },
    { category: 'resident_registration', departmentId: 'dept-resident', departmentName: '민원봉사과' },
    { category: 'regional_development', departmentId: 'dept-development', departmentName: '도시개발과' },
    { category: 'sanitation', departmentId: 'dept-sanitation', departmentName: '청소과' },
    { category: 'general', departmentId: 'dept-general', departmentName: '민원처리과' },
  ];
}
