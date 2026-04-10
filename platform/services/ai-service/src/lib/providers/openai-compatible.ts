// OpenAI 호환 API 제공자 (OpenAI, LM Studio, vLLM)
// LM Studio는 /v1/chat/completions 엔드포인트로 OpenAI API를 완벽 호환
// google/gemma-4-26b-a4b 등 멀티모달 모델의 이미지 입력을 지원합니다

import type { LLMProvider, LLMProviderType, LLMMessage, LLMChatOptions, LLMResponse, LLMConfig } from '../llm-provider.js';

interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface OpenAIMessage {
  role: string;
  content: string | OpenAIContentPart[];
}

interface OpenAIChoice {
  message: {
    content: string;
    reasoning_content?: string; // Thinking 모델 (gemma-4, qwen3 등) 사고 과정
  };
}

interface OpenAIUsage {
  total_tokens: number;
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
  model: string;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly providerType: LLMProviderType;
  readonly isMultimodal = true; // LM Studio + Gemma 4 멀티모달 지원 (텍스트 + 이미지)

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly defaultMaxTokens: number;
  private readonly defaultTemperature: number;
  private readonly timeoutMs: number;

  constructor(config: LLMConfig) {
    this.providerType = config.providerType;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.defaultMaxTokens = config.maxTokens;
    this.defaultTemperature = config.temperature;
    this.timeoutMs = config.timeoutMs;
  }

  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const endpoint = `${this.baseUrl}/v1/chat/completions`;
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;
    const temperature = options?.temperature ?? this.defaultTemperature;

    // LLMMessage → OpenAI 형식 변환 (content 타입 유지)
    const openAIMessages: OpenAIMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((part): OpenAIContentPart => {
            if (part.type === 'text') {
              return { type: 'text', text: part.text };
            }
            return { type: 'image_url', image_url: part.image_url };
          }),
    }));

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: openAIMessages,
          max_tokens: maxTokens,
          temperature,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API 오류 (${response.status}): ${errorText.slice(0, 200)}`);
      }

      const data = (await response.json()) as OpenAIResponse;
      const choice = data.choices[0];
      if (!choice) {
        throw new Error('LLM 응답에 선택지가 없습니다');
      }

      // Thinking 모델(gemma-4, qwen3 등)은 reasoning_content에 사고를 담고
      // 최종 답변만 content에 출력합니다. content가 비어있으면 max_tokens 부족 → LLM_MAX_TOKENS 증가 필요
      const responseText = choice.message.content;
      return {
        text: responseText,
        tokensUsed: data.usage?.total_tokens ?? Math.ceil(responseText.length / 4),
        model: data.model ?? this.model,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
