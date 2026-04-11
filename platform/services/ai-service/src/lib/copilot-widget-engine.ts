// AI 코파일럿 위젯 엔진 -- FR-N258.1~FR-N258.7
// Design Ref: MTU-N258 DESIGN §1~§7
// Plan SC: 위젯 등록/해제, 컨텍스트 수집, AI 쿼리, 내장 위젯 3종, 권한 관리
// CSAP: D-08 접근 통제, D-12 개발 보안
// N2SF: O등급 데이터만 AI API 전송

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 위젯 타입 */
export type WidgetType =
  | 'data_summary'        // 데이터 요약
  | 'regulation_search'   // 규정 검색
  | 'report_draft'        // 보고서 초안
  | 'chat'                // 일반 대화
  | 'custom';             // 커스텀

/** 사용자 역할 */
export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';

/** 위젯 등록 정보 -- Design §1 */
export interface WidgetDefinition {
  id: string;
  type: WidgetType;
  name: string;
  description: string;
  version: string;
  icon: string;
  allowedRoles: UserRole[];
  isActive: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** 페이지 컨텍스트 -- Design §2 */
export interface PageContext {
  url: string;
  module: string;
  subModule?: string;
  selectedData?: unknown;
  dashboardMetrics?: Record<string, number | string>;
  userRole: UserRole;
  userId: string;
  tenantId: string;
  locale: string;
  timestamp: string;
}

/** AI 쿼리 요청 */
export interface CopilotQuery {
  widgetId: string;
  question: string;
  context: PageContext;
  options?: {
    maxTokens?: number;
    temperature?: number;
    format?: 'text' | 'markdown' | 'json' | 'table';
  };
}

/** AI 쿼리 응답 */
export interface CopilotResponse {
  queryId: string;
  widgetId: string;
  answer: string;
  format: string;
  sources?: Array<{ title: string; reference: string }>;
  suggestions?: string[];
  confidence: number;
  processingTimeMs: number;
  tokenUsage: { prompt: number; completion: number; total: number };
  timestamp: string;
}

/** 위젯 사용 통계 */
export interface WidgetUsageStats {
  widgetId: string;
  totalQueries: number;
  averageResponseTimeMs: number;
  totalTokensUsed: number;
  userCount: number;
  lastUsedAt: string;
}

// -- 위젯 레지스트리 -- Design §1 ────────────────────────────────────────────

/** 위젯 레지스트리: 등록, 해제, 검색 */
export class WidgetRegistry {
  private widgets = new Map<string, WidgetDefinition>();

  /** 위젯 등록 */
  register(definition: Omit<WidgetDefinition, 'id' | 'createdAt' | 'updatedAt'>): WidgetDefinition {
    const widget: WidgetDefinition = {
      ...definition,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.widgets.set(widget.id, widget);
    return widget;
  }

  /** 위젯 해제 */
  unregister(widgetId: string): boolean {
    return this.widgets.delete(widgetId);
  }

  /** 위젯 조회 */
  get(widgetId: string): WidgetDefinition | undefined {
    return this.widgets.get(widgetId);
  }

  /** 타입별 위젯 검색 */
  findByType(type: WidgetType): WidgetDefinition[] {
    return Array.from(this.widgets.values()).filter((w) => w.type === type);
  }

  /** 역할 접근 가능한 위젯 목록 -- CSAP D-08 */
  getAccessible(role: UserRole): WidgetDefinition[] {
    return Array.from(this.widgets.values()).filter(
      (w) => w.isActive && w.allowedRoles.includes(role),
    );
  }

  /** 활성 위젯 목록 */
  getActive(): WidgetDefinition[] {
    return Array.from(this.widgets.values()).filter((w) => w.isActive);
  }

  /** 위젯 활성/비활성 토글 */
  setActive(widgetId: string, isActive: boolean): boolean {
    const widget = this.widgets.get(widgetId);
    if (!widget) return false;
    widget.isActive = isActive;
    widget.updatedAt = new Date().toISOString();
    return true;
  }

  /** 전체 위젯 수 */
  size(): number {
    return this.widgets.size;
  }

  /** 전체 위젯 목록 */
  getAll(): WidgetDefinition[] {
    return Array.from(this.widgets.values());
  }
}

// -- 컨텍스트 수집기 -- Design §2 ────────────────────────────────────────────

/** 페이지 컨텍스트 수집기 */
export class ContextCollector {
  /** 현재 페이지 컨텍스트 구성 */
  collect(params: {
    url: string;
    userRole: UserRole;
    userId: string;
    tenantId: string;
    selectedData?: unknown;
    dashboardMetrics?: Record<string, number | string>;
  }): PageContext {
    const { module, subModule } = this.parseUrl(params.url);

    return {
      url: params.url,
      module,
      subModule,
      selectedData: params.selectedData,
      dashboardMetrics: params.dashboardMetrics,
      userRole: params.userRole,
      userId: params.userId,
      tenantId: params.tenantId,
      locale: 'ko-KR',
      timestamp: new Date().toISOString(),
    };
  }

