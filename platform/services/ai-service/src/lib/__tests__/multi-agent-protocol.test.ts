import { describe, it, expect } from 'vitest';
import {
  MultiAgentProtocol,
  type AgentContract,
} from '../multi-agent-protocol.js';

function makeContract(
  agentId: string,
  partial: Partial<AgentContract> = {},
): AgentContract {
  return {
    agentId,
    capabilities: ['summarize', 'translate'],
    maxDepth: 4,
    allowedGrades: ['O'],
    ...partial,
  };
}

describe('register (FR-R71.1)', () => {
  it('정상 등록', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    expect(p.getContract('a1')?.agentId).toBe('a1');
  });
  it('agentId 누락', () => {
    const p = new MultiAgentProtocol();
    expect(() => p.register(makeContract(''))).toThrow('PROTOCOL_AGENT_ID_REQUIRED');
  });
  it('capabilities 누락', () => {
    const p = new MultiAgentProtocol();
    expect(() =>
      p.register(makeContract('a1', { capabilities: [] })),
    ).toThrow('PROTOCOL_CAPABILITIES_REQUIRED');
  });
  it('maxDepth 잘못', () => {
    const p = new MultiAgentProtocol();
    expect(() =>
      p.register(makeContract('a1', { maxDepth: 0 })),
    ).toThrow('PROTOCOL_MAX_DEPTH_INVALID');
  });
});

describe('propose 등급 차단 (FR-R71.5)', () => {
  it('O 등급 허용', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    const msg = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'text',
      grade: 'O',
    });
    expect(msg.kind).toBe('propose');
    expect(msg.depth).toBe(1);
  });
  it('C 등급 차단', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    expect(() =>
      p.propose({
        fromAgent: 'a1',
        toAgent: 'a2',
        capability: 'summarize',
        payload: 'x',
        grade: 'C',
      }),
    ).toThrow('PROTOCOL_GRADE_BLOCKED');
  });
  it('S 등급 차단', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    expect(() =>
      p.propose({
        fromAgent: 'a1',
        toAgent: 'a2',
        capability: 'summarize',
        payload: 'x',
        grade: 'S',
      }),
    ).toThrow('PROTOCOL_GRADE_BLOCKED');
  });
});

describe('propose 권한 검증 (FR-R71.1)', () => {
  it('미등록 대상', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    expect(() =>
      p.propose({
        fromAgent: 'a1',
        toAgent: 'a2',
        capability: 'summarize',
        payload: 'x',
        grade: 'O',
      }),
    ).toThrow('PROTOCOL_TARGET_NOT_REGISTERED');
  });
  it('지원하지 않는 capability', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2', { capabilities: ['translate'] }));
    expect(() =>
      p.propose({
        fromAgent: 'a1',
        toAgent: 'a2',
        capability: 'summarize',
        payload: 'x',
        grade: 'O',
      }),
    ).toThrow('PROTOCOL_CAPABILITY_UNSUPPORTED');
  });
  it('대상 등급 미지원', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2', { allowedGrades: [] }));
    expect(() =>
      p.propose({
        fromAgent: 'a1',
        toAgent: 'a2',
        capability: 'summarize',
        payload: 'x',
        grade: 'O',
      }),
    ).toThrow('PROTOCOL_TARGET_GRADE_BLOCKED');
  });
});

describe('위임 체인 + 순환 감지 (FR-R71.4)', () => {
  it('정상 체인', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    p.register(makeContract('a3'));
    const m1 = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    const m2 = p.propose({
      fromAgent: 'a2',
      toAgent: 'a3',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
      parentTaskId: m1.taskId,
    });
    expect(m2.depth).toBe(2);
    expect(p.getTask(m2.taskId)?.rootTaskId).toBe(m1.taskId);
  });
  it('순환 차단', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    const m1 = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    expect(() =>
      p.propose({
        fromAgent: 'a2',
        toAgent: 'a1',
        capability: 'summarize',
        payload: 'x',
        grade: 'O',
        parentTaskId: m1.taskId,
      }),
    ).toThrow('PROTOCOL_CYCLE_DETECTED');
  });
  it('최대 깊이 초과', () => {
    const p = new MultiAgentProtocol({ defaultMaxDepth: 1 });
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    p.register(makeContract('a3'));
    const m1 = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    expect(() =>
      p.propose({
        fromAgent: 'a2',
        toAgent: 'a3',
        capability: 'summarize',
        payload: 'x',
        grade: 'O',
        parentTaskId: m1.taskId,
      }),
    ).toThrow('PROTOCOL_MAX_DEPTH_EXCEEDED');
  });
});

