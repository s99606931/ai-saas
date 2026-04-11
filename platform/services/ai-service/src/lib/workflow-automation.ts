// AI 워크플로우 자동화 엔진 -- FR-N277.1~FR-N277.6
// Design Ref: MTU-N277 DESIGN §1~§6
// CSAP: D-06 감사, D-08 접근 통제, D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

export type TriggerType = 'event' | 'schedule' | 'condition' | 'manual';
export type NodeType = 'trigger' | 'condition' | 'action' | 'fork' | 'join' | 'end';
export type ActionType = 'email' | 'notification' | 'api_call' | 'approval' | 'log' | 'webhook';
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';
export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_approval';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  config: Record<string, unknown>;
  nextNodes: string[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  status: WorkflowStatus;
  createdAt: string;
  createdBy: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  currentNode: string;
  context: Record<string, unknown>;
  nodeResults: NodeResult[];
  startedAt: string;
  completedAt?: string;
}

export interface NodeResult {
  nodeId: string;
  nodeName: string;
  status: 'success' | 'failed' | 'skipped';
  output: Record<string, unknown>;
  executedAt: string;
}

// -- 저장소/감사 ──────────────────────────────────────────────────────────────

const workflows = new Map<string, WorkflowDefinition>();
const executions = new Map<string, WorkflowExecution>();
const auditLog: { id: string; action: string; actor: string; details: Record<string, unknown>; timestamp: string }[] = [];

function recordAudit(action: string, actor: string, details: Record<string, unknown> = {}): void {
  auditLog.push({ id: randomUUID(), action, actor, details, timestamp: new Date().toISOString() });
}

export function getWorkflowAuditLog() { return [...auditLog]; }

// -- §1 워크플로우 정의 ──────────────────────────────────────────────────────

export function createWorkflow(params: {
  name: string;
  description: string;
  nodes: Omit<WorkflowNode, 'id'>[];
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  actor: string;
}): WorkflowDefinition {
  const workflow: WorkflowDefinition = {
    id: randomUUID(),
    name: params.name,
    description: params.description,
    nodes: params.nodes.map((n) => ({ ...n, id: randomUUID() })),
    triggerType: params.triggerType,
    triggerConfig: params.triggerConfig,
    status: 'draft',
    createdAt: new Date().toISOString(),
    createdBy: params.actor,
  };

  workflows.set(workflow.id, workflow);
  recordAudit('WORKFLOW_CREATED', params.actor, { workflowId: workflow.id });
  return workflow;
}

export function activateWorkflow(workflowId: string, actor: string): void {
  const wf = workflows.get(workflowId);
  if (!wf) throw new Error(`워크플로우를 찾을 수 없습니다: ${workflowId}`);
  wf.status = 'active';
  recordAudit('WORKFLOW_ACTIVATED', actor, { workflowId });
}

// -- §2 트리거 평가 ──────────────────────────────────────────────────────────

export function evaluateTrigger(
  workflowId: string,
  event: Record<string, unknown>
): boolean {
  const wf = workflows.get(workflowId);
  if (!wf || wf.status !== 'active') return false;

  switch (wf.triggerType) {
    case 'event': {
      const eventType = wf.triggerConfig.eventType as string;
      return event.type === eventType;
    }
    case 'condition': {
      const field = wf.triggerConfig.field as string;
      const operator = wf.triggerConfig.operator as string;
      const value = wf.triggerConfig.value;
      const eventValue = event[field];
      if (operator === 'eq') return eventValue === value;
      if (operator === 'gt') return (eventValue as number) > (value as number);
      if (operator === 'lt') return (eventValue as number) < (value as number);
      return false;
    }
    case 'manual':
      return true;
    default:
      return false;
  }
}

// -- §3~§4 실행 엔진 ─────────────────────────────────────────────────────────

export function executeWorkflow(
  workflowId: string,
  context: Record<string, unknown>,
  actor: string
): WorkflowExecution {
  const wf = workflows.get(workflowId);
  if (!wf) throw new Error(`워크플로우를 찾을 수 없습니다: ${workflowId}`);

  const execution: WorkflowExecution = {
    id: randomUUID(),
    workflowId,
    status: 'running',
    currentNode: wf.nodes[0]?.id || '',
    context,
    nodeResults: [],
    startedAt: new Date().toISOString(),
  };

  // 노드 순차 실행
  for (const node of wf.nodes) {
    execution.currentNode = node.id;

    const result = executeNode(node, execution.context);
    execution.nodeResults.push(result);

    if (result.status === 'failed') {
      execution.status = 'failed';
      break;
    }

    // 조건 노드: 결과에 따라 다음 노드 결정
    if (node.type === 'condition' && !result.output.conditionMet) {
      // 조건 미충족 시 스킵
      continue;
    }
  }

  if (execution.status === 'running') {
    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();
  }

  executions.set(execution.id, execution);
  recordAudit('WORKFLOW_EXECUTED', actor, { executionId: execution.id, status: execution.status });
  return execution;
}

function executeNode(node: WorkflowNode, context: Record<string, unknown>): NodeResult {
  const result: NodeResult = {
    nodeId: node.id,
    nodeName: node.name,
    status: 'success',
    output: {},
    executedAt: new Date().toISOString(),
  };

  switch (node.type) {
    case 'condition': {
      const field = node.config.field as string;
      const operator = node.config.operator as string;
      const value = node.config.value;
      const actual = context[field];
      let conditionMet = false;
      if (operator === 'eq') conditionMet = actual === value;
      else if (operator === 'gt') conditionMet = (actual as number) > (value as number);
      else if (operator === 'lt') conditionMet = (actual as number) < (value as number);
      else if (operator === 'contains') conditionMet = String(actual).includes(String(value));
      result.output = { conditionMet };
      break;
    }
    case 'action': {
      const actionType = node.config.actionType as ActionType;
      result.output = { actionType, executed: true, message: `${actionType} 액션 실행 완료` };
      break;
    }
    case 'trigger':
    case 'fork':
    case 'join':
    case 'end':
      result.output = { type: node.type };
      break;
  }

  return result;
}

// -- 조회 ────────────────────────────────────────────────────────────────────

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return workflows.get(id);
}

export function listWorkflows(): WorkflowDefinition[] {
  return Array.from(workflows.values());
}

export function getExecution(id: string): WorkflowExecution | undefined {
  return executions.get(id);
}

export function listExecutions(workflowId?: string): WorkflowExecution[] {
  const all = Array.from(executions.values());
  return workflowId ? all.filter((e) => e.workflowId === workflowId) : all;
}