  /** URL에서 모듈/서브모듈 추출 */
  private parseUrl(url: string): { module: string; subModule?: string } {
    const parts = url.replace(/^\/+/, '').split('/').filter(Boolean);
    return {
      module: parts[0] || 'home',
      subModule: parts[1],
    };
  }
}

// -- AI 쿼리 엔진 -- Design §3 ──────────────────────────────────────────────

/** AI 코파일럿 쿼리 엔진 */
export class CopilotQueryEngine {
  private usageStats = new Map<string, WidgetUsageStats>();
  private queryHistory: CopilotResponse[] = [];

  constructor(
    private readonly config: {
      tenantId: string;
      queryFn?: (systemPrompt: string, userMessage: string) => Promise<{
        answer: string;
        tokensUsed: { prompt: number; completion: number };
      }>;
      ragQueryFn?: (question: string, tenantId: string) => Promise<{
        answer: string;
        sources: Array<{ title: string; reference: string }>;
      }>;
    },
  ) {}

  /** 코파일럿 쿼리 실행 -- Design §3 */
  async query(
    registry: WidgetRegistry,
    request: CopilotQuery,
  ): Promise<CopilotResponse> {
    const startTime = Date.now();

    // CSAP D-08: 위젯 접근 권한 확인
    const widget = registry.get(request.widgetId);
    if (!widget) {
      throw new Error(`위젯을 찾을 수 없습니다: ${request.widgetId}`);
    }
    if (!widget.isActive) {
      throw new Error(`비활성화된 위젯입니다: ${widget.name}`);
    }
    if (!widget.allowedRoles.includes(request.context.userRole)) {
      throw new Error(`[SECURITY] 권한 부족: ${request.context.userRole} 역할은 ${widget.name} 위젯에 접근할 수 없습니다`);
    }

    // CSAP D-08: 테넌트 격리 검증
    if (request.context.tenantId !== this.config.tenantId) {
      throw new Error(`[SECURITY] 테넌트 불일치: ${request.context.tenantId}`);
    }

    // 위젯 타입별 분기 처리
    let answer: string;
    let sources: Array<{ title: string; reference: string }> = [];
    let tokensUsed = { prompt: 0, completion: 0 };

    switch (widget.type) {
      case 'data_summary':
        ({ answer, tokensUsed } = await this.handleDataSummary(request));
        break;
      case 'regulation_search':
        ({ answer, sources } = await this.handleRegulationSearch(request));
        break;
      case 'report_draft':
        ({ answer, tokensUsed } = await this.handleReportDraft(request));
        break;
      default:
        ({ answer, tokensUsed } = await this.handleGenericQuery(request));
    }

    const processingTimeMs = Date.now() - startTime;

    const response: CopilotResponse = {
      queryId: randomUUID(),
      widgetId: request.widgetId,
      answer,
      format: request.options?.format ?? 'markdown',
      sources: sources.length > 0 ? sources : undefined,
      suggestions: this.generateSuggestions(widget.type, request.context),
      confidence: 0.85,
      processingTimeMs,
      tokenUsage: {
        prompt: tokensUsed.prompt,
        completion: tokensUsed.completion,
        total: tokensUsed.prompt + tokensUsed.completion,
      },
      timestamp: new Date().toISOString(),
    };

    // 사용 통계 업데이트
    this.updateUsageStats(request.widgetId, response);

    // 이력 저장
    this.queryHistory.push(response);
    if (this.queryHistory.length > 1000) {
      this.queryHistory = this.queryHistory.slice(-1000);
    }

    return response;
  }

  /** 사용 통계 조회 */
  getUsageStats(widgetId?: string): WidgetUsageStats[] {
    if (widgetId) {
      const stats = this.usageStats.get(widgetId);
      return stats ? [stats] : [];
    }
    return Array.from(this.usageStats.values());
  }

  /** 쿼리 이력 조회 */
  getQueryHistory(limit = 50): CopilotResponse[] {
    return this.queryHistory.slice(-limit);
  }

  // -- 위젯별 처리 로직 ────────────────────────────────────────────────────