describe('respond / start / complete (FR-R71.2, R71.3)', () => {
  it('accept → start → complete', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    const m = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    p.respond(m.taskId, 'accept', 'a2');
    p.start(m.taskId, 'a2');
    const done = p.complete(m.taskId, 'a2', 'result-text');
    expect(done.status).toBe('done');
    expect(done.result).toBe('result-text');
  });
  it('reject', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    const m = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    const t = p.respond(m.taskId, 'reject', 'a2');
    expect(t.status).toBe('rejected');
  });
  it('잘못된 응답자', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    const m = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    expect(() => p.respond(m.taskId, 'accept', 'a1')).toThrow(
      'PROTOCOL_WRONG_RESPONDENT',
    );
  });
  it('잘못된 상태 전이', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    const m = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    p.respond(m.taskId, 'reject', 'a2');
    expect(() => p.complete(m.taskId, 'a2', 'r')).toThrow('PROTOCOL_INVALID_STATE');
  });
});

describe('aggregate (FR-R71.3)', () => {
  it('concat', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    p.register(makeContract('a3'));
    const m1 = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    const m2 = p.propose({
      fromAgent: 'a1',
      toAgent: 'a3',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
      parentTaskId: m1.taskId,
    });
    p.respond(m1.taskId, 'accept', 'a2');
    p.complete(m1.taskId, 'a2', 'r1');
    p.respond(m2.taskId, 'accept', 'a3');
    p.complete(m2.taskId, 'a3', 'r2');
    const agg = p.aggregate(m1.taskId, 'concat');
    expect(agg.subtaskCount).toBe(2);
    expect(agg.result).toContain('r1');
    expect(agg.result).toContain('r2');
  });
  it('vote', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    p.register(makeContract('a3'));
    p.register(makeContract('a4'));
    const m1 = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    const m2 = p.propose({
      fromAgent: 'a1',
      toAgent: 'a3',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
      parentTaskId: m1.taskId,
    });
    const m3 = p.propose({
      fromAgent: 'a1',
      toAgent: 'a4',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
      parentTaskId: m1.taskId,
    });
    p.respond(m1.taskId, 'accept', 'a2');
    p.complete(m1.taskId, 'a2', 'answerA');
    p.respond(m2.taskId, 'accept', 'a3');
    p.complete(m2.taskId, 'a3', 'answerA');
    p.respond(m3.taskId, 'accept', 'a4');
    p.complete(m3.taskId, 'a4', 'answerB');
    const agg = p.aggregate(m1.taskId, 'vote');
    expect(agg.result).toBe('answerA');
  });
  it('done 하위 없음', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    const m1 = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    expect(() => p.aggregate(m1.taskId, 'concat')).toThrow(
      'PROTOCOL_NO_DONE_SUBTASKS',
    );
  });
});

describe('tick 타임아웃', () => {
  it('오래된 태스크는 timeout', () => {
    const p = new MultiAgentProtocol({ timeoutMs: 100 });
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    const m = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    const count = p.tick(Date.now() + 5000);
    expect(count).toBe(1);
    expect(p.getTask(m.taskId)?.status).toBe('timeout');
  });
});

describe('감사 로그 (FR-R71.5, D-06)', () => {
  it('주요 이벤트 기록', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    const m = p.propose({
      fromAgent: 'a1',
      toAgent: 'a2',
      capability: 'summarize',
      payload: 'x',
      grade: 'O',
    });
    p.respond(m.taskId, 'accept', 'a2');
    p.complete(m.taskId, 'a2', 'r');
    const log = p.getAuditLog();
    const kinds = log.map((e) => e.event);
    expect(kinds).toContain('REGISTER');
    expect(kinds).toContain('PROPOSE');
    expect(kinds).toContain('ACCEPT');
    expect(kinds).toContain('RESULT');
  });
  it('GRADE_BLOCK 기록', () => {
    const p = new MultiAgentProtocol();
    p.register(makeContract('a1'));
    p.register(makeContract('a2'));
    try {
      p.propose({
        fromAgent: 'a1',
        toAgent: 'a2',
        capability: 'summarize',
        payload: 'x',
        grade: 'C',
      });
    } catch {
      /* expected */
    }
    expect(p.getAuditLog().some((e) => e.event === 'GRADE_BLOCK')).toBe(true);
  });
});
