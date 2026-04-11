// MTU-N258 단위 테스트: AI 코파일럿 위젯 엔진
// Design Ref: MTU-N258 DESIGN §1~§7
// Plan SC: FR-N258.1~FR-N258.7
// CSAP: D-08 접근 통제, D-12 개발 보안
// N2SF: O등급 데이터만 AI API 전송

import { describe, it, expect, beforeEach } from 'vitest';

import {
  WidgetRegistry,
  ContextCollector,
  CopilotQueryEngine,
  createCopilotEngine,
  type WidgetDefinition,
  type CopilotQuery,
  type PageContext,
} from '../../src/lib/copilot-widget-engine.js';

// -- 헬퍼 ──────────────────────────────────────────────────────────────────

function makePageContext(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: '/dashboard/overview',
    module: 'dashboard',
    subModule: 'overview',
    userRole: 'admin',
    userId: 'user-1',
    tenantId: 'tenant-A',
    locale: 'ko-KR',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// -- WidgetRegistry -- Design §1 ────────────────────────────────────────────

describe('WidgetRegistry (FR-N258.1)', () => {
  let registry: WidgetRegistry;

  beforeEach(() => {
    registry = new WidgetRegistry();
  });

  it('위젯을 등록한다', () => {
    const widget = registry.register({
      type: 'data_summary',
      name: '데이터 요약',
      description: '데이터 분석 위젯',
      version: '1.0.0',
      icon: 'chart',
      allowedRoles: ['admin', 'manager'],
      isActive: true,
      config: {},
    });
    expect(widget.id).toBeTruthy();
    expect(widget.name).toBe('데이터 요약');
    expect(widget.createdAt).toBeTruthy();
    expect(registry.size()).toBe(1);
  });

  it('위젯을 해제한다', () => {
    const widget = registry.register({
      type: 'chat',
      name: '채팅',
      description: '일반 채팅',
      version: '1.0.0',
      icon: 'chat',
      allowedRoles: ['admin'],
      isActive: true,
      config: {},
    });
    expect(registry.unregister(widget.id)).toBe(true);
    expect(registry.size()).toBe(0);
  });

  it('존재하지 않는 위젯 해제 시 false', () => {
    expect(registry.unregister('nonexistent')).toBe(false);
  });

  it('ID로 위젯을 조회한다', () => {
    const widget = registry.register({
      type: 'chat',
      name: '테스트',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: true,
      config: {},
    });
    expect(registry.get(widget.id)).toBeDefined();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('타입별 위젯을 검색한다', () => {
    registry.register({
      type: 'data_summary',
      name: 'DS-1',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: true,
      config: {},
    });
    registry.register({
      type: 'chat',
      name: 'Chat-1',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: true,
      config: {},
    });
    registry.register({
      type: 'data_summary',
      name: 'DS-2',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: true,
      config: {},
    });

    const summaries = registry.findByType('data_summary');
    expect(summaries).toHaveLength(2);
    const chats = registry.findByType('chat');
    expect(chats).toHaveLength(1);
  });

  it('역할 기반 접근 가능한 위젯을 반환한다 (CSAP D-08)', () => {
    registry.register({
      type: 'data_summary',
      name: 'Admin Only',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: true,
      config: {},
    });
    registry.register({
      type: 'chat',
      name: 'All Users',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin', 'manager', 'operator', 'viewer'],
      isActive: true,
      config: {},
    });

    const viewerAccess = registry.getAccessible('viewer');
    expect(viewerAccess).toHaveLength(1);
    expect(viewerAccess[0]!.name).toBe('All Users');

    const adminAccess = registry.getAccessible('admin');
    expect(adminAccess).toHaveLength(2);
  });

  it('비활성 위젯은 접근 불가 목록에서 제외한다', () => {
    const widget = registry.register({
      type: 'chat',
      name: '비활성',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: false,
      config: {},
    });
    expect(registry.getAccessible('admin')).toHaveLength(0);
    expect(registry.getActive()).toHaveLength(0);

    // 활성화
    registry.setActive(widget.id, true);
    expect(registry.getAccessible('admin')).toHaveLength(1);
    expect(registry.getActive()).toHaveLength(1);
  });

  it('존재하지 않는 위젯 setActive는 false', () => {
    expect(registry.setActive('nonexistent', true)).toBe(false);
  });

  it('전체 위젯 목록을 반환한다', () => {
    registry.register({
      type: 'chat',
      name: 'A',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: true,
      config: {},
    });
    registry.register({
      type: 'custom',
      name: 'B',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: true,
      config: {},
    });
    expect(registry.getAll()).toHaveLength(2);
  });
});

// -- ContextCollector -- Design §2 ──────────────────────────────────────────

describe('ContextCollector (FR-N258.2)', () => {
  let collector: ContextCollector;

  beforeEach(() => {
    collector = new ContextCollector();
  });

  it('URL에서 모듈을 추출한다', () => {
    const ctx = collector.collect({
      url: '/dashboard/overview',
      userRole: 'admin',
      userId: 'user-1',
      tenantId: 'tenant-A',
    });
    expect(ctx.module).toBe('dashboard');
    expect(ctx.subModule).toBe('overview');
  });

  it('루트 URL은 home 모듈', () => {
    const ctx = collector.collect({
      url: '/',
      userRole: 'viewer',
      userId: 'user-1',
      tenantId: 'tenant-A',
    });
    expect(ctx.module).toBe('home');
    expect(ctx.subModule).toBeUndefined();
  });

  it('선택 데이터를 포함한다', () => {
    const ctx = collector.collect({
      url: '/reports/monthly',
      userRole: 'manager',
      userId: 'user-1',
      tenantId: 'tenant-A',
      selectedData: { total: 100, pending: 5 },
    });
    expect(ctx.selectedData).toEqual({ total: 100, pending: 5 });
  });

  it('대시보드 메트릭을 포함한다', () => {
    const ctx = collector.collect({
      url: '/dashboard',
      userRole: 'admin',
      userId: 'user-1',
      tenantId: 'tenant-A',
      dashboardMetrics: { cpu: 45, memory: '78%' },
    });
    expect(ctx.dashboardMetrics).toEqual({ cpu: 45, memory: '78%' });
  });

  it('항상 ko-KR 로케일로 설정한다', () => {
    const ctx = collector.collect({
      url: '/any',
      userRole: 'operator',
      userId: 'user-1',
      tenantId: 'tenant-A',
    });
    expect(ctx.locale).toBe('ko-KR');
  });
});

// -- CopilotQueryEngine -- Design §3 ──────────────────────────────────────

describe('CopilotQueryEngine (FR-N258.3)', () => {
  let registry: WidgetRegistry;
  let engine: CopilotQueryEngine;
  let dataSummaryId: string;
  let regulationSearchId: string;
  let reportDraftId: string;
  let chatId: string;

  beforeEach(() => {
    registry = new WidgetRegistry();

    const ds = registry.register({
      type: 'data_summary',
      name: '데이터 요약',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin', 'manager', 'operator'],
      isActive: true,
      config: {},
    });
    dataSummaryId = ds.id;

    const rs = registry.register({
      type: 'regulation_search',
      name: '규정 검색',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin', 'manager', 'operator', 'viewer'],
      isActive: true,
      config: {},
    });
    regulationSearchId = rs.id;

    const rd = registry.register({
      type: 'report_draft',
      name: '보고서 초안',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin', 'manager'],
      isActive: true,
      config: {},
    });
    reportDraftId = rd.id;

    const ch = registry.register({
      type: 'chat',
      name: '일반 채팅',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: true,
      config: {},
    });
    chatId = ch.id;

    engine = new CopilotQueryEngine({ tenantId: 'tenant-A' });
  });

  it('데이터 요약 위젯을 처리한다 (폴백)', async () => {
    const response = await engine.query(registry, {
      widgetId: dataSummaryId,
      question: '이 데이터를 요약해주세요',
      context: makePageContext({
        selectedData: { items: 10, total: 500 },
      }),
    });
    expect(response.answer).toContain('데이터 요약');
    expect(response.widgetId).toBe(dataSummaryId);
    expect(response.format).toBe('markdown');
  });

  it('규정 검색 위젯을 처리한다 (내장 검색)', async () => {
    const response = await engine.query(registry, {
      widgetId: regulationSearchId,
      question: 'CSAP 접근 통제 요건',
      context: makePageContext(),
    });
    expect(response.answer).toContain('D-08');
  });

  it('규정 검색에서 매칭 없으면 안내 메시지', async () => {
    const response = await engine.query(registry, {
      widgetId: regulationSearchId,
      question: '매칭되지않는완전무관한쿼리',
      context: makePageContext(),
    });
    expect(response.answer).toContain('찾을 수 없습니다');
  });

  it('보고서 초안 위젯을 처리한다 (폴백)', async () => {
    const response = await engine.query(registry, {
      widgetId: reportDraftId,
      question: '월간 보고서를 작성해주세요',
      context: makePageContext({
        dashboardMetrics: { cpu: 45, memory: 78, requests: 1200 },
      }),
    });
    expect(response.answer).toContain('관리 보고서');
    expect(response.answer).toContain('cpu');
  });

  it('일반 쿼리 위젯을 처리한다 (폴백)', async () => {
    const response = await engine.query(registry, {
      widgetId: chatId,
      question: '안녕하세요',
      context: makePageContext(),
    });
    expect(response.answer).toContain('AI 코파일럿');
  });

  it('queryFn이 제공되면 LLM을 사용한다', async () => {
    const engineWithLLM = new CopilotQueryEngine({
      tenantId: 'tenant-A',
      queryFn: async (systemPrompt, userMessage) => ({
        answer: `LLM 응답: ${userMessage.slice(0, 20)}`,
        tokensUsed: { prompt: 50, completion: 30 },
      }),
    });

    const response = await engineWithLLM.query(registry, {
      widgetId: dataSummaryId,
      question: '요약해주세요',
      context: makePageContext(),
    });
    expect(response.answer).toContain('LLM 응답');
    expect(response.tokenUsage.total).toBe(80);
  });

  it('ragQueryFn이 제공되면 RAG를 사용한다', async () => {
    const engineWithRAG = new CopilotQueryEngine({
      tenantId: 'tenant-A',
      ragQueryFn: async (question) => ({
        answer: `RAG 검색 결과: ${question}`,
        sources: [{ title: 'CSAP 가이드', reference: 'D-08-01' }],
      }),
    });

    const response = await engineWithRAG.query(registry, {
      widgetId: regulationSearchId,
      question: '접근 통제 규정',
      context: makePageContext(),
    });
    expect(response.answer).toContain('RAG 검색 결과');
    expect(response.sources).toHaveLength(1);
  });
});

// -- 보안 검증 -- CSAP D-08 ──────────────────────────────────────────────

describe('CopilotQueryEngine 보안 (CSAP D-08)', () => {
  let registry: WidgetRegistry;
  let engine: CopilotQueryEngine;

  beforeEach(() => {
    registry = new WidgetRegistry();
    engine = new CopilotQueryEngine({ tenantId: 'tenant-A' });
  });

  it('존재하지 않는 위젯은 에러', async () => {
    await expect(
      engine.query(registry, {
        widgetId: 'nonexistent',
        question: '질문',
        context: makePageContext(),
      }),
    ).rejects.toThrow('위젯을 찾을 수 없습니다');
  });

  it('비활성 위젯은 에러', async () => {
    const widget = registry.register({
      type: 'chat',
      name: '비활성',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: false,
      config: {},
    });

    await expect(
      engine.query(registry, {
        widgetId: widget.id,
        question: '질문',
        context: makePageContext(),
      }),
    ).rejects.toThrow('비활성화된 위젯');
  });

  it('권한 부족 시 에러 (RBAC)', async () => {
    const widget = registry.register({
      type: 'report_draft',
      name: '관리자 전용',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: true,
      config: {},
    });

    await expect(
      engine.query(registry, {
        widgetId: widget.id,
        question: '질문',
        context: makePageContext({ userRole: 'viewer' }),
      }),
    ).rejects.toThrow('[SECURITY] 권한 부족');
  });

  it('테넌트 불일치 시 에러', async () => {
    const widget = registry.register({
      type: 'chat',
      name: '테스트',
      description: '',
      version: '1.0.0',
      icon: '',
      allowedRoles: ['admin'],
      isActive: true,
      config: {},
    });

    await expect(
      engine.query(registry, {
        widgetId: widget.id,
        question: '질문',
        context: makePageContext({ tenantId: 'tenant-B' }),
      }),
    ).rejects.toThrow('[SECURITY] 테넌트 불일치');
  });
});

// -- 사용 통계 ─────────────────────────────────────────────────────────────

describe('CopilotQueryEngine 사용 통계 (FR-N258.7)', () => {
  it('쿼리 후 사용 통계가 업데이트된다', async () => {
    const { registry, engine } = createCopilotEngine('tenant-A');
    const widgets = registry.getAll();
    const dsWidget = widgets.find((w) => w.type === 'data_summary')!;

    await engine.query(registry, {
      widgetId: dsWidget.id,
      question: '요약해주세요',
      context: makePageContext(),
    });

    const stats = engine.getUsageStats(dsWidget.id);
    expect(stats).toHaveLength(1);
    expect(stats[0]!.totalQueries).toBe(1);
  });

  it('여러 쿼리 후 통계가 누적된다', async () => {
    const { registry, engine } = createCopilotEngine('tenant-A');
    const widgets = registry.getAll();
    const dsWidget = widgets.find((w) => w.type === 'data_summary')!;

    await engine.query(registry, {
      widgetId: dsWidget.id,
      question: '1번째',
      context: makePageContext(),
    });
    await engine.query(registry, {
      widgetId: dsWidget.id,
      question: '2번째',
      context: makePageContext(),
    });

    const stats = engine.getUsageStats(dsWidget.id);
    expect(stats[0]!.totalQueries).toBe(2);
  });

  it('전체 위젯 사용 통계를 조회한다', async () => {
    const { registry, engine } = createCopilotEngine('tenant-A');
    const widgets = registry.getAll();

    // 각 위젯 유형에 1번씩 쿼리 (역할에 맞게)
    for (const w of widgets) {
      await engine.query(registry, {
        widgetId: w.id,
        question: '테스트',
        context: makePageContext({ userRole: 'admin' }),
      });
    }

    const allStats = engine.getUsageStats();
    expect(allStats.length).toBe(widgets.length);
  });

  it('쿼리 이력을 조회한다', async () => {
    const { registry, engine } = createCopilotEngine('tenant-A');
    const widgets = registry.getAll();
    const dsWidget = widgets.find((w) => w.type === 'data_summary')!;

    await engine.query(registry, {
      widgetId: dsWidget.id,
      question: '요약',
      context: makePageContext(),
    });

    const history = engine.getQueryHistory();
    expect(history).toHaveLength(1);
    expect(history[0]!.answer).toBeTruthy();
  });
});

// -- 후속 질문 제안 ─────────────────────────────────────────────────────────

describe('CopilotQueryEngine 후속 질문 (FR-N258.6)', () => {
  it('위젯 타입에 따라 후속 질문을 제안한다', async () => {
    const { registry, engine } = createCopilotEngine('tenant-A');
    const widgets = registry.getAll();
    const dsWidget = widgets.find((w) => w.type === 'data_summary')!;

    const response = await engine.query(registry, {
      widgetId: dsWidget.id,
      question: '요약',
      context: makePageContext(),
    });
    expect(response.suggestions).toBeDefined();
    expect(response.suggestions!.length).toBeGreaterThan(0);
  });
});

// -- createCopilotEngine 팩토리 ──────────────────────────────────────────────

describe('createCopilotEngine (팩토리)', () => {
  it('내장 위젯 3종이 등록된다', () => {
    const { registry } = createCopilotEngine('tenant-A');
    expect(registry.size()).toBe(3);
    expect(registry.findByType('data_summary')).toHaveLength(1);
    expect(registry.findByType('regulation_search')).toHaveLength(1);
    expect(registry.findByType('report_draft')).toHaveLength(1);
  });

  it('컨텍스트 수집기를 포함한다', () => {
    const { collector } = createCopilotEngine('tenant-A');
    expect(collector).toBeInstanceOf(ContextCollector);
  });

  it('queryFn 옵션이 적용된다', async () => {
    const { registry, engine } = createCopilotEngine('tenant-A', {
      queryFn: async () => ({
        answer: '커스텀 LLM 응답',
        tokensUsed: { prompt: 10, completion: 20 },
      }),
    });
    const widgets = registry.getAll();
    const dsWidget = widgets.find((w) => w.type === 'data_summary')!;

    const response = await engine.query(registry, {
      widgetId: dsWidget.id,
      question: '테스트',
      context: makePageContext(),
    });
    expect(response.answer).toBe('커스텀 LLM 응답');
  });
});
