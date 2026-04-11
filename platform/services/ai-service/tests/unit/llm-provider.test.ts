// LLM 제공자 추상화 레이어 단위 테스트
// Design Ref: SVC-AI-R3 DESIGN
// Plan SC: FR-AI-R3.1~R3.4
// CSAP: N2SF N-05 C/S등급 데이터 전송 금지

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { getLLMConfig, buildLLMConfig } from '../../src/lib/llm-provider.js';

// -- 환경 변수 백업/복원 --------------------------------------------------------

const originalEnv: Record<string, string | undefined> = {};
const envKeys = [
  'LLM_PROVIDER',
  'LLM_BASE_URL',
  'LLM_MODEL',
  'LLM_API_KEY',
  'LLM_MAX_TOKENS',
  'LLM_TEMPERATURE',
  'LLM_TIMEOUT_MS',
];

function saveEnv() {
  for (const key of envKeys) {
    originalEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
}

function clearLLMEnv() {
  for (const key of envKeys) {
    delete process.env[key];
  }
}

// -- getLLMConfig 기본값 -------------------------------------------------------

describe('getLLMConfig', () => {
  beforeEach(() => {
    saveEnv();
    clearLLMEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('기본값을 반환한다', () => {
    const config = getLLMConfig();
    expect(config.providerType).toBe('lmstudio');
    expect(config.baseUrl).toBe('http://192.168.0.104:1234');
    expect(config.model).toBe('google/gemma-4-26b-a4b');
    expect(config.maxTokens).toBe(4096);
    expect(config.temperature).toBeCloseTo(0.7, 1);
    expect(config.timeoutMs).toBe(60000);
  });

  it('환경 변수를 반영한다', () => {
    process.env['LLM_PROVIDER'] = 'openai';
    process.env['LLM_BASE_URL'] = 'https://api.openai.com/v1';
    process.env['LLM_MODEL'] = 'gpt-4o';
    process.env['LLM_API_KEY'] = 'sk-test-key';
    process.env['LLM_MAX_TOKENS'] = '8192';
    process.env['LLM_TEMPERATURE'] = '0.3';
    process.env['LLM_TIMEOUT_MS'] = '120000';

    const config = getLLMConfig();
    expect(config.providerType).toBe('openai');
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.model).toBe('gpt-4o');
    expect(config.apiKey).toBe('sk-test-key');
    expect(config.maxTokens).toBe(8192);
    expect(config.temperature).toBeCloseTo(0.3, 1);
    expect(config.timeoutMs).toBe(120000);
  });

  it('apiKey 미설정 시 undefined', () => {
    const config = getLLMConfig();
    expect(config.apiKey).toBeUndefined();
  });
});

// -- buildLLMConfig -----------------------------------------------------------

describe('buildLLMConfig', () => {
  beforeEach(() => {
    saveEnv();
    clearLLMEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('DB 모델 정보로 설정을 생성한다', () => {
    const config = buildLLMConfig({
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      name: 'llama3.2:3b',
    });
    expect(config.providerType).toBe('ollama');
    expect(config.baseUrl).toBe('http://localhost:11434');
    expect(config.model).toBe('llama3.2:3b');
  });

  it('config 필드로 추가 설정을 오버라이드한다', () => {
    const config = buildLLMConfig({
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      name: 'gpt-4o',
      config: {
        apiKey: 'sk-override-key',
        maxTokens: 16384,
        temperature: 0.1,
        timeoutMs: 90000,
        modelId: 'gpt-4o-2024-08-06',
      },
    });
    expect(config.apiKey).toBe('sk-override-key');
    expect(config.maxTokens).toBe(16384);
    expect(config.temperature).toBeCloseTo(0.1, 1);
    expect(config.timeoutMs).toBe(90000);
    expect(config.model).toBe('gpt-4o-2024-08-06');
  });

  it('config가 null이면 기본값 사용', () => {
    const config = buildLLMConfig({
      provider: 'vllm',
      endpoint: 'http://localhost:8000',
      name: 'model-v1',
      config: null,
    });
    expect(config.maxTokens).toBe(4096); // 환경 변수 기본값
    expect(config.model).toBe('model-v1'); // name이 사용됨
  });

  it('환경 변수 기본값과 DB 설정을 병합한다', () => {
    process.env['LLM_API_KEY'] = 'env-key';
    process.env['LLM_MAX_TOKENS'] = '2048';

    const config = buildLLMConfig({
      provider: 'openai',
      endpoint: 'https://api.example.com',
      name: 'custom',
      config: {
        maxTokens: 4096, // config에서 오버라이드
        // apiKey 미설정 → 환경 변수 사용
      },
    });
    expect(config.apiKey).toBe('env-key'); // 환경 변수
    expect(config.maxTokens).toBe(4096); // config 오버라이드
  });
});
