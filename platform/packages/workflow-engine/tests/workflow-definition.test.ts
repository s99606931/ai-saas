// 워크플로우 정의 테스트
// Design Ref: SVC-WORKFLOW-R20 Plan
// Plan SC: FR-WF.1
// CSAP: D-06 침해사고 관리

import { describe, it, expect } from 'vitest';
import { defineWorkflow } from '../src/workflow-definition.js';

describe('defineWorkflow', () => {
  it('유효한 워크플로우 정의를 반환한다', () => {
    const workflow = defineWorkflow({
      name: 'test-workflow',
      version: '1.0.0',
      steps: [
        {
          name: 'step-1',
          execute: async () => ({ result: 'ok' }),
        },
      ],
    });

    expect(workflow.name).toBe('test-workflow');
    expect(workflow.version).toBe('1.0.0');
    expect(workflow.steps).toHaveLength(1);
    expect(workflow.defaultMaxRetries).toBe(3);
    expect(workflow.defaultTimeoutMs).toBe(30_000);
    expect(workflow.defaultRetryDelayMs).toBe(100);
  });

  it('기본값을 오버라이드할 수 있다', () => {
    const workflow = defineWorkflow({
      name: 'custom-defaults',
      version: '1.0.0',
      defaultMaxRetries: 5,
      defaultTimeoutMs: 60_000,
      defaultRetryDelayMs: 200,
      steps: [{ name: 'step-1', execute: async () => {} }],
    });

    expect(workflow.defaultMaxRetries).toBe(5);
    expect(workflow.defaultTimeoutMs).toBe(60_000);
    expect(workflow.defaultRetryDelayMs).toBe(200);
  });

  it('이름 없는 워크플로우는 거부한다', () => {
    expect(() =>
      defineWorkflow({
        name: '',
        version: '1.0.0',
        steps: [{ name: 'step-1', execute: async () => {} }],
      }),
    ).toThrow('워크플로우 이름은 필수입니다');
  });

  it('버전 없는 워크플로우는 거부한다', () => {
    expect(() =>
      defineWorkflow({
        name: 'test',
        version: '',
        steps: [{ name: 'step-1', execute: async () => {} }],
      }),
    ).toThrow('워크플로우 버전은 필수입니다');
  });

  it('단계 없는 워크플로우는 거부한다', () => {
    expect(() =>
      defineWorkflow({
        name: 'test',
        version: '1.0.0',
        steps: [],
      }),
    ).toThrow('워크플로우에 최소 1개 단계가 필요합니다');
  });

  it('중복 단계 이름을 거부한다', () => {
    expect(() =>
      defineWorkflow({
        name: 'test',
        version: '1.0.0',
        steps: [
          { name: 'step-1', execute: async () => {} },
          { name: 'step-1', execute: async () => {} },
        ],
      }),
    ).toThrow('단계 이름 중복: step-1');
  });

  it('이름 없는 단계를 거부한다', () => {
    expect(() =>
      defineWorkflow({
        name: 'test',
        version: '1.0.0',
        steps: [{ name: '', execute: async () => {} }],
      }),
    ).toThrow('단계 이름은 필수입니다');
  });

  it('다단계 워크플로우를 정의할 수 있다', () => {
    const workflow = defineWorkflow({
      name: 'multi-step',
      version: '1.0.0',
      description: '다단계 워크플로우 테스트',
      steps: [
        {
          name: 'create-user',
          execute: async () => ({ userId: 'u-1' }),
          compensate: async () => {},
        },
        {
          name: 'create-tenant',
          execute: async () => ({ tenantId: 't-1' }),
          compensate: async () => {},
          maxRetries: 5,
          timeoutMs: 10_000,
        },
        {
          name: 'send-notification',
          execute: async () => {},
        },
      ],
    });

    expect(workflow.steps).toHaveLength(3);
    expect(workflow.steps[1]!.maxRetries).toBe(5);
    expect(workflow.steps[1]!.timeoutMs).toBe(10_000);
    expect(workflow.steps[2]!.compensate).toBeUndefined();
  });
});
