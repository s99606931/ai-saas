// SVC-AI-ADV-R7 단위 테스트: MCP 공공기관 도메인 도구
// Design Ref: SVC-AI-ADV-R7 DESIGN §3, §6
// Plan SC: FR-ADV7.3, FR-ADV7.6
// CSAP: D-12, D-08

import { describe, it, expect, vi } from 'vitest';

// maskPII 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import { createPublicSaaSTools } from '../../src/lib/mcp-tools.js';
import type {
  MCPToolRepositories,
  StatuteSearchRepository,
  OfficialDocGeneratorRepository,
  AdminDBRepository,
  CSAPComplianceRepository,
  FeeCalculatorRepository,
} from '../../src/lib/mcp-tools.js';

// ── 모의 저장소 ─────────────────────────────────────────────────────────────

const mockStatuteRepo: StatuteSearchRepository = {
  search: vi.fn().mockResolvedValue([
    { id: 'act-001', title: '개인정보보호법', snippet: '제1조 (목적)...', relevanceScore: 0.95 },
    { id: 'act-002', title: '전자정부법', snippet: '제1조 (목적)...', relevanceScore: 0.85 },
  ]),
};

const mockOfficialDocRepo: OfficialDocGeneratorRepository = {
  generate: vi.fn().mockResolvedValue({
    documentId: 'doc-001',
    title: '업무협조 요청',
    content: '수신: 관련부서...',
    createdAt: '2026-04-11',
  }),
};

const mockAdminDBRepo: AdminDBRepository = {
  query: vi.fn().mockResolvedValue({
    rows: [{ code: '1100000000', name: '서울특별시' }],
    totalCount: 1,
  }),
  getAllowedTables: vi.fn().mockReturnValue(['admin_codes', 'organizations']),
};

const mockCSAPRepo: CSAPComplianceRepository = {
  checkControls: vi.fn().mockResolvedValue([
    { controlId: 'D-08', status: 'compliant', details: '접근 통제 준수', lastChecked: '2026-04-11' },
    { controlId: 'D-09', status: 'non_compliant', details: '암호화 미적용', lastChecked: '2026-04-11' },
  ]),
};

const mockFeeRepo: FeeCalculatorRepository = {
  calculate: vi.fn().mockResolvedValue({
    feeType: '등기수수료',
    baseAmount: 1000000,
    calculatedFee: 15000,
    formula: '기본 15,000원',
    effectiveDate: '2026-01-01',
  }),
  getSupportedTypes: vi.fn().mockReturnValue(['등기수수료', '인지대', '송달료']),
};

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe('createPublicSaaSTools 도구 생성', () => {
  it('모든 저장소가 제공되면 5개 도구를 생성한다', () => {
    const repos: MCPToolRepositories = {
      statutes: mockStatuteRepo,
      officialDocs: mockOfficialDocRepo,
      adminDB: mockAdminDBRepo,
      csapCompliance: mockCSAPRepo,
      feeCalculator: mockFeeRepo,
    };
    const tools = createPublicSaaSTools(repos);
    expect(tools).toHaveLength(5);
  });

  it('저장소가 없으면 빈 배열을 반환한다', () => {
    const tools = createPublicSaaSTools({});
    expect(tools).toHaveLength(0);
  });

  it('일부 저장소만 제공하면 해당 도구만 생성한다', () => {
    const tools = createPublicSaaSTools({ statutes: mockStatuteRepo });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('search_statute');
  });

  it('생성된 도구에 name, description, inputSchema, requiredPermission, handler가 있다', () => {
    const tools = createPublicSaaSTools({ statutes: mockStatuteRepo });
    const tool = tools[0]!;
    expect(tool.name).toBeDefined();
    expect(tool.description).toBeDefined();
    expect(tool.inputSchema).toBeDefined();
    expect(tool.requiredPermission).toBeDefined();
    expect(tool.handler).toBeDefined();
  });
});

