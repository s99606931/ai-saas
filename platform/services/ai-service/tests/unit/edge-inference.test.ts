// SVC-AI-ADV-R38 단위 테스트: 엣지 AI 추론 매니저
// Design Ref: SVC-AI-ADV-R38 DESIGN §3, §5, §6
// Plan SC: FR-ADV38.3 (데이터 외부 유출 0), FR-ADV38.5 (N2SF 라우팅)
// CSAP: D-09 데이터 보호, N2SF C/S등급 로컬 전용

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  EdgeInferenceManager,
  getEdgeInference,
  resetEdgeInference,
  type ExternalLLMProvider,
} from '../../src/lib/edge-inference.js';
import type { LocalModelRunner } from '../../src/lib/local-model-runner.js';

// -- 목 객체 생성 ---------------------------------------------------------------

function createMockLocalRunner(options?: {
  healthy?: boolean;
  generateResponse?: string;
  chatResponse?: string;
  shouldFail?: boolean;
}): LocalModelRunner {
  const {
    healthy = true,
    generateResponse = '로컬 모델 응답입니다.',
    chatResponse = '로컬 채팅 응답입니다.',
    shouldFail = false,
  } = options ?? {};

  return {
    healthCheck: async () => healthy,
    listModels: async () => [{ name: 'llama3.2:3b', size: 2000000000, digest: 'abc', modifiedAt: '2026-01-01' }],
    generate: async (req) => {
      if (shouldFail) throw new Error('로컬 추론 실패');
      return {
        model: req.model,
        response: generateResponse,
        done: true,
        evalCount: 50,
        evalDuration: 1000000000, // 1초 (나노초)
      };
    },
    chat: async (req) => {
      if (shouldFail) throw new Error('로컬 채팅 실패');
      return {
        model: req.model,
        message: { role: 'assistant' as const, content: chatResponse },
        done: true,
        evalCount: 40,
        evalDuration: 800000000,
      };
    },
    generateStream: async (req, onToken) => {
      if (shouldFail) throw new Error('스트리밍 실패');
      const tokens = ['로컬 ', '스트리밍 ', '응답'];
      for (const t of tokens) onToken(t);
      return { model: req.model, response: tokens.join(''), done: true };
    },
    getPerformanceSummary: () => ({
      avgTokensPerSecond: 25,
      avgLatencyMs: 500,
      totalInferences: 10,
    }),
    embeddings: async () => [0.1, 0.2, 0.3],
    pullModel: async () => {},
    deleteModel: async () => {},
    hasModel: async () => true,
    warmupModel: async () => {},
    getMetrics: () => [],
  } as unknown as LocalModelRunner;
}

function createMockExternalProvider(response: string = '외부 API 응답'): ExternalLLMProvider {
  return {
    generate: async () => response,
    chat: async () => response,
  };
}

// -- N2SF 라우팅 -- Design §5 ---------------------------------------------------

describe('EdgeInferenceManager N2SF 라우팅 (FR-ADV38.5)', () => {
  let manager: EdgeInferenceManager;

  beforeEach(() => {
    manager = new EdgeInferenceManager({
      localRunner: createMockLocalRunner(),
      externalProvider: createMockExternalProvider(),
    });
  });

  it('O등급 데이터: 로컬 우선, 로컬 성공 시 로컬 반환', async () => {
    const result = await manager.infer({
      prompt: '테스트 질문',
      dataClassification: 'O',
    });
    expect(result.backend).toBe('local');
    expect(result.text).toContain('로컬');
    expect(result.dataClassification).toBe('O');
  });

  it('C등급 데이터: 로컬만 사용', async () => {
    const result = await manager.infer({
      prompt: '기밀 데이터 처리',
      dataClassification: 'C',
    });
    expect(result.backend).toBe('local');
    expect(result.dataClassification).toBe('C');
  });

  it('S등급 데이터: 로컬만 사용', async () => {
    const result = await manager.infer({
      prompt: '최고비밀 처리',
      dataClassification: 'S',
    });
    expect(result.backend).toBe('local');
  });

  it('C등급 로컬 실패: 외부 폴백 금지, 에러 발생', async () => {
    const failManager = new EdgeInferenceManager({
      localRunner: createMockLocalRunner({ shouldFail: true }),
      externalProvider: createMockExternalProvider(),
      localRetries: 0,
    });

    await expect(failManager.infer({
      prompt: '기밀 처리',
      dataClassification: 'C',
    })).rejects.toThrow('외부 API 전송 금지');
  });

  it('S등급 로컬 실패: 외부 폴백 금지, 에러 발생', async () => {
    const failManager = new EdgeInferenceManager({
      localRunner: createMockLocalRunner({ shouldFail: true }),
      externalProvider: createMockExternalProvider(),
      localRetries: 0,
    });

    await expect(failManager.infer({
      prompt: '비밀 처리',
      dataClassification: 'S',
    })).rejects.toThrow('외부 API 전송 금지');
  });

  it('O등급 로컬 실패: 외부 API로 폴백', async () => {
    const fallbackManager = new EdgeInferenceManager({
      localRunner: createMockLocalRunner({ shouldFail: true }),
      externalProvider: createMockExternalProvider('외부 폴백 응답'),
      localRetries: 0,
    });

    const result = await fallbackManager.infer({
      prompt: '공개 질문',
      dataClassification: 'O',
    });
    expect(result.backend).toBe('external');
    expect(result.text).toContain('외부 폴백');
  });
});

