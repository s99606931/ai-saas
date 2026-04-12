import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolUsePlanner,
  type Tool,
  type Principal,
  type GoalSpec,
} from '../tool-use-planner.js';

function makeTool(id: string, role = 'user', willFail = false, fn?: (a: unknown) => unknown): Tool {
  return {
    id,
    name: id,
    requiredRole: role,
    run: async (args) => {
      if (willFail) throw new Error(`${id}_failed`);
      return fn ? fn(args) : { ok: true, id, args };
    },
  };
}

const USER: Principal = { userId: 'u1', roles: ['user'] };
const ADMIN: Principal = { userId: 'u2', roles: ['admin'] };

describe('ToolUsePlanner 생성자', () => {
  it('기본 한계 적용', () => {
    const p = new ToolUsePlanner();
    expect(p.getLimits().maxDepth).toBe(5);
  });

  it('잘못된 depth 거부', () => {
    expect(() => new ToolUsePlanner({ maxDepth: 0 })).toThrow('TP_INVALID_DEPTH');
  });
});

describe('plan() (FR-R61.1)', () => {
  let planner: ToolUsePlanner;
  beforeEach(() => {
    planner = new ToolUsePlanner();
    planner.registerTool(makeTool('search'));
    planner.registerTool(makeTool('summarize'));
  });

  it('정상 DAG 빌드', () => {
    const spec: GoalSpec = {
      goal: '검색 후 요약',
      nodes: [
        { id: 's1', tool: 'search', args: { q: 'hello' }, deps: [], alternatives: [] },
        { id: 's2', tool: 'summarize', args: {}, deps: ['s1'], alternatives: [] },
      ],
    };
    const plan = planner.plan(spec);
    expect(plan.length).toBe(2);
    expect(plan[0]?.status).toBe('pending');
  });

  it('미등록 tool 거부', () => {
    const spec: GoalSpec = {
      goal: 'bad',
      nodes: [{ id: 's1', tool: 'ghost', args: {}, deps: [], alternatives: [] }],
    };
    expect(() => planner.plan(spec)).toThrow('TP_UNKNOWN_TOOL');
  });

  it('순환 감지', () => {
    const spec: GoalSpec = {
      goal: 'cycle',
      nodes: [
        { id: 's1', tool: 'search', args: {}, deps: ['s2'], alternatives: [] },
        { id: 's2', tool: 'summarize', args: {}, deps: ['s1'], alternatives: [] },
      ],
    };
    expect(() => planner.plan(spec)).toThrow('TP_CYCLE_DETECTED');
  });

  it('depth 초과', () => {
    const planner2 = new ToolUsePlanner({ maxDepth: 2 });
    planner2.registerTool(makeTool('t'));
    const nodes = Array.from({ length: 4 }, (_, i) => ({
      id: `n${i}`,
      tool: 't',
      args: {},
      deps: i === 0 ? [] : [`n${i - 1}`],
      alternatives: [],
    }));
    expect(() => planner2.plan({ goal: 'deep', nodes })).toThrow('TP_DEPTH_EXCEEDED');
  });
});

describe('execute() (FR-R61.2)', () => {
  it('순차 실행 성공', async () => {
    const planner = new ToolUsePlanner();
    planner.registerTool(makeTool('search'));
    planner.registerTool(makeTool('summarize'));
    const plan = planner.plan({
      goal: '검색 후 요약',
      nodes: [
        { id: 's1', tool: 'search', args: { q: 'x' }, deps: [], alternatives: [] },
        { id: 's2', tool: 'summarize', args: {}, deps: ['s1'], alternatives: [] },
      ],
    });
    const result = await planner.execute(plan, USER);
    expect(result.success).toBe(true);
    expect(plan.every((n) => n.status === 'success')).toBe(true);
  });

  it('권한 없으면 실패', async () => {
    const planner = new ToolUsePlanner();
    planner.registerTool(makeTool('admin-tool', 'admin'));
    const plan = planner.plan({
      goal: 'admin op',
      nodes: [{ id: 'a1', tool: 'admin-tool', args: {}, deps: [], alternatives: [] }],
    });
    const r = await planner.execute(plan, USER);
    expect(r.success).toBe(false);
    expect(plan[0]?.error).toBe('PERMISSION_DENIED');
  });

  it('admin 역할 통과', async () => {
    const planner = new ToolUsePlanner();
    planner.registerTool(makeTool('admin-tool', 'admin'));
    const plan = planner.plan({
      goal: 'admin op',
      nodes: [{ id: 'a1', tool: 'admin-tool', args: {}, deps: [], alternatives: [] }],
    });
    const r = await planner.execute(plan, ADMIN);
    expect(r.success).toBe(true);
  });
});

describe('backtrack (FR-R61.3)', () => {
  it('실패한 노드가 대체 tool로 재실행', async () => {
    const planner = new ToolUsePlanner({ maxRetriesPerNode: 1 });
    planner.registerTool(makeTool('primary', 'user', true));   // 실패
    planner.registerTool(makeTool('backup', 'user', false));   // 성공
    const plan = planner.plan({
      goal: 'with alt',
      nodes: [
        { id: 'n1', tool: 'primary', args: {}, deps: [], alternatives: ['backup'] },
      ],
    });
    const r = await planner.execute(plan, USER);
    expect(r.success).toBe(true);
    expect(plan[0]?.tool).toBe('backup');
    const audit = planner.getAuditLog();
    expect(audit.some((e) => e.action === 'BACKTRACK')).toBe(true);
  });

  it('대체 없으면 실패', async () => {
    const planner = new ToolUsePlanner({ maxRetriesPerNode: 1 });
    planner.registerTool(makeTool('only', 'user', true));
    const plan = planner.plan({
      goal: 'no alt',
      nodes: [{ id: 'n1', tool: 'only', args: {}, deps: [], alternatives: [] }],
    });
    const r = await planner.execute(plan, USER);
    expect(r.success).toBe(false);
  });
});

describe('limits & audit (FR-R61.4~5)', () => {
  it('maxTotalSteps 초과', () => {
    const planner = new ToolUsePlanner({ maxTotalSteps: 2 });
    planner.registerTool(makeTool('t'));
    const nodes = Array.from({ length: 3 }, (_, i) => ({
      id: `n${i}`,
      tool: 't',
      args: {},
      deps: [],
      alternatives: [],
    }));
    expect(() => planner.plan({ goal: 'many', nodes })).toThrow('TP_TOO_MANY_STEPS');
  });

  it('감사 로그 기록', async () => {
    const planner = new ToolUsePlanner();
    planner.registerTool(makeTool('t'));
    const plan = planner.plan({
      goal: 'x',
      nodes: [{ id: 'n1', tool: 't', args: {}, deps: [], alternatives: [] }],
    });
    await planner.execute(plan, USER);
    const log = planner.getAuditLog();
    expect(log.some((e) => e.action === 'PLAN_BUILT')).toBe(true);
    expect(log.some((e) => e.action === 'TOOL_EXECUTED')).toBe(true);
  });
});

describe('enforceDataGrade (FR-R61.6)', () => {
  it('C 등급 차단', async () => {
    const planner = new ToolUsePlanner();
    planner.registerTool(makeTool('t'));
    const plan = planner.plan({
      goal: 'x',
      nodes: [{ id: 'n1', tool: 't', args: {}, deps: [], alternatives: [] }],
    });
    await expect(planner.execute(plan, USER, 'C')).rejects.toThrow('BLOCKED');
  });
});