describe('도구 1: 법령 검색 (search_statute)', () => {
  it('검색 결과를 포맷하여 반환한다', async () => {
    const tools = createPublicSaaSTools({ statutes: mockStatuteRepo });
    const tool = tools[0]!;
    const result = await tool.handler({ query: '개인정보', limit: 10 }, {} as never);
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('개인정보보호법');
    expect(result.content[0]?.text).toContain('2건');
  });

  it('검색 결과가 없으면 안내 메시지를 반환한다', async () => {
    const emptyRepo: StatuteSearchRepository = {
      search: vi.fn().mockResolvedValue([]),
    };
    const tools = createPublicSaaSTools({ statutes: emptyRepo });
    const result = await tools[0]!.handler({ query: '없는법령', limit: 10 }, {} as never);
    expect(result.content[0]?.text).toContain('검색 결과가 없습니다');
  });

  it('저장소 오류 시 에러 결과를 반환한다', async () => {
    const errorRepo: StatuteSearchRepository = {
      search: vi.fn().mockRejectedValue(new Error('DB 연결 실패')),
    };
    const tools = createPublicSaaSTools({ statutes: errorRepo });
    const result = await tools[0]!.handler({ query: '테스트', limit: 10 }, {} as never);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('DB 연결 실패');
  });

  it('requiredPermission이 mcp:statute:search다', () => {
    const tools = createPublicSaaSTools({ statutes: mockStatuteRepo });
    expect(tools[0]?.requiredPermission).toBe('mcp:statute:search');
  });
});

describe('도구 2: 공문서 생성 (generate_official_doc)', () => {
  it('공문서를 생성하여 반환한다', async () => {
    const tools = createPublicSaaSTools({ officialDocs: mockOfficialDocRepo });
    const tool = tools[0]!;
    const result = await tool.handler(
      { type: 'cooperation', params: { receiver: '관련부서' } },
      {} as never,
    );
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('doc-001');
    expect(result.content[0]?.text).toContain('업무협조 요청');
  });

  it('requiredPermission이 mcp:officialdoc:generate다', () => {
    const tools = createPublicSaaSTools({ officialDocs: mockOfficialDocRepo });
    expect(tools[0]?.requiredPermission).toBe('mcp:officialdoc:generate');
  });
});

describe('도구 3: 행정 DB 조회 (query_admin_db)', () => {
  it('허용된 테이블을 조회한다', async () => {
    const tools = createPublicSaaSTools({ adminDB: mockAdminDBRepo });
    const tool = tools[0]!;
    const result = await tool.handler(
      { table: 'admin_codes', filter: { code: '1100000000' }, limit: 20 },
      {} as never,
    );
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('서울특별시');
  });

  it('허용되지 않은 테이블은 차단한다 (CSAP D-12)', async () => {
    const tools = createPublicSaaSTools({ adminDB: mockAdminDBRepo });
    const tool = tools[0]!;
    const result = await tool.handler(
      { table: 'users_secrets', filter: {}, limit: 20 },
      {} as never,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('허용되지 않은 테이블');
  });

  it('requiredPermission이 mcp:admindb:query다', () => {
    const tools = createPublicSaaSTools({ adminDB: mockAdminDBRepo });
    expect(tools[0]?.requiredPermission).toBe('mcp:admindb:query');
  });
});

describe('도구 4: CSAP 준수 확인 (check_csap_compliance)', () => {
  it('CSAP 통제항목 준수 현황을 반환한다', async () => {
    const tools = createPublicSaaSTools({ csapCompliance: mockCSAPRepo });
    const tool = tools[0]!;
    const result = await tool.handler(
      { controlIds: ['D-08', 'D-09'] },
      {} as never,
    );
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('1/2 준수');
    expect(result.content[0]?.text).toContain('[준수]');
    expect(result.content[0]?.text).toContain('[미준수]');
  });

  it('requiredPermission이 mcp:csap:check다', () => {
    const tools = createPublicSaaSTools({ csapCompliance: mockCSAPRepo });
    expect(tools[0]?.requiredPermission).toBe('mcp:csap:check');
  });
});

describe('도구 5: 수수료 계산 (calculate_fee)', () => {
  it('수수료를 계산하여 반환한다', async () => {
    const tools = createPublicSaaSTools({ feeCalculator: mockFeeRepo });
    const tool = tools[0]!;
    const result = await tool.handler(
      { type: '등기수수료', amount: 1000000 },
      {} as never,
    );
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('15,000');
    expect(result.content[0]?.text).toContain('등기수수료');
  });

  it('지원하지 않는 유형은 에러를 반환한다', async () => {
    const tools = createPublicSaaSTools({ feeCalculator: mockFeeRepo });
    const tool = tools[0]!;
    const result = await tool.handler(
      { type: '존재하지않는유형', amount: 1000 },
      {} as never,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('지원하지 않는 수수료 유형');
  });

  it('requiredPermission이 mcp:fee:calculate다', () => {
    const tools = createPublicSaaSTools({ feeCalculator: mockFeeRepo });
    expect(tools[0]?.requiredPermission).toBe('mcp:fee:calculate');
  });
});
