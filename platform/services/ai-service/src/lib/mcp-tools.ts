// MCP 공공기관 도메인 도구 — FR-ADV7.3, FR-ADV7.6
// Design Ref: SVC-AI-ADV-R7 DESIGN §3, §6
// Plan SC: SC-2 (Tools 구현), SC-6 (입력 검증)
// CSAP: D-12 시스템 개발 보안 (Zod 검증), D-08 접근 통제 (RBAC)
// N2SF: N-05 O등급 데이터만 처리

import { z } from 'zod';
import type { MCPToolDefinition, MCPToolResult } from './mcp-server.js';
import { maskPII } from './pii-masking.js';

// ── 도구 결과 헬퍼 ──────────────────────────────────────────────────────────

/** 성공 결과 생성 */
function toolSuccess(text: string): MCPToolResult {
  return { content: [{ type: 'text', text }] };
}

/** 에러 결과 생성 */
function toolError(message: string): MCPToolResult {
  return { content: [{ type: 'text', text: `오류: ${message}` }], isError: true };
}

// ── 저장소 인터페이스 (DIP — 의존성 역전) ────────────────────────────────────

/** 법령 검색 저장소 */
export interface StatuteSearchRepository {
  search(query: string, limit: number): Promise<Array<{
    id: string;
    title: string;
    snippet: string;
    relevanceScore: number;
  }>>;
}

/** 공문서 생성 저장소 */
export interface OfficialDocGeneratorRepository {
  generate(type: string, params: Record<string, string>): Promise<{
    documentId: string;
    title: string;
    content: string;
    createdAt: string;
  }>;
}

/** 행정 DB 조회 저장소 (읽기 전용) */
export interface AdminDBRepository {
  query(table: string, filter: Record<string, string>, limit: number): Promise<{
    rows: Record<string, unknown>[];
    totalCount: number;
  }>;
  /** 허용된 테이블 목록 (화이트리스트) */
  getAllowedTables(): string[];
}

/** CSAP 준수 확인 저장소 */
export interface CSAPComplianceRepository {
  checkControls(controlIds: string[]): Promise<Array<{
    controlId: string;
    status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
    details: string;
    lastChecked: string;
  }>>;
}

/** 수수료 계산 저장소 */
export interface FeeCalculatorRepository {
  calculate(type: string, amount: number, options?: Record<string, unknown>): Promise<{
    feeType: string;
    baseAmount: number;
    calculatedFee: number;
    formula: string;
    effectiveDate: string;
  }>;
  getSupportedTypes(): string[];
}

// ── 도구 의존성 설정 ─────────────────────────────────────────────────────────

/** MCP 도구 생성에 필요한 저장소들 */
export interface MCPToolRepositories {
  statutes?: StatuteSearchRepository;
  officialDocs?: OfficialDocGeneratorRepository;
  adminDB?: AdminDBRepository;
  csapCompliance?: CSAPComplianceRepository;
  feeCalculator?: FeeCalculatorRepository;
}

// ── 도구 1: 법령 검색 — Design §3.1 ─────────────────────────────────────────

const searchStatuteSchema = z.object({
  /** 검색 키워드 */
  query: z.string().min(1).max(500).describe('법령 검색 키워드'),
  /** 결과 제한 수 (기본 10) */
  limit: z.number().int().min(1).max(50).optional().default(10),
});