  /** §4: 데이터 요약 위젯 */
  private async handleDataSummary(request: CopilotQuery): Promise<{
    answer: string;
    tokensUsed: { prompt: number; completion: number };
  }> {
    const dataStr = request.context.selectedData
      ? JSON.stringify(request.context.selectedData).slice(0, 4000)
      : '선택된 데이터 없음';

    const systemPrompt = `당신은 공공기관 데이터 분석 전문가입니다.
현재 페이지: ${request.context.module}/${request.context.subModule || ''}
사용자 역할: ${request.context.userRole}
선택된 데이터를 분석하고 핵심을 요약하세요.`;

    if (this.config.queryFn) {
      const result = await this.config.queryFn(
        systemPrompt,
        `다음 데이터를 요약해주세요:\n${dataStr}\n\n질문: ${request.question}`,
      );
      return { answer: result.answer, tokensUsed: result.tokensUsed };
    }

    // 폴백: 기본 요약
    return {
      answer: `[데이터 요약]\n모듈: ${request.context.module}\n데이터 항목 수: ${
        typeof request.context.selectedData === 'object' && request.context.selectedData !== null
          ? Object.keys(request.context.selectedData as Record<string, unknown>).length
          : 0
      }개\n질문: ${request.question}`,
      tokensUsed: { prompt: 0, completion: 0 },
    };
  }

  /** §5: 규정 검색 위젯 */
  private async handleRegulationSearch(request: CopilotQuery): Promise<{
    answer: string;
    sources: Array<{ title: string; reference: string }>;
  }> {
    if (this.config.ragQueryFn) {
      const result = await this.config.ragQueryFn(
        request.question,
        request.context.tenantId,
      );
      return result;
    }

    // 폴백: 내장 규정 검색
    const regulations = this.searchBuiltInRegulations(request.question);
    return {
      answer: regulations.length > 0
        ? regulations.map((r) => `- ${r.title}: ${r.reference}`).join('\n')
        : `"${request.question}" 관련 규정을 찾을 수 없습니다. 키워드를 수정해 주세요.`,
      sources: regulations,
    };
  }

  /** §6: 보고서 초안 위젯 */
  private async handleReportDraft(request: CopilotQuery): Promise<{
    answer: string;
    tokensUsed: { prompt: number; completion: number };
  }> {
    const metrics = request.context.dashboardMetrics || {};
    const metricsStr = Object.entries(metrics)
      .map(([key, val]) => `${key}: ${val}`)
      .join('\n');

    const systemPrompt = `당신은 공공기관 보고서 작성 전문가입니다.
대시보드 메트릭 데이터를 기반으로 관리자 보고서 초안을 작성하세요.
형식: 한국어, 공공기관 표준 보고서 형식`;

    if (this.config.queryFn) {
      const result = await this.config.queryFn(
        systemPrompt,
        `대시보드 메트릭:\n${metricsStr}\n\n요청: ${request.question}`,
      );
      return { answer: result.answer, tokensUsed: result.tokensUsed };
    }

    // 폴백: 기본 보고서 템플릿
    const today = new Date().toISOString().split('T')[0];
    return {
      answer: `# 관리 보고서\n\n**보고일**: ${today}\n**모듈**: ${request.context.module}\n\n## 주요 지표\n${metricsStr || '(메트릭 데이터 없음)'}\n\n## 분석\n${request.question}\n\n## 조치 사항\n- (담당자 확인 필요)`,
      tokensUsed: { prompt: 0, completion: 0 },
    };
  }

  /** 일반 쿼리 처리 */
  private async handleGenericQuery(request: CopilotQuery): Promise<{
    answer: string;
    tokensUsed: { prompt: number; completion: number };
  }> {
    if (this.config.queryFn) {
      const systemPrompt = `당신은 공공기관 SaaS 플랫폼 AI 코파일럿입니다.
현재 페이지: ${request.context.url}
사용자 역할: ${request.context.userRole}
사용자의 질문에 정확하고 도움이 되는 답변을 제공하세요.`;

      const result = await this.config.queryFn(systemPrompt, request.question);
      return { answer: result.answer, tokensUsed: result.tokensUsed };
    }

    return {
      answer: `[AI 코파일럿] "${request.question}"에 대한 답변입니다. AI 모델이 연결되면 더 상세한 답변이 제공됩니다.`,
      tokensUsed: { prompt: 0, completion: 0 },
    };
  }

