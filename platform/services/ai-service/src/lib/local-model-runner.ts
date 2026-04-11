// 로컬 모델 실행기 (Ollama 클라이언트) -- FR-ADV38.1, FR-ADV38.2, FR-ADV38.4
// Design Ref: SVC-AI-ADV-R38 DESIGN §1, §2, §4
// Plan SC: SC-1 (Ollama 연동), SC-2 (모델 관리)
// CSAP: D-09 전송 보안, N2SF 로컬 전용 처리

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** Ollama 연결 설정 */
export interface OllamaConfig {
  /** Ollama 서버 URL (기본: http://localhost:11434) */
  baseUrl: string;
  /** 요청 타임아웃 (ms) */
  timeout: number;
}

/** 로컬 모델 정보 */
export interface LocalModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
  details?: {
    format: string;
    family: string;
    parameterSize: string;
    quantizationLevel: string;
  };
}

/** 생성 요청 */
export interface GenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
}

/** 채팅 메시지 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 채팅 요청 */
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
}

/** 임베딩 요청 */
export interface EmbeddingRequest {
  model: string;
  prompt: string;
}

/** 생성 응답 */
export interface GenerateResponse {
  model: string;
  response: string;
  done: boolean;
  totalDuration?: number;
  loadDuration?: number;
  promptEvalCount?: number;
  evalCount?: number;
  evalDuration?: number;
}

/** 채팅 응답 */
export interface ChatResponse {
  model: string;
  message: ChatMessage;
  done: boolean;
  totalDuration?: number;
  evalCount?: number;
  evalDuration?: number;
}

/** 임베딩 응답 */
export interface EmbeddingResponse {
  embedding: number[];
}

/** 성능 메트릭 -- Design §6 */
export interface InferenceMetrics {
  model: string;
  tokensPerSecond: number;
  totalDurationMs: number;
  loadDurationMs: number;
  promptTokens: number;
  completionTokens: number;
  timestamp: string;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  timeout: 120_000, // 2분 (로컬 추론은 느릴 수 있음)
};

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'local-model-runner',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- LocalModelRunner 메인 클래스 ─────────────────────────────────────────────

/** Ollama 기반 로컬 모델 실행기 -- Design §1 */
export class LocalModelRunner {
  private readonly config: OllamaConfig;
  private metricsHistory: InferenceMetrics[] = [];

  constructor(config?: Partial<OllamaConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -- HTTP 유틸 ──────────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown');
        throw new Error(`Ollama API 오류 [${response.status}]: ${errorText}`);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // -- 헬스체크 ───────────────────────────────────────────────────────────

  /** Ollama 서버 상태 확인 */
  async healthCheck(): Promise<boolean> {
    try {
      await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return true;
    } catch {
      return false;
    }
  }

  // -- 모델 관리 -- Design §2 ────────────────────────────────────────────

  /** 로컬 모델 목록 조회 */
  async listModels(): Promise<LocalModel[]> {
    const result = await this.request<{ models: LocalModel[] }>('GET', '/api/tags');
    return result.models ?? [];
  }

  /** 모델 다운로드 (풀) */
  async pullModel(name: string): Promise<void> {
    auditLog('model_pull_start', { model: name });
    await this.request('POST', '/api/pull', { name, stream: false });
    auditLog('model_pull_complete', { model: name });
  }

  /** 모델 삭제 */
  async deleteModel(name: string): Promise<void> {
    await this.request('DELETE', '/api/delete', { name });
    auditLog('model_deleted', { model: name });
  }

  /** 모델 존재 여부 확인 */
  async hasModel(name: string): Promise<boolean> {
    const models = await this.listModels();
    return models.some((m) => m.name === name || m.name === `${name}:latest`);
  }

  /** 모델 사전 로드 (워밍업) */
  async warmupModel(name: string): Promise<void> {
    await this.request('POST', '/api/generate', {
      model: name,
      prompt: 'hello',
      stream: false,
    });
    auditLog('model_warmed_up', { model: name });
  }

  // -- 추론 실행 -- Design §3 ────────────────────────────────────────────

  /** 텍스트 생성 */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();

    const response = await this.request<GenerateResponse>('POST', '/api/generate', {
      model: request.model,
      prompt: request.prompt,
      system: request.system,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        top_p: request.topP ?? 0.9,
        num_predict: request.maxTokens ?? 512,
      },
    });

