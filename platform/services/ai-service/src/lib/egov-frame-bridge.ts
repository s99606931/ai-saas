// 전자정부 표준프레임워크(eGovFrame) API 브리지 -- FR-N378.1~FR-N378.5
// Design Ref: MTU-N378 | CSAP: D-08, D-09, D-12

export interface EgovRequest {
  readonly serviceId: string;
  readonly operationId: string;
  readonly sessionKey: string;
  readonly params: Record<string, string | number | boolean>;
}

export interface SaasRequest {
  readonly endpoint: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly headers: Record<string, string>;
  readonly body: Record<string, unknown>;
}

export interface SaasResponse {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

export interface EgovResponse {
  readonly resultCode: string;
  readonly resultMessage: string;
  readonly data: Record<string, unknown>;
}

export interface EgovAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: EgovAuditEntry[] = [];
const tokenMap = new Map<string, string>();

function recordAudit(entry: Omit<EgovAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getEgovAuditLog(tenantId: string): readonly EgovAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function registerSessionToken(sessionKey: string, saasToken: string): void {
  tokenMap.set(sessionKey, saasToken);
}

export function resolveSaasToken(sessionKey: string): string | undefined {
  return tokenMap.get(sessionKey);
}

export function transformEgovRequest(tenantId: string, req: EgovRequest): SaasRequest {
  const token = resolveSaasToken(req.sessionKey);
  if (!token) {
    throw new Error(`세션 키 ${req.sessionKey} 매핑 없음`);
  }
  const endpoint = `/saas/${req.serviceId}/${req.operationId}`;
  const saasReq: SaasRequest = {
    endpoint,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'Content-Type': 'application/json',
    },
    body: { ...req.params },
  };
  recordAudit({
    actor: req.sessionKey,
    tenantId,
    action: 'EGOV_REQUEST_TRANSFORMED',
    target: req.serviceId,
    details: { operationId: req.operationId, endpoint },
  });
  return saasReq;
}

const ERROR_CODE_MAP: Record<number, string> = {
  200: '0000',
  400: '4000',
  401: '4010',
  403: '4030',
  404: '4040',
  500: '9999',
};

const ERROR_MESSAGE_MAP: Record<number, string> = {
  200: '정상',
  400: '잘못된 요청',
  401: '인증 실패',
  403: '권한 없음',
  404: '리소스 없음',
  500: '서버 오류',
};

export function transformSaasResponse(tenantId: string, resp: SaasResponse): EgovResponse {
  const resultCode = ERROR_CODE_MAP[resp.status] ?? '9999';
  const resultMessage = ERROR_MESSAGE_MAP[resp.status] ?? '알 수 없는 오류';
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'SAAS_RESPONSE_TRANSFORMED',
    target: String(resp.status),
    details: { resultCode },
  });
  return {
    resultCode,
    resultMessage,
    data: resp.body,
  };
}

export function validateEgovRequest(req: EgovRequest): { valid: boolean; errors: readonly string[] } {
  const errors: string[] = [];
  if (!req.serviceId || req.serviceId.length === 0) errors.push('serviceId 필수');
  if (!req.operationId) errors.push('operationId 필수');
  if (!req.sessionKey) errors.push('sessionKey 필수');
  if (!/^[a-zA-Z0-9_-]+$/.test(req.serviceId)) errors.push('serviceId 형식 오류');
  return { valid: errors.length === 0, errors };
}

export class EgovFrameBridgeService {
  constructor(private readonly tenantId: string) {}
  registerToken(sessionKey: string, saasToken: string): void {
    registerSessionToken(sessionKey, saasToken);
  }
  transformRequest(req: EgovRequest): SaasRequest {
    return transformEgovRequest(this.tenantId, req);
  }
  transformResponse(resp: SaasResponse): EgovResponse {
    return transformSaasResponse(this.tenantId, resp);
  }
  validate(req: EgovRequest) {
    return validateEgovRequest(req);
  }
  getAuditLog(): readonly EgovAuditEntry[] {
    return getEgovAuditLog(this.tenantId);
  }
}
