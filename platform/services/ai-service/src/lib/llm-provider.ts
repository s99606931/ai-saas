// LLM 제공자 추상화 레이어
// CSAP: N2SF N-05 — C/S등급 데이터 전송 절대 금지 (호출 전 등급 검증 완료 가정)
// 지원 제공자: openai | ollama | vllm | lmstudio

export type LLMProviderType = 'openai' | 'ollama' | 'vllm' | 'lmstudio';

export interface LLMContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LLMContentPart[];
}

export interface LLMChatOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  text: string;
  tokensUsed: number;
  model: string;
}

export interface LLMProvider {
  readonly providerType: LLMProviderType;
  readonly isMultimodal: boolean;
  chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse>;
}

export interface LLMConfig {
  providerType: LLMProviderType;
  baseUrl: string;
  model: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

/**
 * 환경 변수에서 기본 LLM 설정을 읽어옵니다.
 * 모델별 설정은 DB의 AiModel 레코드가 우선합니다.
 */
export function getLLMConfig(): LLMConfig {
  const providerType = (process.env['LLM_PROVIDER'] ?? 'lmstudio') as LLMProviderType;
  const baseUrl = process.env['LLM_BASE_URL'] ?? 'http://192.168.0.104:1234';
  const model = process.env['LLM_MODEL'] ?? 'google/gemma-4-26b-a4b';
  const apiKey = process.env['LLM_API_KEY'];
  // Thinking 모델(gemma-4, qwen3 등)은 추론에 많은 토큰을 사용하므로 기본값 4096 권장
  const maxTokens = parseInt(process.env['LLM_MAX_TOKENS'] ?? '4096', 10);
  const temperature = parseFloat(process.env['LLM_TEMPERATURE'] ?? '0.7');
  const timeoutMs = parseInt(process.env['LLM_TIMEOUT_MS'] ?? '30000', 10);

  return { providerType, baseUrl, model, apiKey, maxTokens, temperature, timeoutMs };
}

/**
 * DB의 AiModel 레코드 정보를 환경 변수 기본값에 오버레이하여 설정 생성
 */
export function buildLLMConfig(dbModel: {
  provider: string;
  endpoint: string;
  name: string;
  config?: unknown;
}): LLMConfig {
  const envConfig = getLLMConfig();

  // AiModel의 config 필드에 추가 설정이 있으면 우선 적용
  const modelConfig = (dbModel.config as Record<string, unknown> | null) ?? {};
  const apiKey = (modelConfig['apiKey'] as string | undefined) ?? envConfig.apiKey;
  const maxTokens = (modelConfig['maxTokens'] as number | undefined) ?? envConfig.maxTokens;
  const temperature = (modelConfig['temperature'] as number | undefined) ?? envConfig.temperature;

  return {
    providerType: dbModel.provider as LLMProviderType,
    baseUrl: dbModel.endpoint,
    model: (modelConfig['modelId'] as string | undefined) ?? dbModel.name,
    apiKey,
    maxTokens,
    temperature,
    timeoutMs: (modelConfig['timeoutMs'] as number | undefined) ?? envConfig.timeoutMs,
  };
}

/**
 * LLM 제공자 팩토리: providerType에 따라 적절한 구현체를 반환
 */
export async function createLLMProvider(config: LLMConfig): Promise<LLMProvider> {
  switch (config.providerType) {
    case 'openai':
    case 'vllm':
    case 'lmstudio': {
      const { OpenAICompatibleProvider } = await import('./providers/openai-compatible.js');
      return new OpenAICompatibleProvider(config);
    }
    case 'ollama': {
      const { OllamaProvider } = await import('./providers/ollama.js');
      return new OllamaProvider(config);
    }
    default: {
      const exhaustive: never = config.providerType;
      throw new Error(`지원하지 않는 LLM 제공자: ${String(exhaustive)}`);
    }
  }
}
