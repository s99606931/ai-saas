// MCP 리소스 프로바이더 — FR-ADV7.2
// Design Ref: SVC-AI-ADV-R7 DESIGN §2
// Plan SC: SC-1 (Resources 구현)
// CSAP: D-12 시스템 개발 보안, N2SF N-05 O등급 데이터만 노출

import type { MCPResource, MCPResourceContent, MCPResourceProvider } from './mcp-server.js';

// ── 법령 리소스 ──────────────────────────────────────────────────────────────

/** 법령 데이터 (O등급 — 공개 정보) */
interface StatuteData {
  id: string;
  title: string;
  content: string;
  lastUpdated: string;
}

/** 법령 저장소 인터페이스 (DIP — 의존성 역전) */
export interface StatuteRepository {
  findAll(): Promise<Array<{ id: string; title: string; lastUpdated: string }>>;
  findById(id: string): Promise<StatuteData | null>;
}

// ── 공문서 양식 리소스 ───────────────────────────────────────────────────────

/** 공문서 양식 유형 */
export type OfficialDocType = 'cooperation' | 'notice' | 'report' | 'meeting' | 'approval';

/** 공문서 양식 데이터 */
interface OfficialDocTemplate {
  type: OfficialDocType;
  title: string;
  htmlTemplate: string;
}

/** 공문서 양식 저장소 인터페이스 */
export interface OfficialDocRepository {
  findAll(): Promise<Array<{ type: OfficialDocType; title: string }>>;
  findByType(type: OfficialDocType): Promise<OfficialDocTemplate | null>;
}

// ── 행정구역 코드 리소스 ─────────────────────────────────────────────────────

/** 행정구역 코드 데이터 */
interface AdminCodeData {
  code: string;
  name: string;
  parentCode?: string;
  level: number;
}

/** 행정구역 코드 저장소 인터페이스 */
export interface AdminCodeRepository {
  findAll(): Promise<Array<{ code: string; name: string }>>;
  findByCode(code: string): Promise<AdminCodeData | null>;
}

// ── CSAP 통제항목 리소스 ─────────────────────────────────────────────────────

/** CSAP 통제항목 데이터 */
interface CSAPControlData {
  controlId: string;
  title: string;
  description: string;
  category: string;
}

/** CSAP 통제항목 저장소 인터페이스 */
export interface CSAPControlRepository {
  findAll(): Promise<Array<{ controlId: string; title: string; category: string }>>;
  findByControlId(controlId: string): Promise<CSAPControlData | null>;
}

// ── 공공기관 리소스 프로바이더 구현 ──────────────────────────────────────────

/** 리소스 프로바이더 설정 */
export interface PublicSaaSResourceProviderConfig {
  statutes?: StatuteRepository;
  officialDocs?: OfficialDocRepository;
  adminCodes?: AdminCodeRepository;
  csapControls?: CSAPControlRepository;
}

/**
 * 공공기관 SaaS MCP 리소스 프로바이더
 *
 * 공공기관 도메인의 리소스를 MCP 프로토콜로 노출합니다.
 * 모든 리소스는 N2SF O등급(공개) 데이터만 포함합니다.
 *
 * 지원 리소스 URI 스킴:
 * - law://statutes/{id} — 법령 전문
 * - template://official-docs/{type} — 공문서 양식
 * - data://admin-codes/{code} — 행정구역 코드
 * - policy://csap/{controlId} — CSAP 통제항목
 */
export class PublicSaaSResourceProvider implements MCPResourceProvider {
  private readonly config: PublicSaaSResourceProviderConfig;

  constructor(config: PublicSaaSResourceProviderConfig) {
    this.config = config;
  }

