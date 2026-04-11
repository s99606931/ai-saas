// 엣지 AI 추론 매니저 -- FR-ADV38.3, FR-ADV38.5, FR-ADV38.6
// Design Ref: SVC-AI-ADV-R38 DESIGN §3, §5, §6
// Plan SC: SC-3 (데이터 외부 유출 0), SC-6 (성능 모니터링)
// CSAP: D-09 데이터 보호, N2SF C/S등급 로컬 전용

import {
  LocalModelRunner,
  getLocalModelRunner,
  type ChatMessage,
} from './local-model-runner';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** N2SF 데이터 등급 */
export type DataClassification = 'O' | 'C' | 'S';

/** 추론 요청 */
export interface InferenceRequest {
  /** 프롬프트 또는 메시지 */
  prompt?: string;
  messages?: ChatMessage[];
  /** 데이터 등급 (N2SF) */
  dataClassification: DataClassification;
  /** 선호 모델 (로컬) */
  preferredModel?: string;
  /** 외부 모델 (폴백용) */
  externalModel?: string;
  /** 설정 */
  temperature?: number;
  maxTokens?: number;
  /** 스트리밍 */
  stream?: boolean;
  onToken?: (token: string) => void;
}

/** 추론 응답 */
export interface InferenceResponse {
  text: string;
  model: string;
  backend: 'local' | 'external';
  tokensPerSecond?: number;
  totalDurationMs: number;
  dataClassification: DataClassification;
}

/** 외부 LLM 프로바이더 */
export interface ExternalLLMProvider {
  generate: (prompt: string, model: string) => Promise<string>;
  chat: (messages: ChatMessage[], model: string) => Promise<string>;
}

/** 엣지 추론 설정 */
export interface EdgeInferenceConfig {
  /** 기본 로컬 모델 */
  defaultLocalModel: string;
  /** 기본 외부 모델 */
  defaultExternalModel: string;
  /** 외부 LLM 프로바이더 (O등급 폴백용) */
  externalProvider?: ExternalLLMProvider;
  /** 로컬 모델 실행기 */
  localRunner?: LocalModelRunner;
  /** 로컬 폴백 재시도 횟수 */
  localRetries: number;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: EdgeInferenceConfig = {
  defaultLocalModel: 'llama3.2:3b',
  defaultExternalModel: 'claude-sonnet-4-6',
  localRetries: 2,
};

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'edge-inference',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- EdgeInferenceManager 메인 클래스 ─────────────────────────────────────────

/** 엣지 AI 추론 매니저 -- Design §3, §5 */
export class EdgeInferenceManager {
  private readonly config: EdgeInferenceConfig;
  private readonly localRunner: LocalModelRunner;

  constructor(config?: Partial<EdgeInferenceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.localRunner = config?.localRunner ?? getLocalModelRunner();
  }

  // -- N2SF 라우팅 -- Design §5 ──────────────────────────────────────────

  /** 데이터 등급 기반 라우팅 결정 */
  private canUseExternal(classification: DataClassification): boolean {
    // C/S등급: 절대 외부 전송 금지 (N2SF 필수)
    if (classification === 'C' || classification === 'S') {
      return false;
    }
    // O등급: 외부 API 사용 가능
    return true;
  }

  // -- 추론 실행 -- Design §3 ────────────────────────────────────────────

  /** 통합 추론 실행 (N2SF 기반 자동 라우팅) */
  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();
    const localModel = request.preferredModel ?? this.config.defaultLocalModel;

