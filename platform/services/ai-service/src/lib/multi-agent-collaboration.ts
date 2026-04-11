// 다중 에이전트 협업 프레임워크 — FR-ADV20.1~20.6
// Design Ref: SVC-AI-ADV-R20 DESIGN §1~§5
// Plan SC: SC-1 (Supervisor), SC-2 (Worker 풀), SC-3 (공유 메모리), SC-4 (DAG), SC-5 (합의)
// CSAP: D-08 에이전트별 권한 분리, D-06 통신 감사 로깅
// N2SF: N-05 에이전트 간 O등급 데이터만 교환

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 에이전트 프로필 — Design §2 */
export interface AgentProfile {
  id: string;
  name: string;
  skills: string[];
  model: string;
  maxConcurrency: number;
  priority: number;
  currentLoad: number;
}

/** 하위 작업 */
export interface SubTask {
  id: string;
  description: string;
  assignedAgent?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: string;
  output?: string;
  dependsOn: string[];
  startedAt?: string;
  completedAt?: string;
}

/** 작업 분해 계획 — Design §1 */
export interface CollaborationPlan {
  id: string;
  originalQuery: string;
  subtasks: SubTask[];
  status: 'planning' | 'executing' | 'aggregating' | 'completed' | 'failed';
  finalResult?: string;
  createdAt: string;
  completedAt?: string;
}

/** 공유 메모리 엔트리 — Design §3 */
export interface SharedMemoryEntry {
  key: string;
  value: unknown;
  owner: string;
  readers: string[];
  version: number;
  createdAt: string;
  expiresAt?: string;
}

/** 합의 투표 — Design §5 */
export interface VoteResult {
  agentId: string;
  response: string;
  confidence: number;
  reasoning: string;
}

/** 합의 결과 */
export interface ConsensusResult {
  method: 'majority' | 'weighted' | 'debate';
  winner: string;
  votes: VoteResult[];
  agreement: number;
  rounds: number;
}

/** DAG 노드 — Design §4 */
export interface DAGNode {
  agentId: string;
  taskId: string;
  inputs: string[];
  outputs: string[];
  condition?: (previousResults: Map<string, string>) => boolean;
}

// ── Worker 에이전트 풀 — Design §2 ─────────────────────────────────────────

/** 에이전트 풀 관리자 */
export class AgentPool {
  private readonly agents: Map<string, AgentProfile> = new Map();

  /** 에이전트 등록 */
  register(agent: AgentProfile): void {
    this.agents.set(agent.id, { ...agent, currentLoad: 0 });
  }

  /** 에이전트 해제 */
  unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /** 스킬 기반 에이전트 선택 (부하 분산) */
  selectBySkill(skill: string): AgentProfile | undefined {
    let bestAgent: AgentProfile | undefined;
    let lowestLoad = Infinity;

    for (const agent of this.agents.values()) {
      if (agent.skills.includes(skill) &&
          agent.currentLoad < agent.maxConcurrency &&
          agent.currentLoad < lowestLoad) {
        bestAgent = agent;
        lowestLoad = agent.currentLoad;
      }
    }

    return bestAgent;
  }

  /** 에이전트 부하 증가 */
  incrementLoad(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.currentLoad++;
    }
  }

  /** 에이전트 부하 감소 */
  decrementLoad(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent && agent.currentLoad > 0) {
      agent.currentLoad--;
    }
  }

  /** 전체 에이전트 목록 */
  list(): AgentProfile[] {
    return [...this.agents.values()];
  }

  /** 사용 가능 에이전트 수 */
  get availableCount(): number {
    let count = 0;
    for (const agent of this.agents.values()) {
      if (agent.currentLoad < agent.maxConcurrency) {
        count++;
      }
    }
    return count;
  }

  /** 전체 에이전트 수 */
  get size(): number {
    return this.agents.size;
  }
}

// ── 공유 메모리 (Blackboard) — Design §3 ───────────────────────────────────

/** 블랙보드: 에이전트 간 공유 메모리 */
export class Blackboard {
  private readonly entries: Map<string, SharedMemoryEntry> = new Map();

  /** 값 쓰기 (낙관적 잠금) */
  write(key: string, value: unknown, owner: string, readers: string[] = []): SharedMemoryEntry {
    const existing = this.entries.get(key);
    const entry: SharedMemoryEntry = {
      key,
      value,
      owner,
      readers: readers.length > 0 ? readers : [owner],
      version: existing ? existing.version + 1 : 1,
      createdAt: new Date().toISOString(),
    };
    this.entries.set(key, entry);
    return entry;
  }

  /** 값 읽기 (접근 제어 적용) */
  read(key: string, readerId: string): unknown | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // 소유자 또는 명시적 읽기 권한 확인 (CSAP D-08)
    if (entry.owner !== readerId && !entry.readers.includes(readerId)) {
      return undefined;
    }
    return entry.value;
  }

  /** 특정 소유자의 모든 항목 */
  getByOwner(ownerId: string): SharedMemoryEntry[] {
    const results: SharedMemoryEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.owner === ownerId) {
        results.push(entry);
      }
    }
    return results;
  }

  /** 만료된 항목 정리 */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt && Date.parse(entry.expiresAt) < now) {
        this.entries.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /** 전체 초기화 */
  clear(): void {
    this.entries.clear();
  }

  /** 항목 수 */
  get size(): number {
    return this.entries.size;
  }
}

