// API 버전 관리자
// Design Ref: SVC-APIVER-R9 Plan
// Plan SC: FR-APIVER.1~FR-APIVER.4
// CSAP: D-12 시스템 개발 보안

/**
 * API 버전 정의
 */
export interface ApiVersionConfig {
  /** 버전 번호 (예: 'v1', 'v2') */
  version: string;
  /** 상태 */
  status: 'active' | 'deprecated' | 'sunset';
  /** deprecated 시 표시할 만료 예정일 (ISO 8601) */
  sunsetDate?: string;
  /** deprecated 시 대체 버전 */
  replacedBy?: string;
}

/**
 * 버전 라우트 정의
 */
export interface VersionedRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  versions: Map<string, unknown>; // version -> handler
}

/**
 * API 버전 관리자
 *
 * 기능:
 * - URL 기반 버전 라우팅 (/v1/resource, /v2/resource)
 * - Deprecated 버전 경고 헤더 (Sunset, Deprecation)
 * - 버전 네고시에이션
 * - 감사 로그 (구 버전 사용 추적)
 */
export class ApiVersionManager {
  private readonly versions = new Map<string, ApiVersionConfig>();
  private defaultVersion = 'v1';

  /**
   * API 버전 등록
   */
  registerVersion(config: ApiVersionConfig): void {
    this.versions.set(config.version, config);
  }

  /**
   * 기본 버전 설정
   */
  setDefaultVersion(version: string): void {
    this.defaultVersion = version;
  }

  /**
   * 기본 버전 조회
   */
  getDefaultVersion(): string {
    return this.defaultVersion;
  }

  /**
   * 버전 정보 조회
   */
  getVersion(version: string): ApiVersionConfig | undefined {
    return this.versions.get(version);
  }

  /**
   * 모든 등록된 버전 조회
   */
  listVersions(): ApiVersionConfig[] {
    return Array.from(this.versions.values());
  }

  /**
   * 활성 버전 목록
   */
  getActiveVersions(): ApiVersionConfig[] {
    return this.listVersions().filter((v) => v.status === 'active');
  }

  /**
   * URL에서 버전 추출
   * /v1/tenants -> 'v1'
   * /v2/users -> 'v2'
   * /tenants -> defaultVersion
   */
  extractVersion(url: string): { version: string; path: string } {
    const match = url.match(/^\/(v[\w.-]+)(\/.*)?$/);
    if (match) {
      return {
        version: match[1],
        path: match[2] || '/',
      };
    }
    return {
      version: this.defaultVersion,
      path: url,
    };
  }

  /**
   * 버전 유효성 검증
   */
  isValidVersion(version: string): boolean {
    return this.versions.has(version);
  }

  /**
   * 버전이 사용 가능한지 검증 (sunset 제외)
   */
  isUsableVersion(version: string): boolean {
    const config = this.versions.get(version);
    if (!config) return false;
    return config.status !== 'sunset';
  }

  /**
   * Deprecated 경고 헤더 생성
   *
   * RFC 8594 (Sunset Header) + RFC 8594 (Deprecation Header) 준수
   */
  getDeprecationHeaders(version: string): Record<string, string> {
    const config = this.versions.get(version);
    if (!config || config.status === 'active') return {};

    const headers: Record<string, string> = {};

    if (config.status === 'deprecated') {
      headers['Deprecation'] = 'true';
      headers['X-API-Deprecated'] = `API version ${version} is deprecated`;

      if (config.sunsetDate) {
        headers['Sunset'] = new Date(config.sunsetDate).toUTCString();
      }
      if (config.replacedBy) {
        headers['Link'] = `</${config.replacedBy}>; rel="successor-version"`;
        headers['X-API-Replace-With'] = config.replacedBy;
      }
    }

    if (config.status === 'sunset') {
      headers['X-API-Sunset'] = `API version ${version} has been sunset`;
    }

    return headers;
  }

  /**
   * 버전 경로 생성 헬퍼
   *
   * @param version - 버전 (예: 'v1')
   * @param basePath - 기본 경로 (예: '/tenants')
   * @returns 버전 포함 경로 (예: '/v1/tenants')
   */
  versionedPath(version: string, basePath: string): string {
    const normalized = basePath.startsWith('/') ? basePath : `/${basePath}`;
    return `/${version}${normalized}`;
  }
}

/**
 * 싱글턴 인스턴스
 */
export const apiVersionManager = new ApiVersionManager();
