// Ollama 제공자 (로컬 AI 모델 서버)
// Ollama API 형식: POST /api/chat (OpenAI 호환 아님)
// 멀티모달 모델(llava 등) 이미지 입력: images 배열 (base64)

import type { LLMProvider, LLMMessage, LLMChatOptions, LLMResponse, LLMConfig } from '../llm-provider.js';

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

  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const endpoint = `${this.baseUrl}/api/chat`;
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;
    const temperature = options?.temperature ?? this.defaultTemperature;

    // Ollama 형식으로 변환: 멀티파트 콘텐츠의 이미지를 별도 images 배열로 분리
    const ollamaMessages: OllamaMessage[] = messages.map((msg): OllamaMessage => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }
      const texts: string[] = [];
      const images: string[] = [];
      for (const part of msg.content) {
        if (part.type === 'text' && part.text) {
          texts.push(part.text);
        } else if (part.type === 'image_url' && part.image_url?.url) {
          // "data:image/jpeg;base64,<data>" 형식에서 base64 본문만 추출
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: ollamaMessages,
          stream: false,
          options: {
            num_predict: maxTokens,
            temperature,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API 오류 (${response.status}): ${errorText.slice(0, 200)}`);
      }

      const data = (await response.json()) as OllamaResponse;
      const promptTokens = data.prompt_eval_count ?? 0;
      const completionTokens = data.eval_count ?? 0;
      const tokensUsed = promptTokens + completionTokens > 0
        ? promptTokens + completionTokens
        : Math.ceil(data.message.content.length / 4);

      return {
        text: data.message.content,
        tokensUsed,
        model: data.model,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