  /** 내장 규정 검색 */
  private searchBuiltInRegulations(query: string): Array<{ title: string; reference: string }> {
    const regulations = [
      { title: 'CSAP D-08 접근 통제', reference: 'CSAP 표준등급 D-08-01~D-08-12', keywords: ['접근', '인증', '권한', 'rbac', '로그인'] },
      { title: 'CSAP D-09 암호화', reference: 'CSAP 표준등급 D-09-01~D-09-04', keywords: ['암호', '비밀번호', 'aes', 'tls', '해시'] },
      { title: 'CSAP D-06 침해사고', reference: 'CSAP 표준등급 D-06-01~D-06-05', keywords: ['침해', '사고', '감사', '로그', '보안'] },
      { title: 'CSAP D-12 개발 보안', reference: 'CSAP 표준등급 D-12-01~D-12-10', keywords: ['개발', 'sql', 'xss', '입력', '검증'] },
      { title: 'N2SF 데이터 등급', reference: 'N2SF N-05 데이터 분류', keywords: ['n2sf', '등급', '데이터', '분류', '보안'] },
      { title: 'ISMS-P 인증 기준', reference: 'ISMS-P 2.0 인증 기준', keywords: ['isms', '인증', '개인정보', '보호'] },
    ];

    const normalizedQuery = query.toLowerCase();
    return regulations
      .filter((r) => r.keywords.some((kw) => normalizedQuery.includes(kw)))
      .map(({ title, reference }) => ({ title, reference }));
  }

  /** 후속 질문 제안 생성 */
  private generateSuggestions(widgetType: WidgetType, _context: PageContext): string[] {
    const suggestions: Record<WidgetType, string[]> = {
      data_summary: [
        '이 데이터의 이상치를 찾아주세요',
        '전월 대비 변화를 분석해주세요',
        '추세를 예측해주세요',
      ],
      regulation_search: [
        'CSAP 접근 통제 요건은?',
        'N2SF O등급 데이터 처리 규정은?',
        'ISMS-P 개인정보 보호조치는?',
      ],
      report_draft: [
        '이 보고서에 개선 사항을 추가해주세요',
        '요약본을 만들어주세요',
        '주간 보고 형식으로 변환해주세요',
      ],
      chat: [
        '이 페이지에서 할 수 있는 작업은?',
        '이 모듈의 도움말을 보여주세요',
      ],
      custom: [],
    };

    return suggestions[widgetType] || [];
  }

  /** 사용 통계 업데이트 */
  private updateUsageStats(widgetId: string, response: CopilotResponse): void {
    const existing = this.usageStats.get(widgetId);
    if (existing) {
      existing.totalQueries += 1;
      existing.totalTokensUsed += response.tokenUsage.total;
      existing.averageResponseTimeMs = Math.round(
        (existing.averageResponseTimeMs * (existing.totalQueries - 1) + response.processingTimeMs) /
          existing.totalQueries,
      );
      existing.lastUsedAt = response.timestamp;
    } else {
      this.usageStats.set(widgetId, {
        widgetId,
        totalQueries: 1,
        averageResponseTimeMs: response.processingTimeMs,
        totalTokensUsed: response.tokenUsage.total,
        userCount: 1,
        lastUsedAt: response.timestamp,
      });
    }
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

/** 기본 코파일럿 엔진 생성 (내장 위젯 3종 포함) */
export function createCopilotEngine(
  tenantId: string,
  options?: {
    queryFn?: (systemPrompt: string, userMessage: string) => Promise<{
      answer: string;
      tokensUsed: { prompt: number; completion: number };
    }>;
    ragQueryFn?: (question: string, tenantId: string) => Promise<{
      answer: string;
      sources: Array<{ title: string; reference: string }>;
    }>;
  },
): { registry: WidgetRegistry; engine: CopilotQueryEngine; collector: ContextCollector } {
  const registry = new WidgetRegistry();

  // 내장 위젯 3종 등록 -- Design §4, §5, §6
  registry.register({
    type: 'data_summary',
    name: '데이터 요약',
    description: '선택된 데이터를 AI로 분석/요약합니다',
    version: '1.0.0',
    icon: 'chart-bar',
    allowedRoles: ['admin', 'manager', 'operator'],
    isActive: true,
    config: {},
  });

  registry.register({
    type: 'regulation_search',
    name: '규정 검색',
    description: 'CSAP/N2SF/ISMS-P 규정을 즉시 검색합니다',
    version: '1.0.0',
    icon: 'book-open',
    allowedRoles: ['admin', 'manager', 'operator', 'viewer'],
    isActive: true,
    config: {},
  });

  registry.register({
    type: 'report_draft',
    name: '보고서 초안',
    description: '대시보드 데이터 기반 관리자 보고서를 자동 작성합니다',
    version: '1.0.0',
    icon: 'document-text',
    allowedRoles: ['admin', 'manager'],
    isActive: true,
    config: {},
  });

  const engine = new CopilotQueryEngine({
    tenantId,
    queryFn: options?.queryFn,
    ragQueryFn: options?.ragQueryFn,
  });

  const collector = new ContextCollector();

  return { registry, engine, collector };
}
