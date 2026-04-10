// OpenAI 호환 API 제공자 (OpenAI, LM Studio, vLLM)
// LM Studio는 /v1/chat/completions 엔드포인트로 OpenAI API를 완벽 호환
// google/gemma-4-26b-a4b 등 멀티모달 모델의 이미지 입력을 지원합니다
// Design Ref: SVC-AI-R3 DESIGN §1, §2, §4

import type {
  LLMProvider,
  LLMProviderType,
  LLMMessage,
  LLMChatOptions,
  LLMResponse,
  LLMConfig,
  LLMStreamChunk,
  LLMEmbedResponse,
} from '../llm-provider.js';

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

interface OpenAIStreamDelta {
  content?: string;
}

interface OpenAIStreamChoice {
  delta: OpenAIStreamDelta;
  finish_reason: string | null;
}

interface OpenAIUsage {
  total_tokens: number;
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
  model: string;
}

interface OpenAIStreamChunk {
  choices: OpenAIStreamChoice[];
  usage?: OpenAIUsage;
}

interface OpenAIEmbedding {
  embedding: number[];
  index: number;
}

interface OpenAIEmbedResponse {
  data: OpenAIEmbedding[];
  model: string;
  usage: { total_tokens: number };
}

interface OpenAIModelsResponse {
  data: { id: string }[];
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

  private get authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    return headers;
  }

  private makeAbortSignal(): [AbortSignal, () => void] {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    return [controller.signal, () => clearTimeout(timeoutId)];
  }

  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const endpoint = `${this.baseUrl}/v1/chat/completions`;
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;
    const temperature = options?.temperature ?? this.defaultTemperature;

    const openAIMessages: OpenAIMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((part): OpenAIContentPart => {
            if (part.type === 'text') return { type: 'text', text: part.text };
            return { type: 'image_url', image_url: part.image_url };
          }),
    }));

    const [signal, clearTimer] = this.makeAbortSignal();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.authHeaders,
        body: JSON.stringify({ model: this.model, messages: openAIMessages, max_tokens: maxTokens, temperature, stream: false }),
        signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API 오류 (${response.status}): ${errorText.slice(0, 200)}`);
      }
      const data = (await response.json()) as OpenAIResponse;
      const choice = data.choices[0];
      if (!choice) throw new Error('LLM 응답에 선택지가 없습니다');

      // Thinking 모델: content가 빈 경우 max_tokens 부족 → LLM_MAX_TOKENS 증가 권장
      const responseText = choice.message.content;
      return {
        text: responseText,
        tokensUsed: data.usage?.total_tokens ?? Math.ceil(responseText.length / 4),
        model: data.model ?? this.model,
      };
    } finally {
      clearTimer();
    }
  }

  /**
   * SSE 스트리밍 채팅 — FR-AI-R3.1
   * OpenAI stream=true 형식으로 실시간 토큰 스트리밍
   */
  async *chatStream(messages: LLMMessage[], options?: LLMChatOptions): AsyncGenerator<LLMStreamChunk> {
    const endpoint = `${this.baseUrl}/v1/chat/completions`;
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;
    const temperature = options?.temperature ?? this.defaultTemperature;

    const openAIMessages: OpenAIMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : msg.content,
    }));

    const [signal, clearTimer] = this.makeAbortSignal();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.authHeaders,
        body: JSON.stringify({ model: this.model, messages: openAIMessages, max_tokens: maxTokens, temperature, stream: true }),
        signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM 스트림 오류 (${response.status}): ${errorText.slice(0, 200)}`);
      }
      if (!response.body) throw new Error('스트림 응답 body가 없습니다');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let totalTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') {
            yield { text: '', done: true, tokensUsed: totalTokens };
            return;
          }
          try {
            const chunk = JSON.parse(jsonStr) as OpenAIStreamChunk;
            if (chunk.usage) totalTokens = chunk.usage.total_tokens;
            const delta = chunk.choices[0]?.delta.content ?? '';
            if (delta) yield { text: delta, done: false };
          } catch {
            // 파싱 실패 청크 무시
          }
        }
      }
      yield { text: '', done: true, tokensUsed: totalTokens };
    } finally {
      clearTimer();
    }
  }

  /**
   * 텍스트 임베딩 — FR-AI-R3.2
   * 지원 모델: text-embedding-qwen3-embedding-0.6b, text-embedding-nomic-embed-text-v1.5
   */
  async embed(texts: string[]): Promise<LLMEmbedResponse> {
    const endpoint = `${this.baseUrl}/v1/embeddings`;
    const [signal, clearTimer] = this.makeAbortSignal();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.authHeaders,
        body: JSON.stringify({ model: this.model, input: texts }),
        signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`임베딩 API 오류 (${response.status}): ${errorText.slice(0, 200)}`);
      }
      const data = (await response.json()) as OpenAIEmbedResponse;
      const sorted = [...data.data].sort((a, b) => a.index - b.index);
      const embeddings = sorted.map((e) => e.embedding);
      const dimensions = embeddings[0]?.length ?? 0;
      return {
        embeddings,
        model: data.model ?? this.model,
        dimensions,
        tokensUsed: data.usage?.total_tokens ?? 0,
      };
    } finally {
      clearTimer();
    }
  }

  /**
   * LLM 서버 헬스체크 — FR-AI-R3.4
   * /v1/models 엔드포인트로 가용성 + 응답 시간 측정
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; responseTimeMs: number; models: string[] }> {
    const endpoint = `${this.baseUrl}/v1/models`;
    const start = Date.now();
    const [signal, clearTimer] = this.makeAbortSignal();
    try {
      const response = await fetch(endpoint, { headers: this.authHeaders, signal });
      const responseTimeMs = Date.now() - start;
      if (!response.ok) {
        return { status: 'unhealthy', responseTimeMs, models: [] };
      }
      const data = (await response.json()) as OpenAIModelsResponse;
      const models = data.data?.map((m) => m.id) ?? [];
      return { status: 'healthy', responseTimeMs, models };
    } catch {
      return { status: 'unhealthy', responseTimeMs: Date.now() - start, models: [] };
    } finally {
      clearTimer();
    }
  }
}