    // 1. 로컬 추론 시도
    for (let attempt = 0; attempt <= this.config.localRetries; attempt++) {
      try {
        const result = await this.inferLocal(request, localModel);

        auditLog('inference_local_success', {
          model: localModel,
          dataClassification: request.dataClassification,
          duration: Date.now() - startTime,
        });

        return {
          ...result,
          totalDurationMs: Date.now() - startTime,
          dataClassification: request.dataClassification,
        };
      } catch (error) {
        if (attempt < this.config.localRetries) continue;

        auditLog('inference_local_failed', {
          model: localModel,
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 2. 폴백: 외부 API (O등급만)
    if (this.canUseExternal(request.dataClassification) && this.config.externalProvider) {
      const externalModel = request.externalModel ?? this.config.defaultExternalModel;

      auditLog('inference_external_fallback', {
        model: externalModel,
        dataClassification: request.dataClassification,
      });

      try {
        const result = await this.inferExternal(request, externalModel);
        return {
          ...result,
          totalDurationMs: Date.now() - startTime,
          dataClassification: request.dataClassification,
        };
      } catch (error) {
        throw new Error(
          `로컬 및 외부 추론 모두 실패: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // C/S등급인데 로컬 실패: 오류 (외부 전송 금지)
    if (!this.canUseExternal(request.dataClassification)) {
      auditLog('inference_blocked', {
        reason: `${request.dataClassification}등급 데이터: 로컬 실패 시 외부 전송 금지`,
      });
      throw new Error(
        `${request.dataClassification}등급 데이터: 로컬 추론 실패. 외부 API 전송 금지 (N2SF)`,
      );
    }

    throw new Error('추론 실행 실패: 사용 가능한 백엔드 없음');
  }

  // -- 로컬 추론 ─────────────────────────────────────────────────────────

  /** 로컬(Ollama) 추론 실행 */
  private async inferLocal(
    request: InferenceRequest,
    model: string,
  ): Promise<Omit<InferenceResponse, 'totalDurationMs' | 'dataClassification'>> {
    if (request.messages && request.messages.length > 0) {
      // 채팅 모드
      if (request.stream && request.onToken) {
        // 스트리밍은 generate로 대체 (채팅 프롬프트 변환)
        const prompt = request.messages
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n') + '\nassistant:';

        let fullText = '';
        await this.localRunner.generateStream(
          { model, prompt, temperature: request.temperature, maxTokens: request.maxTokens },
          (token) => {
            fullText += token;
            request.onToken!(token);
          },
        );

        return { text: fullText, model, backend: 'local' };
      }

      const chatResponse = await this.localRunner.chat({
        model,
        messages: request.messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      });

      return {
        text: chatResponse.message.content,
        model,
        backend: 'local',
        tokensPerSecond: chatResponse.evalCount && chatResponse.evalDuration
          ? chatResponse.evalCount / (chatResponse.evalDuration / 1e9)
          : undefined,
      };
    }

    // 텍스트 생성 모드
    const prompt = request.prompt ?? '';

    if (request.stream && request.onToken) {
      let fullText = '';
      await this.localRunner.generateStream(
        { model, prompt, temperature: request.temperature, maxTokens: request.maxTokens },
        (token) => {
          fullText += token;
          request.onToken!(token);
        },
      );

      return { text: fullText, model, backend: 'local' };
    }

    const response = await this.localRunner.generate({
      model,
      prompt,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });

    return {
      text: response.response,
      model,
      backend: 'local',
      tokensPerSecond: response.evalCount && response.evalDuration
        ? response.evalCount / (response.evalDuration / 1e9)
        : undefined,
    };
  }

  // -- 외부 추론 ─────────────────────────────────────────────────────────

  /** 외부 LLM API 추론 (O등급만) */
  private async inferExternal(
    request: InferenceRequest,
    model: string,
  ): Promise<Omit<InferenceResponse, 'totalDurationMs' | 'dataClassification'>> {
    if (!this.config.externalProvider) {
      throw new Error('외부 LLM 프로바이더 미설정');
    }

    let text: string;
    if (request.messages && request.messages.length > 0) {
      text = await this.config.externalProvider.chat(request.messages, model);
    } else {
      text = await this.config.externalProvider.generate(request.prompt ?? '', model);
    }

    return { text, model, backend: 'external' };
  }

  // -- 헬스체크 ───────────────────────────────────────────────────────────

  /** 로컬 추론 엔진 상태 확인 */
  async healthCheck(): Promise<{
    localAvailable: boolean;
    externalAvailable: boolean;
    localModels: string[];
  }> {
    const localAvailable = await this.localRunner.healthCheck();
    const localModels = localAvailable
      ? (await this.localRunner.listModels()).map((m) => m.name)
      : [];

    return {
      localAvailable,
      externalAvailable: !!this.config.externalProvider,
      localModels,
    };
  }

  // -- 성능 요약 ─────────────────────────────────────────────────────────

  /** 로컬 모델 성능 요약 */
  getPerformanceSummary() {
    return this.localRunner.getPerformanceSummary();
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let managerInstance: EdgeInferenceManager | null = null;

export function getEdgeInference(
  config?: Partial<EdgeInferenceConfig>,
): EdgeInferenceManager {
  if (!managerInstance) {
    managerInstance = new EdgeInferenceManager(config);
  }
  return managerInstance;
}

export function resetEdgeInference(): void {
  managerInstance = null;
}