// ── DAG 기반 실행 — Design §4 ──────────────────────────────────────────────

/**
 * DAG에서 실행 가능한 노드 찾기 (의존성 해결)
 */
export function findExecutableNodes(
  nodes: DAGNode[],
  completedTasks: Set<string>,
  runningTasks: Set<string>,
): DAGNode[] {
  return nodes.filter((node) => {
    // 이미 완료/실행 중이면 건너뛰기
    if (completedTasks.has(node.taskId) || runningTasks.has(node.taskId)) {
      return false;
    }
    // 모든 의존 입력이 완료되었는지
    return node.inputs.every((input) => completedTasks.has(input));
  });
}

/**
 * 위상 정렬 실행 순서 생성
 */
export function topologicalSort(nodes: DAGNode[]): DAGNode[] {
  const sorted: DAGNode[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const nodeMap = new Map<string, DAGNode>();
  for (const node of nodes) {
    nodeMap.set(node.taskId, node);
  }

  function visit(taskId: string): void {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) {
      throw new Error(`순환 의존성 감지: ${taskId}`);
    }

    visiting.add(taskId);
    const node = nodeMap.get(taskId);
    if (node) {
      for (const input of node.inputs) {
        visit(input);
      }
      visiting.delete(taskId);
      visited.add(taskId);
      sorted.push(node);
    }
  }

  for (const node of nodes) {
    visit(node.taskId);
  }

  return sorted;
}

// ── 합의 프로토콜 — Design §5 ──────────────────────────────────────────────

/**
 * 다수결 합의
 */
export function majorityVote(votes: VoteResult[]): ConsensusResult {
  if (votes.length === 0) {
    return { method: 'majority', winner: '', votes: [], agreement: 0, rounds: 1 };
  }

  // 응답별 투표 수 계산
  const voteCounts = new Map<string, number>();
  for (const vote of votes) {
    voteCounts.set(vote.response, (voteCounts.get(vote.response) ?? 0) + 1);
  }

  // 최다 득표
  let maxCount = 0;
  let winner = '';
  for (const [response, count] of voteCounts) {
    if (count > maxCount) {
      maxCount = count;
      winner = response;
    }
  }

  return {
    method: 'majority',
    winner,
    votes,
    agreement: votes.length > 0 ? maxCount / votes.length : 0,
    rounds: 1,
  };
}

/**
 * 가중 투표 합의
 */
export function weightedVote(votes: VoteResult[]): ConsensusResult {
  if (votes.length === 0) {
    return { method: 'weighted', winner: '', votes: [], agreement: 0, rounds: 1 };
  }

  // 신뢰도 가중 점수 계산
  const weightedScores = new Map<string, number>();
  let totalWeight = 0;

  for (const vote of votes) {
    const current = weightedScores.get(vote.response) ?? 0;
    weightedScores.set(vote.response, current + vote.confidence);
    totalWeight += vote.confidence;
  }

  let maxScore = 0;
  let winner = '';
  for (const [response, score] of weightedScores) {
    if (score > maxScore) {
      maxScore = score;
      winner = response;
    }
  }

  return {
    method: 'weighted',
    winner,
    votes,
    agreement: totalWeight > 0 ? maxScore / totalWeight : 0,
    rounds: 1,
  };
}

// ── Supervisor 에이전트 — Design §1 ─────────────────────────────────────────

/**
 * 작업 분해 (규칙 기반)
 * 실 운영 시 LLM 기반 작업 분해 사용
 */
export function decomposeTask(query: string): SubTask[] {
  const subtasks: SubTask[] = [];

  // 키워드 기반 작업 분해
  const analysisKeywords = ['분석', '검토', '조사', '평가', '진단'];
  const documentKeywords = ['문서', '보고서', '작성', '생성', '초안'];
  const regulationKeywords = ['법령', '규정', '규제', '조례', '지침'];

  const hasAnalysis = analysisKeywords.some((kw) => query.includes(kw));
  const hasDocument = documentKeywords.some((kw) => query.includes(kw));
  const hasRegulation = regulationKeywords.some((kw) => query.includes(kw));

  if (hasRegulation) {
    subtasks.push({
      id: `st-${Date.now()}-reg`,
      description: '관련 법령/규정 조회 및 분석',
      status: 'pending',
      input: query,
      dependsOn: [],
    });
  }

  if (hasAnalysis) {
    subtasks.push({
      id: `st-${Date.now()}-analysis`,
      description: '요청 사항 상세 분석',
      status: 'pending',
      input: query,
      dependsOn: hasRegulation ? [subtasks[0]?.id ?? ''] : [],
    });
  }

  if (hasDocument) {
    subtasks.push({
      id: `st-${Date.now()}-doc`,
      description: '문서/보고서 작성',
      status: 'pending',
      input: query,
      dependsOn: subtasks.map((st) => st.id),
    });
  }

  // 기본 작업 (키워드 없는 경우)
  if (subtasks.length === 0) {
    subtasks.push({
      id: `st-${Date.now()}-default`,
      description: '요청 처리',
      status: 'pending',
      input: query,
      dependsOn: [],
    });
  }

  return subtasks;
}

/**
 * 협업 계획 생성
 */
export function createCollaborationPlan(query: string): CollaborationPlan {
  return {
    id: `collab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    originalQuery: query,
    subtasks: decomposeTask(query),
    status: 'planning',
    createdAt: new Date().toISOString(),
  };
}