  /**
   * 사용 가능한 모든 리소스 목록을 반환합니다.
   */
  async list(): Promise<MCPResource[]> {
    const resources: MCPResource[] = [];

    // 법령 리소스
    if (this.config.statutes) {
      const statutes = await this.config.statutes.findAll();
      for (const statute of statutes) {
        resources.push({
          uri: `law://statutes/${statute.id}`,
          name: statute.title,
          description: `법령: ${statute.title} (최종 개정: ${statute.lastUpdated})`,
          mimeType: 'text/plain',
        });
      }
    }

    // 공문서 양식 리소스
    if (this.config.officialDocs) {
      const docs = await this.config.officialDocs.findAll();
      for (const doc of docs) {
        resources.push({
          uri: `template://official-docs/${doc.type}`,
          name: doc.title,
          description: `공문서 양식: ${doc.title}`,
          mimeType: 'text/html',
        });
      }
    }

    // 행정구역 코드 리소스
    if (this.config.adminCodes) {
      const codes = await this.config.adminCodes.findAll();
      for (const code of codes) {
        resources.push({
          uri: `data://admin-codes/${code.code}`,
          name: code.name,
          description: `행정구역: ${code.name} (코드: ${code.code})`,
          mimeType: 'application/json',
        });
      }
    }

    // CSAP 통제항목 리소스
    if (this.config.csapControls) {
      const controls = await this.config.csapControls.findAll();
      for (const control of controls) {
        resources.push({
          uri: `policy://csap/${control.controlId}`,
          name: `${control.controlId}: ${control.title}`,
          description: `CSAP 통제항목: ${control.title} (분류: ${control.category})`,
          mimeType: 'text/markdown',
        });
      }
    }

    return resources;
  }

  /**
   * 특정 URI의 리소스 내용을 읽어옵니다.
   *
   * @param uri - 리소스 URI (예: "law://statutes/act-001")
   * @returns 리소스 내용
   */
  async read(uri: string): Promise<{ contents: MCPResourceContent[] }> {
    // URI 파싱
    const parsed = parseResourceURI(uri);
    if (!parsed) {
      throw new Error(`지원하지 않는 리소스 URI: ${uri}`);
    }

    switch (parsed.scheme) {
      case 'law': {
        if (!this.config.statutes) throw new Error('법령 리소스 프로바이더 미설정');
        const statute = await this.config.statutes.findById(parsed.id);
        if (!statute) throw new Error(`법령을 찾을 수 없습니다: ${parsed.id}`);
        return {
          contents: [{
            uri,
            text: `# ${statute.title}\n\n최종 개정: ${statute.lastUpdated}\n\n${statute.content}`,
            mimeType: 'text/plain',
          }],
        };
      }

      case 'template': {
        if (!this.config.officialDocs) throw new Error('공문서 양식 프로바이더 미설정');
        const doc = await this.config.officialDocs.findByType(parsed.id as OfficialDocType);
        if (!doc) throw new Error(`공문서 양식을 찾을 수 없습니다: ${parsed.id}`);
        return {
          contents: [{
            uri,
            text: doc.htmlTemplate,
            mimeType: 'text/html',
          }],
        };
      }

      case 'data': {
        if (!this.config.adminCodes) throw new Error('행정구역 코드 프로바이더 미설정');
        const code = await this.config.adminCodes.findByCode(parsed.id);
        if (!code) throw new Error(`행정구역 코드를 찾을 수 없습니다: ${parsed.id}`);
        return {
          contents: [{
            uri,
            text: JSON.stringify(code, null, 2),
            mimeType: 'application/json',
          }],
        };
      }

      case 'policy': {
        if (!this.config.csapControls) throw new Error('CSAP 통제항목 프로바이더 미설정');
        const control = await this.config.csapControls.findByControlId(parsed.id);
        if (!control) throw new Error(`CSAP 통제항목을 찾을 수 없습니다: ${parsed.id}`);
        return {
          contents: [{
            uri,
            text: `# ${control.controlId}: ${control.title}\n\n**분류**: ${control.category}\n\n${control.description}`,
            mimeType: 'text/markdown',
          }],
        };
      }

      default:
        throw new Error(`지원하지 않는 리소스 스킴: ${parsed.scheme}`);
    }
  }
}

// ── URI 파서 ─────────────────────────────────────────────────────────────────

interface ParsedResourceURI {
  scheme: string;
  type: string;
  id: string;
}

/**
 * 리소스 URI를 파싱합니다.
 * 형식: {scheme}://{type}/{id}
 */
function parseResourceURI(uri: string): ParsedResourceURI | null {
  const match = /^(\w+):\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) return null;

  return {
    scheme: match[1] ?? '',
    type: match[2] ?? '',
    id: match[3] ?? '',
  };
}

// ── 팩토리 함수 ──────────────────────────────────────────────────────────────

/**
 * 공공기관 SaaS 리소스 프로바이더를 생성합니다.
 *
 * @param config - 저장소 설정
 * @returns MCPResourceProvider 구현체
 */
export function createPublicSaaSResourceProvider(
  config: PublicSaaSResourceProviderConfig,
): MCPResourceProvider {
  return new PublicSaaSResourceProvider(config);
}
