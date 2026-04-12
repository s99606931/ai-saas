// Design Ref: MTU-N442 §데이터 레지던시 정책
// Plan SC: FR-N442.1~5

export interface ResidencyPolicy {
  allowedRegions: string[];
  blockedCountries: string[];
  requireApprovalCountries: string[];
}

export interface StorageLocation {
  resourceId: string;
  region: string;
  country: string;
}

export interface TransferRequest {
  resourceId: string;
  targetRegion: string;
  targetCountry: string;
  approvalId?: string;
}

export interface PolicyViolation {
  resourceId: string;
  violationType: 'storage-forbidden' | 'transfer-forbidden' | 'approval-required';
  detail: string;
}

export interface ApprovalRecord {
  approvalId: string;
  approver: string;
  targetCountry: string;
  expiresAt: string;
}

export interface ResidencyAudit {
  timestamp: string;
  action: string;
  resourceId: string;
  result: 'allow' | 'block';
  reason: string;
}

export class DataResidencyPolicyEngine {
  /** FR-N442.1 정책 검증 */
  validatePolicy(policy: ResidencyPolicy): boolean {
    return policy.allowedRegions.length > 0;
  }

  /** FR-N442.2 스토리지 위치 검증 */
  verifyStorage(policy: ResidencyPolicy, location: StorageLocation): PolicyViolation | null {
    if (policy.blockedCountries.includes(location.country)) {
      return {
        resourceId: location.resourceId,
        violationType: 'storage-forbidden',
        detail: `차단 국가 저장: ${location.country}`,
      };
    }
    if (!policy.allowedRegions.includes(location.region)) {
      return {
        resourceId: location.resourceId,
        violationType: 'storage-forbidden',
        detail: `허용 리전 외: ${location.region}`,
      };
    }
    return null;
  }

  /** FR-N442.3 전송 차단 */
  verifyTransfer(
    policy: ResidencyPolicy,
    request: TransferRequest,
    approvals: ApprovalRecord[],
  ): PolicyViolation | null {
    if (policy.blockedCountries.includes(request.targetCountry)) {
      return {
        resourceId: request.resourceId,
        violationType: 'transfer-forbidden',
        detail: `차단 국가 전송 시도: ${request.targetCountry}`,
      };
    }
    if (policy.requireApprovalCountries.includes(request.targetCountry)) {
      if (!request.approvalId) {
        return {
          resourceId: request.resourceId,
          violationType: 'approval-required',
          detail: `승인 필요 국가: ${request.targetCountry}`,
        };
      }
      const appr = approvals.find((a) => a.approvalId === request.approvalId);
      if (!appr || new Date(appr.expiresAt) < new Date()) {
        return {
          resourceId: request.resourceId,
          violationType: 'approval-required',
          detail: '승인 만료 또는 미등록',
        };
      }
    }
    return null;
  }

  /** FR-N442.4 승인 등록 */
  registerApproval(approvals: ApprovalRecord[], record: ApprovalRecord): ApprovalRecord[] {
    return [...approvals.filter((a) => a.approvalId !== record.approvalId), record];
  }

  /** FR-N442.5 감사 로그 */
  audit(action: string, resourceId: string, result: 'allow' | 'block', reason: string): ResidencyAudit {
    return {
      timestamp: new Date().toISOString(),
      action,
      resourceId,
      result,
      reason,
    };
  }
}

export const dataResidencyPolicyEngine = new DataResidencyPolicyEngine();