    this.recordMetrics(request.model, response, startTime);
    return response;
  }

  /** 채팅 완성 */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    const response = await this.request<ChatResponse>('POST', '/api/chat', {
      model: request.model,
      messages: request.messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        top_p: request.topP ?? 0.9,
        num_predict: request.maxTokens ?? 512,
      },
    });

    // 메트릭 기록
    const totalDuration = Date.now() - startTime;
    this.metricsHistory.push({
      model: request.model,
      tokensPerSecond: response.evalCount && response.evalDuration
        ? (response.evalCount / (response.evalDuration / 1e9))
        : 0,
      totalDurationMs: totalDuration,
      loadDurationMs: 0,
      promptTokens: 0,
      completionTokens: response.evalCount ?? 0,
      timestamp: new Date().toISOString(),
    });

    return response;
  }

  /** 임베딩 생성 */
  async embeddings(request: EmbeddingRequest): Promise<number[]> {
    const response = await this.request<EmbeddingResponse>('POST', '/api/embeddings', {
      model: request.model,
      prompt: request.prompt,
    });

    return response.embedding;
  }

  // -- 스트리밍 -- Design §4 ─────────────────────────────────────────────

  /** 스트리밍 텍스트 생성 */
  async generateStream(
    request: GenerateRequest,
    onToken: (token: string) => void,
  ): Promise<GenerateResponse> {
    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        system: request.system,
        stream: true,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 512,
        },
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama 스트리밍 오류: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let lastResponse: GenerateResponse | null = null;
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as GenerateResponse;
          if (parsed.response) {
            onToken(parsed.response);
            fullResponse += parsed.response;
          }
          if (parsed.done) {
            lastResponse = { ...parsed, response: fullResponse };
          }
        } catch {
          // ndjson 파싱 실패 무시
        }
      }
    }

    return lastResponse ?? { model: request.model, response: fullResponse, done: true };
  }

  // -- 성능 메트릭 -- Design §6 ──────────────────────────────────────────

  /** 성능 메트릭 기록 */
  private recordMetrics(
    model: string,
    response: GenerateResponse,
    startTime: number,
  ): void {
    const totalDuration = Date.now() - startTime;
    const tokensPerSecond = response.evalCount && response.evalDuration
      ? (response.evalCount / (response.evalDuration / 1e9))
      : 0;

    this.metricsHistory.push({
      model,
      tokensPerSecond,
      totalDurationMs: totalDuration,
      loadDurationMs: response.loadDuration ? response.loadDuration / 1e6 : 0,
      promptTokens: response.promptEvalCount ?? 0,
      completionTokens: response.evalCount ?? 0,
      timestamp: new Date().toISOString(),
    });
  }

  /** 메트릭 이력 조회 */
  getMetrics(limit?: number): InferenceMetrics[] {
    const history = [...this.metricsHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /** 평균 성능 요약 */
  getPerformanceSummary(): {
    avgTokensPerSecond: number;
    avgLatencyMs: number;
    totalInferences: number;
  } {
    const history = this.metricsHistory;
    if (history.length === 0) {
      return { avgTokensPerSecond: 0, avgLatencyMs: 0, totalInferences: 0 };
    }

    return {
      avgTokensPerSecond:
        history.reduce((s, m) => s + m.tokensPerSecond, 0) / history.length,
      avgLatencyMs:
        history.reduce((s, m) => s + m.totalDurationMs, 0) / history.length,
      totalInferences: history.length,
    };
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let runnerInstance: LocalModelRunner | null = null;

export function getLocalModelRunner(
  config?: Partial<OllamaConfig>,
): LocalModelRunner {
  if (!runnerInstance) {
    runnerInstance = new LocalModelRunner(config);
  }
  return runnerInstance;
}

export function resetLocalModelRunner(): void {
  runnerInstance = null;
}