function createSearchStatuteTool(repo: StatuteSearchRepository): MCPToolDefinition {
  return {
    name: 'search_statute',
    description: '법령 키워드 검색. 법률, 시행령, 시행규칙, 고시 등을 키워드로 검색합니다. 결과는 관련도 순으로 정렬됩니다.',
    inputSchema: searchStatuteSchema,
    requiredPermission: 'mcp:statute:search',
    handler: async (input: unknown): Promise<MCPToolResult> => {
      const params = input as z.infer<typeof searchStatuteSchema>;
      try {
        const results = await repo.search(params.query, params.limit);

        if (results.length === 0) {
          return toolSuccess(`"${params.query}"에 대한 법령 검색 결과가 없습니다.`);
        }

        const formatted = results.map((r, i) =>
          `${i + 1}. **${r.title}** (ID: ${r.id}, 관련도: ${(r.relevanceScore * 100).toFixed(1)}%)\n   ${r.snippet}`,
        ).join('\n\n');

        return toolSuccess(`"${params.query}" 법령 검색 결과 (${results.length}건):\n\n${formatted}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '법령 검색 중 오류 발생';
        return toolError(message);
      }
    },
  };
}

// ── 도구 2: 공문서 생성 — Design §3.1 ───────────────────────────────────────

const generateOfficialDocSchema = z.object({
  /** 공문서 유형 */
  type: z.enum(['cooperation', 'notice', 'report', 'meeting', 'approval']).describe('공문서 유형'),
  /** 생성 파라미터 */
  params: z.record(z.string()).describe('공문서 생성 파라미터 (수신자, 제목, 내용 등)'),
});

function createGenerateOfficialDocTool(repo: OfficialDocGeneratorRepository): MCPToolDefinition {
  return {
    name: 'generate_official_doc',
    description: '공문서 초안을 생성합니다. 협조전, 공고문, 보고서, 회의록, 결재문서 유형을 지원합니다.',
    inputSchema: generateOfficialDocSchema,
    requiredPermission: 'mcp:officialdoc:generate',
    handler: async (input: unknown): Promise<MCPToolResult> => {
      const params = input as z.infer<typeof generateOfficialDocSchema>;
      try {
        const result = await repo.generate(params.type, params.params);
        // PII 마스킹 적용 (N2SF N-05)
        const maskedContent = maskPII(result.content);

        return toolSuccess(
          `공문서 생성 완료:\n` +
          `- 문서 ID: ${result.documentId}\n` +
          `- 제목: ${result.title}\n` +
          `- 생성일: ${result.createdAt}\n\n` +
          `--- 내용 ---\n${maskedContent}`,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '공문서 생성 중 오류 발생';
        return toolError(message);
      }
    },
  };
}

// ── 도구 3: 행정 DB 조회 — Design §3.1 ──────────────────────────────────────

const queryAdminDBSchema = z.object({
  /** 조회 테이블 (화이트리스트 제한) */
  table: z.string().min(1).max(100).describe('조회 테이블명 (허용된 테이블만)'),
  /** 필터 조건 */
  filter: z.record(z.string()).describe('필터 조건 (컬럼명: 값)'),
  /** 결과 제한 수 (기본 20, 최대 100) */
  limit: z.number().int().min(1).max(100).optional().default(20),
});

function createQueryAdminDBTool(repo: AdminDBRepository): MCPToolDefinition {
  return {
    name: 'query_admin_db',
    description: '행정 DB를 읽기 전용으로 조회합니다. 허용된 테이블만 접근 가능하며, 결과에 PII가 포함된 경우 자동 마스킹됩니다.',
    inputSchema: queryAdminDBSchema,
    requiredPermission: 'mcp:admindb:query',
    handler: async (input: unknown): Promise<MCPToolResult> => {
      const params = input as z.infer<typeof queryAdminDBSchema>;

      // 테이블 화이트리스트 검증 (SQL 주입 방지 — CSAP D-12)
      const allowedTables = repo.getAllowedTables();
      if (!allowedTables.includes(params.table)) {
        return toolError(
          `허용되지 않은 테이블: ${params.table}. 허용 목록: ${allowedTables.join(', ')}`,
        );
      }

      try {
        const result = await repo.query(params.table, params.filter, params.limit);
        // 결과 PII 마스킹 (N2SF N-05)
        const maskedResult = maskPII(JSON.stringify(result.rows, null, 2));

        return toolSuccess(
          `행정 DB 조회 결과 (${result.rows.length}/${result.totalCount}건):\n\n${maskedResult}`,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '행정 DB 조회 중 오류 발생';
        return toolError(message);
      }
    },
  };
}

// ── 도구 4: CSAP 준수 확인 — Design §3.1 ────────────────────────────────────

const checkCSAPComplianceSchema = z.object({
  /** CSAP 통제항목 ID 목록 */
  controlIds: z.array(z.string().regex(/^D-\d{2}(-\d{2})?$/)).min(1).max(100)
    .describe('CSAP 통제항목 ID 목록 (예: ["D-08", "D-09-01"])'),
});

function createCheckCSAPComplianceTool(repo: CSAPComplianceRepository): MCPToolDefinition {
  return {
    name: 'check_csap_compliance',
    description: 'CSAP 통제항목 준수 상태를 확인합니다. 중/상 등급 79개 항목 중 지정된 항목의 준수 현황을 반환합니다.',
    inputSchema: checkCSAPComplianceSchema,
    requiredPermission: 'mcp:csap:check',
    handler: async (input: unknown): Promise<MCPToolResult> => {
      const params = input as z.infer<typeof checkCSAPComplianceSchema>;
      try {
        const results = await repo.checkControls(params.controlIds);

        const statusEmoji: Record<string, string> = {
          compliant: '[준수]',
          non_compliant: '[미준수]',
          partial: '[부분준수]',
          not_applicable: '[해당없음]',
        };

        const formatted = results.map((r) =>
          `${statusEmoji[r.status] ?? '[?]'} ${r.controlId}: ${r.details} (최종 확인: ${r.lastChecked})`,
        ).join('\n');

        const compliantCount = results.filter((r) => r.status === 'compliant').length;
        const totalCount = results.length;

        return toolSuccess(
          `CSAP 준수 현황 (${compliantCount}/${totalCount} 준수):\n\n${formatted}`,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'CSAP 준수 확인 중 오류 발생';
        return toolError(message);
      }
    },
  };
}

// ── 도구 5: 수수료 계산 — Design §3.1 ───────────────────────────────────────

const calculateFeeSchema = z.object({
  /** 수수료 유형 */
  type: z.string().min(1).max(100).describe('수수료/과태료 유형'),
  /** 기준 금액 (원) */
  amount: z.number().min(0).max(1_000_000_000_000).describe('기준 금액 (원)'),
  /** 추가 옵션 */
  options: z.record(z.unknown()).optional().describe('추가 계산 옵션'),
});

function createCalculateFeeTool(repo: FeeCalculatorRepository): MCPToolDefinition {
  return {
    name: 'calculate_fee',
    description: '수수료 또는 과태료를 계산합니다. 관련 법령에 따른 공식을 적용하여 정확한 금액을 산출합니다.',
    inputSchema: calculateFeeSchema,
    requiredPermission: 'mcp:fee:calculate',
    handler: async (input: unknown): Promise<MCPToolResult> => {
      const params = input as z.infer<typeof calculateFeeSchema>;

      // 지원 유형 검증
      const supportedTypes = repo.getSupportedTypes();
      if (!supportedTypes.includes(params.type)) {
        return toolError(
          `지원하지 않는 수수료 유형: ${params.type}. 지원 목록: ${supportedTypes.join(', ')}`,
        );
      }

      try {
        const result = await repo.calculate(params.type, params.amount, params.options);

        return toolSuccess(
          `수수료 계산 결과:\n` +
          `- 유형: ${result.feeType}\n` +
          `- 기준 금액: ${result.baseAmount.toLocaleString()}원\n` +
          `- 산출 수수료: ${result.calculatedFee.toLocaleString()}원\n` +
          `- 산출 공식: ${result.formula}\n` +
          `- 적용 기준일: ${result.effectiveDate}`,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '수수료 계산 중 오류 발생';
        return toolError(message);
      }
    },
  };
}

// ── 도구 일괄 등록 ───────────────────────────────────────────────────────────

/**
 * 공공기관 SaaS 도메인 도구를 일괄 생성합니다.
 *
 * 제공된 저장소에 따라 사용 가능한 도구만 생성합니다.
 *
 * @param repos - 저장소 인터페이스 모음
 * @returns MCP 도구 정의 배열
 */
export function createPublicSaaSTools(repos: MCPToolRepositories): MCPToolDefinition[] {
  const tools: MCPToolDefinition[] = [];

  if (repos.statutes) {
    tools.push(createSearchStatuteTool(repos.statutes));
  }
  if (repos.officialDocs) {
    tools.push(createGenerateOfficialDocTool(repos.officialDocs));
  }
  if (repos.adminDB) {
    tools.push(createQueryAdminDBTool(repos.adminDB));
  }
  if (repos.csapCompliance) {
    tools.push(createCheckCSAPComplianceTool(repos.csapCompliance));
  }
  if (repos.feeCalculator) {
    tools.push(createCalculateFeeTool(repos.feeCalculator));
  }

  return tools;
}
