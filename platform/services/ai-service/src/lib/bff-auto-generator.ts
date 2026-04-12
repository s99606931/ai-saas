// BFF (Backend for Frontend) 자동 생성기 -- FR-N373.1~FR-N373.5
// Design Ref: MTU-N373 | CSAP: D-08, D-12

export interface ApiEndpoint {
  readonly path: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly responseFields: readonly string[];
  readonly requiredPermissions: readonly string[];
}

export interface ScreenSpec {
  readonly screenId: string;
  readonly requiredFields: readonly string[];
}

export interface BffEndpoint {
  readonly screenId: string;
  readonly sourceEndpoints: readonly string[];
  readonly mergedFields: readonly string[];
  readonly requiredPermissions: readonly string[];
}

export interface BffAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: BffAuditEntry[] = [];

function recordAudit(entry: Omit<BffAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getBffAuditLog(tenantId: string): readonly BffAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function analyzeFieldCoverage(
  screen: ScreenSpec,
  endpoints: readonly ApiEndpoint[],
): { covered: string[]; missing: string[]; sources: Record<string, string> } {
  const sources: Record<string, string> = {};
  const covered: string[] = [];
  const missing: string[] = [];
  for (const field of screen.requiredFields) {
    const ep = endpoints.find((e) => e.responseFields.includes(field));
    if (ep) {
      covered.push(field);
      sources[field] = `${ep.method} ${ep.path}`;
    } else {
      missing.push(field);
    }
  }
  return { covered, missing, sources };
}

export function generateBffEndpoint(
  tenantId: string,
  screen: ScreenSpec,
  endpoints: readonly ApiEndpoint[],
): BffEndpoint {
  const { covered, missing, sources } = analyzeFieldCoverage(screen, endpoints);
  if (missing.length > 0) {
    throw new Error(`필드 누락: ${missing.join(', ')}`);
  }
  const sourceKeys = Array.from(new Set(Object.values(sources)));
  const permissionsSet = new Set<string>();
  for (const ep of endpoints) {
    for (const f of ep.responseFields) {
      if (covered.includes(f)) {
        for (const p of ep.requiredPermissions) permissionsSet.add(p);
      }
    }
  }
  const bff: BffEndpoint = {
    screenId: screen.screenId,
    sourceEndpoints: sourceKeys,
    mergedFields: covered,
    requiredPermissions: Array.from(permissionsSet).sort(),
  };
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'BFF_ENDPOINT_GENERATED',
    target: screen.screenId,
    details: { fieldCount: covered.length, sourceCount: sourceKeys.length, permissions: bff.requiredPermissions.length },
  });
  return bff;
}

export function generateBffCode(endpoint: BffEndpoint): string {
  const lines: string[] = [];
  lines.push(`// BFF: ${endpoint.screenId}`);
  lines.push(`export async function handle${endpoint.screenId}(ctx: { user: { permissions: string[] } }) {`);
  lines.push(`  const required = ${JSON.stringify(endpoint.requiredPermissions)};`);
  lines.push(`  for (const p of required) if (!ctx.user.permissions.includes(p)) throw new Error('Forbidden: ' + p);`);
  lines.push(`  const sources = ${JSON.stringify(endpoint.sourceEndpoints)};`);
  lines.push(`  return { sources, fields: ${JSON.stringify(endpoint.mergedFields)} };`);
  lines.push(`}`);
  return lines.join('\n');
}

export class BffAutoGeneratorService {
  constructor(private readonly tenantId: string) {}
  generate(screen: ScreenSpec, endpoints: readonly ApiEndpoint[]): BffEndpoint {
    return generateBffEndpoint(this.tenantId, screen, endpoints);
  }
  generateCode(endpoint: BffEndpoint): string {
    return generateBffCode(endpoint);
  }
  getAuditLog(): readonly BffAuditEntry[] {
    return getBffAuditLog(this.tenantId);
  }
}
