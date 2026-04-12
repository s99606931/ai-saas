// Plan SC: FR-R86.1~5
import { describe, it, expect } from 'vitest';
import {
  END_NODE,
  createAiGraphWorkflowEngine,
} from '../ai-graph-workflow-engine';

interface State {
  step: number;
  classified?: string;
  answer?: string;
  [key: string]: unknown;
}

describe('AiGraphWorkflowEngine', () => {
  it('FR-R86.1: addNode/addEdge/setEntry builds graph and runs linearly', async () => {
    const g = createAiGraphWorkflowEngine<State>();
    g.addNode('classify', async (s) => ({ classified: 'petition', step: s.step + 1 }));
    g.addNode('answer', async (s) => ({ answer: 'ok', step: s.step + 1 }));
    g.addEdge('classify', 'answer');
    g.addEdge('answer', END_NODE);
    g.setEntry('classify');
    const res = await g.run({ step: 0 });
    expect(res.completed).toBe(true);
    expect(res.finalState.classified).toBe('petition');
    expect(res.finalState.answer).toBe('ok');
    expect(res.path).toEqual(['classify', 'answer']);
  });

  it('FR-R86.2: conditional edge routes by state', async () => {
    const g = createAiGraphWorkflowEngine<State>();
    g.addNode('start', async () => ({ classified: 'urgent' }));
    g.addNode('urgentPath', async () => ({ answer: 'URGENT' }));
    g.addNode('normalPath', async () => ({ answer: 'NORMAL' }));
    g.addConditionalEdge('start', (s) =>
      s.classified === 'urgent' ? 'urgentPath' : 'normalPath',
    );
    g.addEdge('urgentPath', END_NODE);
    g.addEdge('normalPath', END_NODE);
    g.setEntry('start');
    const res = await g.run({ step: 0 });
    expect(res.finalState.answer).toBe('URGENT');
  });

  it('FR-R86.4: maxSteps stops infinite loop', async () => {
    const g = createAiGraphWorkflowEngine<State>({ maxSteps: 5 });
    g.addNode('a', async () => ({}));
    g.addNode('b', async () => ({}));
    g.addEdge('a', 'b');
    g.addEdge('b', 'a');
    g.setEntry('a');
    const res = await g.run({ step: 0 });
    expect(res.completed).toBe(false);
    expect(res.reason).toBe('MAX_STEPS');
  });

  it('FR-R86.4: node errors propagate as failed', async () => {
    const g = createAiGraphWorkflowEngine<State>();
    g.addNode('boom', async () => {
      throw new Error('boom');
    });
    g.addEdge('boom', END_NODE);
    g.setEntry('boom');
    const res = await g.run({ step: 0 });
    expect(res.reason).toBe('ERROR');
    expect(res.error).toContain('boom');
  });

  it('FR-R86.5: checkpoint save/load', () => {
    const g = createAiGraphWorkflowEngine<State>();
    g.addNode('n', async () => ({}));
    g.saveCheckpoint('cp1', { step: 3, answer: 'x' }, ['n']);
    const cp = g.loadCheckpoint('cp1');
    expect(cp?.state.step).toBe(3);
    expect(cp?.path).toEqual(['n']);
  });

  it('FR-R86.5: audit log contains NODE_RUN/EDGE_TAKE/COMPLETE', async () => {
    const g = createAiGraphWorkflowEngine<State>();
    g.addNode('a', async () => ({}));
    g.addEdge('a', END_NODE);
    g.setEntry('a');
    await g.run({ step: 0 });
    const log = g.getAuditLog();
    expect(log.some((e) => e.action === 'NODE_RUN')).toBe(true);
    expect(log.some((e) => e.action === 'COMPLETE')).toBe(true);
  });

  it('rejects missing entry', async () => {
    const g = createAiGraphWorkflowEngine<State>();
    const res = await g.run({ step: 0 });
    expect(res.reason).toBe('ERROR');
  });

  it('rejects unknown nodes in edges', () => {
    const g = createAiGraphWorkflowEngine<State>();
    g.addNode('a', async () => ({}));
    expect(() => g.addEdge('a', 'z')).toThrow();
    expect(() => g.addEdge('x', 'a')).toThrow();
  });
});
