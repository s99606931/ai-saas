// Design Ref: SVC-AI-ADV-R690.design.md — AI기반 서비스 설계도 자동 생성 v2
// Plan SC: FR-R690.1~5

export type BlueprintComponent = 'API' | 'LOG' | 'AUTH' | 'DB' | 'CACHE' | 'QUEUE';
export type BlueprintComplexity = 'HIGH' | 'MEDIUM' | 'LOW';
export type BlueprintRecommendation = 'REVIEW_ARCH' | 'STANDARD' | 'LIGHTWEIGHT';

export interface BlueprintRequirement {
  serviceId: string;
  needsAuth: boolean;
  needsDb: boolean;
  needsCache: boolean;
  needsQueue: boolean;
}

export interface BlueprintResult {
  serviceId: string;
  components: BlueprintComponent[];
  complexity: BlueprintComplexity;
  recommendation: BlueprintRecommendation;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details?: Record<string, unknown>;
}

export class ServiceBlueprintGeneratorAIV2 {
  private readonly auditLog: AuditEntry[] = [];

  generate(req: BlueprintRequirement, dataGrade?: string): BlueprintResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (!req.serviceId) {
      throw new Error('INVALID_SERVICE_ID');
    }

    const components: BlueprintComponent[] = ['API', 'LOG'];
    if (req.needsAuth) components.push('AUTH');
    if (req.needsDb) components.push('DB');
    if (req.needsCache) components.push('CACHE');
    if (req.needsQueue) components.push('QUEUE');

    let complexity: BlueprintComplexity;
    let recommendation: BlueprintRecommendation;
    if (components.length >= 5) {
      complexity = 'HIGH';
      recommendation = 'REVIEW_ARCH';
    } else if (components.length >= 3) {
      complexity = 'MEDIUM';
      recommendation = 'STANDARD';
    } else {
      complexity = 'LOW';
      recommendation = 'LIGHTWEIGHT';
    }

    const result: BlueprintResult = {
      serviceId: req.serviceId,
      components,
      complexity,
      recommendation,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'GENERATE',
      details: { serviceId: req.serviceId, componentCount: components.length, complexity },
    });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
