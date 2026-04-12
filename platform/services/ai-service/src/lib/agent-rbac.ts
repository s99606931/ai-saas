// AI 에이전트 RBAC — FR-N392.1~5
// Design Ref: MTU-N392
// CSAP: D-08 접근통제

export type Effect = 'allow' | 'deny';

export interface PolicyRule {
  id: string;
  effect: Effect;
  actions: string[];
  resources: string[];
  condition?: PolicyCondition;
}

export interface PolicyCondition {
  tenantId?: string;
  ipCidr?: string;
  timeWindow?: { startHour: number; endHour: number };
  maxDailyCalls?: number;
}

export interface AgentRole {
  id: string;
  name: string;
  rules: PolicyRule[];
}

export interface AccessContext {
  agentId: string;
  action: string;
  resource: string;
  tenantId: string;
  ipAddress: string;
  hourOfDay: number;
  callsToday: number;
}

export interface EvaluationResult {
  allowed: boolean;
  matchedRuleId?: string;
  reason: string;
}

export class AgentRbacEngine {
  private readonly roles = new Map<string, AgentRole>();
  private readonly bindings = new Map<string, Set<string>>();
  private readonly auditTrail: Array<{ ts: string; ctx: AccessContext; result: EvaluationResult }> = [];

  defineRole(role: AgentRole): void {
    if (role.rules.length === 0) throw new Error('RBAC_EMPTY_RULES');
    this.roles.set(role.id, role);
  }

  bind(agentId: string, roleId: string): void {
    if (!this.roles.has(roleId)) throw new Error('RBAC_ROLE_NOT_FOUND');
    const set = this.bindings.get(agentId) ?? new Set<string>();
    set.add(roleId);
    this.bindings.set(agentId, set);
  }

  unbind(agentId: string, roleId: string): void {
    this.bindings.get(agentId)?.delete(roleId);
  }

  evaluate(ctx: AccessContext): EvaluationResult {
    const roleIds = this.bindings.get(ctx.agentId);
    if (!roleIds || roleIds.size === 0) {
      const res: EvaluationResult = { allowed: false, reason: 'NO_ROLE_BOUND' };
      this.audit(ctx, res);
      return res;
    }
    let allowRuleId: string | undefined;
    for (const roleId of roleIds) {
      const role = this.roles.get(roleId);
      if (!role) continue;
      for (const rule of role.rules) {
        if (!this.ruleMatches(rule, ctx)) continue;
        if (rule.effect === 'deny') {
          const res: EvaluationResult = { allowed: false, matchedRuleId: rule.id, reason: 'DENY_RULE' };
          this.audit(ctx, res);
          return res;
        }
        allowRuleId = rule.id;
      }
    }
    const result: EvaluationResult = allowRuleId
      ? { allowed: true, matchedRuleId: allowRuleId, reason: 'ALLOW_RULE' }
      : { allowed: false, reason: 'NO_MATCH' };
    this.audit(ctx, result);
    return result;
  }

  auditLog(): ReadonlyArray<{ ts: string; ctx: AccessContext; result: EvaluationResult }> {
    return this.auditTrail;
  }

  private ruleMatches(rule: PolicyRule, ctx: AccessContext): boolean {
    if (!this.wildcardMatch(rule.actions, ctx.action)) return false;
    if (!this.wildcardMatch(rule.resources, ctx.resource)) return false;
    const cond = rule.condition;
    if (!cond) return true;
    if (cond.tenantId && cond.tenantId !== ctx.tenantId) return false;
    if (cond.timeWindow) {
      const { startHour, endHour } = cond.timeWindow;
      if (ctx.hourOfDay < startHour || ctx.hourOfDay >= endHour) return false;
    }
    if (cond.maxDailyCalls !== undefined && ctx.callsToday >= cond.maxDailyCalls) return false;
    if (cond.ipCidr && !this.ipInCidr(ctx.ipAddress, cond.ipCidr)) return false;
    return true;
  }

  private wildcardMatch(patterns: string[], target: string): boolean {
    return patterns.some((pattern) => {
      if (pattern === '*') return true;
      if (pattern === target) return true;
      if (pattern.endsWith('*')) return target.startsWith(pattern.slice(0, -1));
      return false;
    });
  }

  private ipInCidr(ip: string, cidr: string): boolean {
    const parts = cidr.split('/');
    const base = parts[0];
    const bitsStr = parts[1];
    if (!base || !bitsStr) return false;
    const bits = Number.parseInt(bitsStr, 10);
    if (Number.isNaN(bits)) return false;
    const ipNum = this.ipToNum(ip);
    const baseNum = this.ipToNum(base);
    if (ipNum === null || baseNum === null) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipNum & mask) === (baseNum & mask);
  }

  private ipToNum(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let acc = 0;
    for (const part of parts) {
      const n = Number.parseInt(part, 10);
      if (Number.isNaN(n) || n < 0 || n > 255) return null;
      acc = (acc << 8) | n;
    }
    return acc >>> 0;
  }

  private audit(ctx: AccessContext, result: EvaluationResult): void {
    this.auditTrail.push({ ts: new Date().toISOString(), ctx, result });
  }
}
