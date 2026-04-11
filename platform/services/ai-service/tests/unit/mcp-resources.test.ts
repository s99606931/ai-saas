// SVC-AI-ADV-R7 단위 테스트: MCP 리소스 프로바이더
// Design Ref: SVC-AI-ADV-R7 DESIGN §2
// Plan SC: FR-ADV7.2
// CSAP: D-12

import { describe, it, expect, vi } from 'vitest';
import {
  PublicSaaSResourceProvider,
  createPublicSaaSResourceProvider,
} from '../../src/lib/mcp-resources.js';
import type {
  StatuteRepository,
  OfficialDocRepository,
  AdminCodeRepository,
  CSAPControlRepository,
} from '../../src/lib/mcp-resources.js';

// ── 모의 저장소 ─────────────────────────────────────────────────────────────

const mockStatuteRepo: StatuteRepository = {
  findAll: vi.fn().mockResolvedValue([
    { id: 'act-001', title: '개인정보보호법', lastUpdated: '2026-03-15' },
    { id: 'act-002', title: '전자정부법', lastUpdated: '2025-12-01' },
  ]),
  findById: vi.fn().mockImplementation(async (id: string) => {
    if (id === 'act-001') {
      return { id: 'act-001', title: '개인정보보호법', content: '제1조 (목적) ...', lastUpdated: '2026-03-15' };
    }
    return null;
  }),
};

const mockOfficialDocRepo: OfficialDocRepository = {
  findAll: vi.fn().mockResolvedValue([
    { type: 'cooperation', title: '업무협조전' },
    { type: 'notice', title: '공고문' },
  ]),
  findByType: vi.fn().mockImplementation(async (type: string) => {
    if (type === 'cooperation') {
      return { type: 'cooperation', title: '업무협조전', htmlTemplate: '<html>...</html>' };
    }
    return null;
  }),
};

const mockAdminCodeRepo: AdminCodeRepository = {
  findAll: vi.fn().mockResolvedValue([
    { code: '1100000000', name: '서울특별시' },
  ]),
  findByCode: vi.fn().mockImplementation(async (code: string) => {
    if (code === '1100000000') {
      return { code: '1100000000', name: '서울특별시', level: 1 };
    }
    return null;
  }),
};

