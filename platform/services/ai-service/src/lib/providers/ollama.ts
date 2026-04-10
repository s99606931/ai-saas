// Ollama 제공자 (로컬 AI 모델 서버)
// Ollama API 형식: POST /api/chat (OpenAI 호환 아님)
// 멀티모달 모델(llava 등) 이미지 입력: images 배열 (base64)
// Design Ref: SVC-AI-R3 DESIGN §1, §2, §4

import type {
  LLMProvider,
  LLMMessage,
  LLMChatOptions,
  LLMResponse,
  LLMConfig,
  LLMStreamChunk,
  LLMEmbedResponse,
} from '../llm-provider.js';

interface OllamaMessage {
  role: string;
  content: string;
  images?: string[]; // base64 인코딩 이미지 (data:... prefix 제외)
}

interface OllamaResponse {
  message: { content: string };
  model: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamChunk {
  message?: { content?: string };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbedResponse {
  embeddings: number[][];
  model: string;
  prompt_eval_count?: number;
}

interface OllamaTagsResponse {
  models: { name: string }[];
}

export class OllamaProvider implements LLMProvider {
  readonly providerType = 'ollama' as const;
  readonly isMultimodal = true; // LLaVA, BakLLaVA 등 멀티모달 모델 지원

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly defaultMaxTokens: number;
  private readonly defaultTemperature: number;
  private readonly timeoutMs: number;

  constructor(config: LLMConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model = config.model;
    this.defaultMaxTokens = config.maxTokens;
    this.defaultTemperature = config.temperature;
    this.timeoutMs = config.timeoutMs;
  }

  private makeAbortSignal(): [AbortSignal, () => void] {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    return [controller.signal, () => clearTimeout(timeoutId)];
  }

  private convertMessages(messages: LLMMessage[]): OllamaMessage[] {
    return messages.map((msg): OllamaMessage => {
      if (typeof msg.content === 'string') return { role: msg.role, content: msg.content };
      const texts: string[] = [];
      const images: string[] = [];
      for (const part of msg.content) {
        if (part.type === 'text' && part.text) {
          texts.push(part.text);
        } else if (part.type === 'image_url' && part.image_url?.url) {
          const base64Match = /^data:image\/[^;]+;base64,(.+)$/.exec(part.image_url.url);
          images.push(base64Match ? (base64Match[1] ?? '') : part.image_url.url);
        }
      }
      return {
        role: msg.role,
        content: texts.join('\n'),
        ...(images.length > 0 ? { images } : {}),
      };
    });
  }

  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const endpoint = `${this.baseUrl}/api/chat`;
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;
    const temperature = options?.temperature ?? this.defaultTemperature;
    const [signal, clearTimer] = this.makeAbortSignal();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: this.convertMessages(messages),
          stream: false,
          options: { num_predict: maxTokens, temperature },
        }),
        signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API 오류 (${response.status}): ${errorText.slice(0, 200)}`);
      }
      const data = (await response.json()) as OllamaResponse;
      const promptTokens = 0;
      const completionTokens = data.eval_count ?? 0;
      const tokensUsed = promptTokens + completionTokens > 0
        ? promptTokens + completionTokens
        : Math.ceil(data.message.content.length / 4);
      return { text: data.message.content, tokensUsed, model: data.model };
    } finally {
      clearTimer();
    }
  }

  /**
   * SSE 스트리밍 채팅 — FR-AI-R3.1
   * Ollama /api/chat stream=true 형식 (NDJSON 응답)
   */
  async *chatStream(messages: LLMMessage[], options?: LLMChatOptions): AsyncGenerator<LLMStreamChunk> {
    const endpoint = `${this.baseUrl}/api/chat`;
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;
    const temperature = options?.temperature ?? this.defaultTemperature;
    const [signal, clearTimer] = this.makeAbortSignal();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: this.convertMessages(messages),
          stream: true,
          options: { num_predict: maxTokens, temperature },
        }),
        signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama 스트림 오류 (${response.status}): ${errorText.slice(0, 200)}`);
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
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as OllamaStreamChunk;
            const promptT = chunk.prompt_eval_count ?? 0;
            const evalT = chunk.eval_count ?? 0;
            if (promptT + evalT > 0) totalTokens = promptT + evalT;
            if (chunk.done) {
              yield { text: '', done: true, tokensUsed: totalTokens };
              return;
            }
            const delta = chunk.message?.content ?? '';
            if (delta) yield { text: delta, done: false };
          } catch {
            // 파싱 실패 줄 무시
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
   * Ollama /api/embed 엔드포인트
   */
  async embed(texts: string[]): Promise<LLMEmbedResponse> {
    const endpoint = `${this.baseUrl}/api/embed`;
    const [signal, clearTimer] = this.makeAbortSignal();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama 임베딩 오류 (${response.status}): ${errorText.slice(0, 200)}`);
      }
      const data = (await response.json()) as OllamaEmbedResponse;
      const dimensions = data.embeddings[0]?.length ?? 0;
      return {
        embeddings: data.embeddings,
        model: data.model,
        dimensions,
        tokensUsed: data.prompt_eval_count ?? 0,
      };
    } finally {
      clearTimer();
    }
  }

  /**
   * 헬스체크 — FR-AI-R3.4
   * Ollama /api/tags 엔드포인트로 모델 목록 확인
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; responseTimeMs: number; models: string[] }> {
    const endpoint = `${this.baseUrl}/api/tags`;
    const start = Date.now();
    const [signal, clearTimer] = this.makeAbortSignal();
    try {
      const response = await fetch(endpoint, { signal });
      const responseTimeMs = Date.now() - start;
      if (!response.ok) return { status: 'unhealthy', responseTimeMs, models: [] };
      const data = (await response.json()) as OllamaTagsResponse;
      const models = data.models?.map((m) => m.name) ?? [];
      return { status: 'healthy', responseTimeMs, models };
    } catch {
      return { status: 'unhealthy', responseTimeMs: Date.now() - start, models: [] };
    } finally {
      clearTimer();
    }
  }
}
