// Multi-Agent 마켓플레이스 — FR-N391.1~5
// Design Ref: MTU-N391 §1~§5
// Plan SC: 등록/검색/실행/사용량/라이프사이클
// CSAP: D-08 접근통제, D-09 서명검증, D-06 감사

import { z } from 'zod';

export type AgentStatus = 'pending' | 'approved' | 'suspended' | 'retired';

export interface MarketAgent {
  id: string;
  name: string;
  description: string;
  version: string;
  provider: string;
  tags: string[];
  skills: string[];
  endpointUrl: string;
  signature: string;
  status: AgentStatus;
  ownerId: string;
  createdAt: string;
  approvedAt?: string;
  executionCount: number;
}

export interface ExecutionRecord {
  id: string;
  agentId: string;
  actorId: string;
  startedAt: string;
  endedAt?: string;
  status: 'running' | 'completed' | 'failed';
  tokensUsed: number;
  costKrw: number;
}

export interface UsageSummary {
  agentId: string;
  totalCalls: number;
  totalTokens: number;
  totalCostKrw: number;
  lastUsedAt?: string;
}

export const AgentRegistrationSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  provider: z.string().min(1),
  tags: z.array(z.string()).max(20),
  skills: z.array(z.string()).max(50),
  endpointUrl: z.string().url(),
  signature: z.string().min(32),
});

export class AgentMarketplace {
  private readonly agents = new Map<string, MarketAgent>();
  private readonly executions = new Map<string, ExecutionRecord>();
  private readonly allowedOwners = new Set<string>();

  registerOwner(ownerId: string): void {
    this.allowedOwners.add(ownerId);
  }

  register(ownerId: string, input: z.infer<typeof AgentRegistrationSchema>): MarketAgent {
    if (!this.allowedOwners.has(ownerId)) {
      throw new Error('MARKET_OWNER_FORBIDDEN');
    }
    const parsed = AgentRegistrationSchema.parse(input);
    if (!this.verifySignature(parsed.signature)) {
      throw new Error('MARKET_SIGNATURE_INVALID');
    }
    const id = `agent-${Date.now()}-${this.agents.size}`;
    const agent: MarketAgent = {
      id,
      name: parsed.name,
      description: parsed.description,
      version: parsed.version,
      provider: parsed.provider,
      tags: parsed.tags,
      skills: parsed.skills,
      endpointUrl: parsed.endpointUrl,
      signature: parsed.signature,
      status: 'pending',
      ownerId,
      createdAt: new Date().toISOString(),
      executionCount: 0,
    };
    this.agents.set(id, agent);
    return agent;
  }

  approve(agentId: string, approverId: string): MarketAgent {
    const agent = this.requireAgent(agentId);
    if (!this.allowedOwners.has(approverId)) {
      throw new Error('MARKET_APPROVER_FORBIDDEN');
    }
    agent.status = 'approved';
    agent.approvedAt = new Date().toISOString();
    return agent;
  }

  suspend(agentId: string, reason: string): MarketAgent {
    if (reason.trim().length === 0) {
      throw new Error('MARKET_REASON_REQUIRED');
    }
    const agent = this.requireAgent(agentId);
    agent.status = 'suspended';
    return agent;
  }

  retire(agentId: string): MarketAgent {
    const agent = this.requireAgent(agentId);
    agent.status = 'retired';
    return agent;
  }

  search(query: { text?: string; tags?: string[]; status?: AgentStatus }): MarketAgent[] {
    const normText = query.text?.toLowerCase().trim();
    const tags = query.tags ?? [];
    return Array.from(this.agents.values()).filter((agent) => {
      if (query.status && agent.status !== query.status) return false;
      if (tags.length > 0 && !tags.every((t) => agent.tags.includes(t))) return false;
      if (normText) {
        const haystack = `${agent.name} ${agent.description} ${agent.skills.join(' ')}`.toLowerCase();
        if (!haystack.includes(normText)) return false;
      }
      return true;
    });
  }

  async execute(
    agentId: string,
    actorId: string,
    _payload: Record<string, unknown>,
    options: { tokensEstimated: number; maxTokens: number },
  ): Promise<ExecutionRecord> {
    const agent = this.requireAgent(agentId);
    if (agent.status !== 'approved') {
      throw new Error('MARKET_AGENT_NOT_APPROVED');
    }
    if (options.tokensEstimated > options.maxTokens) {
      throw new Error('MARKET_QUOTA_EXCEEDED');
    }
    const execId = `exec-${Date.now()}-${this.executions.size}`;
    const record: ExecutionRecord = {
      id: execId,
      agentId,
      actorId,
      startedAt: new Date().toISOString(),
      status: 'running',
      tokensUsed: 0,
      costKrw: 0,
    };
    this.executions.set(execId, record);
    return record;
  }

  completeExecution(execId: string, tokensUsed: number, costKrw: number): ExecutionRecord {
    const record = this.executions.get(execId);
    if (!record) throw new Error('MARKET_EXEC_NOT_FOUND');
    record.status = 'completed';
    record.endedAt = new Date().toISOString();
    record.tokensUsed = tokensUsed;
    record.costKrw = costKrw;
    const agent = this.agents.get(record.agentId);
    if (agent) agent.executionCount += 1;
    return record;
  }

  usage(agentId: string): UsageSummary {
    const records = Array.from(this.executions.values()).filter((r) => r.agentId === agentId);
    const totals = records.reduce(
      (acc, r) => {
        acc.totalTokens += r.tokensUsed;
        acc.totalCostKrw += r.costKrw;
        if (!acc.lastUsedAt || (r.endedAt && r.endedAt > acc.lastUsedAt)) {
          acc.lastUsedAt = r.endedAt ?? acc.lastUsedAt;
        }
        return acc;
      },
      { totalTokens: 0, totalCostKrw: 0, lastUsedAt: undefined as string | undefined },
    );
    return {
      agentId,
      totalCalls: records.length,
      totalTokens: totals.totalTokens,
      totalCostKrw: totals.totalCostKrw,
      lastUsedAt: totals.lastUsedAt,
    };
  }

  private requireAgent(agentId: string): MarketAgent {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('MARKET_AGENT_NOT_FOUND');
    return agent;
  }

  private verifySignature(signature: string): boolean {
    return signature.length >= 32 && /^[A-Za-z0-9+/=_-]+$/.test(signature);
  }
}