const mockCSAPControlRepo: CSAPControlRepository = {
  findAll: vi.fn().mockResolvedValue([
    { controlId: 'D-08', title: '접근 통제', category: '보안' },
  ]),
  findByControlId: vi.fn().mockImplementation(async (controlId: string) => {
    if (controlId === 'D-08') {
      return { controlId: 'D-08', title: '접근 통제', description: '접근 권한 관리...', category: '보안' };
    }
    return null;
  }),
};

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe('PublicSaaSResourceProvider 리소스 목록', () => {
  it('모든 저장소의 리소스를 집합하여 반환한다', async () => {
    const provider = new PublicSaaSResourceProvider({
      statutes: mockStatuteRepo,
      officialDocs: mockOfficialDocRepo,
      adminCodes: mockAdminCodeRepo,
      csapControls: mockCSAPControlRepo,
    });

    const resources = await provider.list();
    // 법령 2 + 공문서 2 + 행정코드 1 + CSAP 1 = 6
    expect(resources).toHaveLength(6);
  });

  it('법령 리소스의 URI가 law:// 스킴이다', async () => {
    const provider = new PublicSaaSResourceProvider({ statutes: mockStatuteRepo });
    const resources = await provider.list();
    expect(resources[0]?.uri).toMatch(/^law:\/\/statutes\//);
  });

  it('공문서 양식의 URI가 template:// 스킴이다', async () => {
    const provider = new PublicSaaSResourceProvider({ officialDocs: mockOfficialDocRepo });
    const resources = await provider.list();
    expect(resources[0]?.uri).toMatch(/^template:\/\/official-docs\//);
  });

  it('행정구역 코드의 URI가 data:// 스킴이다', async () => {
    const provider = new PublicSaaSResourceProvider({ adminCodes: mockAdminCodeRepo });
    const resources = await provider.list();
    expect(resources[0]?.uri).toMatch(/^data:\/\/admin-codes\//);
  });

  it('CSAP 통제항목의 URI가 policy:// 스킴이다', async () => {
    const provider = new PublicSaaSResourceProvider({ csapControls: mockCSAPControlRepo });
    const resources = await provider.list();
    expect(resources[0]?.uri).toMatch(/^policy:\/\/csap\//);
  });

  it('저장소가 없으면 빈 배열을 반환한다', async () => {
    const provider = new PublicSaaSResourceProvider({});
    const resources = await provider.list();
    expect(resources).toHaveLength(0);
  });

  it('리소스에 uri, name, description, mimeType이 포함된다', async () => {
    const provider = new PublicSaaSResourceProvider({ statutes: mockStatuteRepo });
    const resources = await provider.list();
    const resource = resources[0]!;
    expect(resource.uri).toBeDefined();
    expect(resource.name).toBeDefined();
    expect(resource.description).toBeDefined();
    expect(resource.mimeType).toBeDefined();
  });
});

describe('PublicSaaSResourceProvider 리소스 읽기', () => {
  const provider = new PublicSaaSResourceProvider({
    statutes: mockStatuteRepo,
    officialDocs: mockOfficialDocRepo,
    adminCodes: mockAdminCodeRepo,
    csapControls: mockCSAPControlRepo,
  });

  it('법령 리소스를 읽는다', async () => {
    const result = await provider.read('law://statutes/act-001');
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]?.text).toContain('개인정보보호법');
    expect(result.contents[0]?.mimeType).toBe('text/plain');
  });

  it('공문서 양식을 읽는다', async () => {
    const result = await provider.read('template://official-docs/cooperation');
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]?.text).toContain('<html>');
    expect(result.contents[0]?.mimeType).toBe('text/html');
  });

  it('행정구역 코드를 읽는다', async () => {
    const result = await provider.read('data://admin-codes/1100000000');
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]?.text).toContain('서울특별시');
    expect(result.contents[0]?.mimeType).toBe('application/json');
  });

  it('CSAP 통제항목을 읽는다', async () => {
    const result = await provider.read('policy://csap/D-08');
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]?.text).toContain('접근 통제');
    expect(result.contents[0]?.mimeType).toBe('text/markdown');
  });

  it('지원하지 않는 URI 스킴은 에러를 발생한다', async () => {
    await expect(provider.read('unknown://test/123')).rejects.toThrow('지원하지 않는 리소스 스킴');
  });

  it('잘못된 URI 형식은 에러를 발생한다', async () => {
    await expect(provider.read('not-a-valid-uri')).rejects.toThrow('지원하지 않는 리소스 URI');
  });

  it('존재하지 않는 법령은 에러를 발생한다', async () => {
    await expect(provider.read('law://statutes/nonexistent')).rejects.toThrow('법령을 찾을 수 없습니다');
  });

  it('존재하지 않는 공문서 양식은 에러를 발생한다', async () => {
    await expect(provider.read('template://official-docs/nonexistent')).rejects.toThrow('공문서 양식을 찾을 수 없습니다');
  });

  it('법령 프로바이더 없이 법령을 읽으면 에러를 발생한다', async () => {
    const emptyProvider = new PublicSaaSResourceProvider({});
    await expect(emptyProvider.read('law://statutes/act-001')).rejects.toThrow('법령 리소스 프로바이더 미설정');
  });
});

describe('createPublicSaaSResourceProvider 팩토리', () => {
  it('MCPResourceProvider 구현체를 반환한다', () => {
    const provider = createPublicSaaSResourceProvider({});
    expect(provider.list).toBeDefined();
    expect(provider.read).toBeDefined();
  });
});
