// Design Ref: SVC-AI-ADV-R609-v3.design.md §알고리즘
// Plan SC: SC-R609v3-1, SC-R609v3-2, SC-R609v3-3
// 트랙 A 22차

export type ScanSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NONE';
export type ScanFinding =
  | 'AUTH_MISSING'
  | 'HTTPS_MISSING'
  | 'INPUT_VALIDATION_MISSING'
  | 'RATE_LIMIT_MISSING';

export interface EndpointInput {
  id: string;
  path: string;
  method: string;
  hasAuth: boolean;
  hasHttps: boolean;
  hasRateLimit: boolean;
  hasInputValidation: boolean;
}

export interface EndpointResult {
  id: string;
  findings: ScanFinding[];
  maxSeverity: ScanSeverity;
}

export interface ScanResult {
  totalEndpoints: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  items: EndpointResult[];
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}

const SEVERITY_RANK: Record<ScanSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  NONE: 1,
};

const FINDING_SEVERITY: Record<ScanFinding, ScanSeverity> = {
  AUTH_MISSING: 'CRITICAL',
  HTTPS_MISSING: 'CRITICAL',
  INPUT_VALIDATION_MISSING: 'HIGH',
  RATE_LIMIT_MISSING: 'MEDIUM',
};

export class ApiSecurityScannerV3 {
  private readonly auditLog: AuditEntry[] = [];

  scan(endpoints: EndpointInput[]): ScanResult {
    const items: EndpointResult[] = endpoints.map((ep) => {
      const findings: ScanFinding[] = [];
      if (!ep.hasAuth) findings.push('AUTH_MISSING');
      if (!ep.hasHttps) findings.push('HTTPS_MISSING');
      if (!ep.hasInputValidation) findings.push('INPUT_VALIDATION_MISSING');
      if (!ep.hasRateLimit) findings.push('RATE_LIMIT_MISSING');

      let maxSeverity: ScanSeverity = 'NONE';
      for (const f of findings) {
        const sev = FINDING_SEVERITY[f];
        if (SEVERITY_RANK[sev] > SEVERITY_RANK[maxSeverity]) {
          maxSeverity = sev;
        }
      }

      return { id: ep.id, findings, maxSeverity };
    });

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    for (const it of items) {
      if (it.maxSeverity === 'CRITICAL') criticalCount++;
      else if (it.maxSeverity === 'HIGH') highCount++;
      else if (it.maxSeverity === 'MEDIUM') mediumCount++;
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'API_SECURITY_SCAN',
      details: {
        totalEndpoints: endpoints.length,
        criticalCount,
        highCount,
        mediumCount,
      },
    });

    return {
      totalEndpoints: endpoints.length,
      criticalCount,
      highCount,
      mediumCount,
      items,
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