// -- 추론 실행 -- Design §3 -----------------------------------------------------

describe('EdgeInferenceManager 추론 실행 (FR-ADV38.3)', () => {
  it('텍스트 생성 모드', async () => {
    const manager = new EdgeInferenceManager({
      localRunner: createMockLocalRunner({ generateResponse: '생성된 텍스트' }),
    });

    const result = await manager.infer({
      prompt: '무엇이든 생성해줘',
      dataClassification: 'O',
    });
    expect(result.text).toBe('생성된 텍스트');
    expect(result.model).toBeTruthy();
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('채팅 모드', async () => {
    const manager = new EdgeInferenceManager({
      localRunner: createMockLocalRunner({ chatResponse: '채팅 응답 텍스트' }),
    });

    const result = await manager.infer({
      messages: [
        { role: 'user', content: '안녕하세요' },
      ],
      dataClassification: 'O',
    });
    expect(result.text).toBe('채팅 응답 텍스트');
    expect(result.backend).toBe('local');
  });

  it('선호 모델을 지정한다', async () => {
    const manager = new EdgeInferenceManager({
      localRunner: createMockLocalRunner(),
    });

    const result = await manager.infer({
      prompt: '테스트',
      dataClassification: 'O',
      preferredModel: 'custom-model:7b',
    });
    expect(result.model).toBe('custom-model:7b');
  });

  it('재시도 후 성공', async () => {
    let attempts = 0;
    const retryRunner = createMockLocalRunner();
    const originalGenerate = retryRunner.generate.bind(retryRunner);
    retryRunner.generate = async (req) => {
      attempts++;
      if (attempts <= 1) throw new Error('일시적 실패');
      return originalGenerate(req);
    };

    const manager = new EdgeInferenceManager({
      localRunner: retryRunner,
      localRetries: 2,
    });

    const result = await manager.infer({
      prompt: '재시도 테스트',
      dataClassification: 'O',
    });
    expect(result.backend).toBe('local');
    expect(attempts).toBe(2);
  });
});

// -- 외부 LLM 폴백 -------------------------------------------------------------

describe('EdgeInferenceManager 외부 LLM 폴백', () => {
  it('외부 프로바이더 미설정 + 로컬 실패: 에러', async () => {
    const manager = new EdgeInferenceManager({
      localRunner: createMockLocalRunner({ shouldFail: true }),
      localRetries: 0,
      // externalProvider 미설정
    });

    await expect(manager.infer({
      prompt: '질문',
      dataClassification: 'O',
    })).rejects.toThrow('사용 가능한 백엔드 없음');
  });

  it('외부 채팅 모드 폴백', async () => {
    const manager = new EdgeInferenceManager({
      localRunner: createMockLocalRunner({ shouldFail: true }),
      externalProvider: createMockExternalProvider('외부 채팅 응답'),
      localRetries: 0,
    });

    const result = await manager.infer({
      messages: [{ role: 'user', content: '외부 채팅' }],
      dataClassification: 'O',
    });
    expect(result.backend).toBe('external');
    expect(result.text).toBe('외부 채팅 응답');
  });
});

// -- 성능 요약 -- Design §6 -----------------------------------------------------

describe('EdgeInferenceManager 성능 (FR-ADV38.6)', () => {
  it('성능 요약을 반환한다', () => {
    const manager = new EdgeInferenceManager({
      localRunner: createMockLocalRunner(),
    });

    const summary = manager.getPerformanceSummary();
    expect(summary.avgTokensPerSecond).toBe(25);
    expect(summary.avgLatencyMs).toBe(500);
    expect(summary.totalInferences).toBe(10);
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('EdgeInferenceManager 팩토리', () => {
  afterEach(() => {
    resetEdgeInference();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const e1 = getEdgeInference();
    const e2 = getEdgeInference();
    expect(e1).toBe(e2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const e1 = getEdgeInference();
    resetEdgeInference();
    const e2 = getEdgeInference();
    expect(e1).not.toBe(e2);
  });
});
