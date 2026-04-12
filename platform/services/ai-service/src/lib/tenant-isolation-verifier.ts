// Design Ref: docs/02-design/mtus/SVC-AI-ADV-R84.design.md
// Plan SC: FR-R84.1~5 (SVC-AI-ADV-R84 Tenant Isolation Verifier)
// CSAP: D-06 감사, D-08 접근 통제, D-12 개발 보안

export type ResourceKind =
  | 'document'
  | 'embedding'
  | 'session'
  | 'agent'
  | 'dataset';

export interface ResourceMeta {
  resourceId: string;
  ownerTenantId: string;
  sharedWith?: string[];
  kind: ResourceKind;
}

export type AccessAction = 'read' | 'write' | 'delete';

export interface AccessContext {
  actorId: string;
  actorTenantId: string;
  resourceId: string;
  action: AccessAction;
}

export interface AuditEvent {
  ts: string;
  action: 'REGISTER' | 'ALLOW' | 'DENY' | 'SHARE' | 'UNREGISTER';
  actorId?: string;
  actorTenantId?: string;
  resourceId: string;
  details?: Record<string, unknown>;
}

export class TenantIsolationViolation extends Error {
  readonly ctx: AccessContext;
  readonly ownerTenantId: string;
  constructor(ctx: AccessContext, ownerTenantId: string) {
    super(
      `tenant isolation violation: actor=${ctx.actorTenantId} owner=${ownerTenantId} resource=${ctx.resourceId}`,
    );
    this.name = 'TenantIsolationViolation';
    this.ctx = ctx;
    this.ownerTenantId = ownerTenantId;
  }
}

export class TenantIsolationVerifier {
  private readonly resources = new Map<string, ResourceMeta>();
  private readonly auditLog: AuditEvent[] = [];

  /** FR-R84.1 */
  register(resource: ResourceMeta): void {
    if (!resource.resourceId || !resource.ownerTenantId) {
      throw new Error('invalid resource meta');
    }
    this.resources.set(resource.resourceId, {
      ...resource,
      sharedWith: resource.sharedWith ? [...resource.sharedWith] : [],
    });
    this.log({
      ts: new Date().toISOString(),
      action: 'REGISTER',
      resourceId: resource.resourceId,
      details: { owner: resource.ownerTenantId, kind: resource.kind },
    });
  }

  unregister(resourceId: string): void {
    if (this.resources.delete(resourceId)) {
      this.log({
        ts: new Date().toISOString(),
        action: 'UNREGISTER',
        resourceId,
      });
    }
  }

  /** FR-R84.2~3: 위반 시 throw */
  verify(ctx: AccessContext): void {
    const meta = this.resources.get(ctx.resourceId);
    if (!meta) {
      this.log({
        ts: new Date().toISOString(),
        action: 'DENY',
        actorId: ctx.actorId,
        actorTenantId: ctx.actorTenantId,
        resourceId: ctx.resourceId,
        details: { reason: 'unknown_resource', action: ctx.action },
      });
      throw new TenantIsolationViolation(ctx, 'unknown');
    }

    const isOwner = meta.ownerTenantId === ctx.actorTenantId;
    const shared = meta.sharedWith?.includes(ctx.actorTenantId) ?? false;

    // 공유된 리소스라도 write/delete는 소유자만
    const allowed =
      isOwner || (shared && ctx.action === 'read');

    if (!allowed) {
      this.log({
        ts: new Date().toISOString(),
        action: 'DENY',
        actorId: ctx.actorId,
        actorTenantId: ctx.actorTenantId,
        resourceId: ctx.resourceId,
        details: {
          reason: isOwner ? 'policy' : shared ? 'shared_readonly' : 'cross_tenant',
          action: ctx.action,
        },
      });
      throw new TenantIsolationViolation(ctx, meta.ownerTenantId);
    }

    this.log({
      ts: new Date().toISOString(),
      action: 'ALLOW',
      actorId: ctx.actorId,
      actorTenantId: ctx.actorTenantId,
      resourceId: ctx.resourceId,
      details: { action: ctx.action, isOwner, shared },
    });
  }

  /** 불리언 형태 — 예외 없이 사용 */
  canAccess(ctx: AccessContext): boolean {
    try {
      this.verify(ctx);
      return true;
    } catch (e) {
      if (e instanceof TenantIsolationViolation) return false;
      throw e;
    }
  }

  /** FR-R84.4: 리소스 공유 */
  share(resourceId: string, targetTenantId: string): void {
    const meta = this.resources.get(resourceId);
    if (!meta) throw new Error(`resource not registered: ${resourceId}`);
    if (!meta.sharedWith) meta.sharedWith = [];
    if (!meta.sharedWith.includes(targetTenantId)) {
      meta.sharedWith.push(targetTenantId);
    }
    this.log({
      ts: new Date().toISOString(),
      action: 'SHARE',
      resourceId,
      details: { target: targetTenantId },
    });
  }

  /** FR-R84.5 */
  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog.slice();
  }

  private log(ev: AuditEvent): void {
    this.auditLog.push(ev);
  }
}

export function createTenantIsolationVerifier(): TenantIsolationVerifier {
  return new TenantIsolationVerifier();
}
