// 서비스 디스커버리 메타데이터 표준화
// Design Ref: SVC-MESH-R13 Plan
// Plan SC: FR-MESH.4
// CSAP: D-10 네트워크 보안

/**
 * 서비스 메타데이터 정의
 */
export interface ServiceMetadataConfig {
  /** 서비스 이름 */
  name: string;
  /** 서비스 버전 (semver) */
  version: string;
  /** k8s 네임스페이스 */
  namespace?: string;
  /** Istio 사이드카 주입 여부 */
  sidecarInjected?: boolean;
  /** 지원 프로토콜 */
  protocols?: string[];
  /** 의존 서비스 목록 */
  dependencies?: string[];
  /** 레이블 (k8s 레이블 호환) */
  labels?: Record<string, string>;
}

/**
 * 서비스 메타데이터 관리자
 *
 * k8s + Istio 환경에서 서비스 디스커버리에 필요한 표준 메타데이터 제공
 */
export class ServiceMetadata {
  private readonly config: Required<ServiceMetadataConfig>;
  private readonly startTime: number;

  constructor(config: ServiceMetadataConfig) {
    this.startTime = Date.now();
    this.config = {
      namespace: process.env['K8S_NAMESPACE'] ?? 'default',
      sidecarInjected: process.env['ISTIO_SIDECAR'] === 'true',
      protocols: ['http'],
      dependencies: [],
      labels: {},
      ...config,
    };
  }

  /**
   * 전체 메타데이터 반환 (디스커버리 엔드포인트용)
   */
  getMetadata(): {
    service: ServiceMetadataConfig;
    runtime: {
      uptime: number;
      nodeVersion: string;
      pid: number;
      environment: string;
    };
  } {
    return {
      service: {
        name: this.config.name,
        version: this.config.version,
        namespace: this.config.namespace,
        sidecarInjected: this.config.sidecarInjected,
        protocols: this.config.protocols,
        dependencies: this.config.dependencies,
        labels: this.config.labels,
      },
      runtime: {
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        nodeVersion: process.version,
        pid: process.pid,
        environment: process.env['NODE_ENV'] ?? 'production',
      },
    };
  }

  /**
   * k8s 레이블 형식으로 반환
   */
  getLabels(): Record<string, string> {
    return {
      'app.kubernetes.io/name': this.config.name,
      'app.kubernetes.io/version': this.config.version,
      'app.kubernetes.io/component': 'microservice',
      'app.kubernetes.io/part-of': 'public-saas',
      ...this.config.labels,
    };
  }

  /**
   * 서비스 이름 반환
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * 서비스 버전 반환
   */
  getVersion(): string {
    return this.config.version;
  }
}
