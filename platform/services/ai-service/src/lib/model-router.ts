// 스마트 모델 라우터 — FR-AI-R3.3
// Design Ref: SVC-AI-R3 DESIGN §3
// 요청 유형(chat/embed/multimodal)에 따라 적절한 모델 자동 선택

import type { LLMModelType } from './llm-provider.js';

// 임베딩 모델 패턴 (이름 기반 감지)
const EMBED_MODEL_PATTERNS = [
  /embed/i,
  /embedding/i,
  /e5-/i,
  /bge-/i,
  /nomic-embed/i,
  /text2vec/i,
  /sentence-transformer/i,
];

// 멀티모달 모델 패턴
const MULTIMODAL_MODEL_PATTERNS = [
  /llava/i,
  /bakllava/i,
  /vision/i,
  /vl\b/i,       // VL: Vision-Language
  /multimodal/i,
  /gemma-4-[^-]+-it/i, // gemma-4-e4b-it 등
  /pixtral/i,
  /qwen-vl/i,
];

class ModelRouter {
  /**
   * 모델 ID에서 타입을 추론합니다.
   * DB AiModel.config.modelType 이 있으면 그것을 우선합니다.
   */
  classifyModelType(modelId: string): LLMModelType {
    if (EMBED_MODEL_PATTERNS.some((p) => p.test(modelId))) return 'embed';
    if (MULTIMODAL_MODEL_PATTERNS.some((p) => p.test(modelId))) return 'multimodal';
    return 'chat';
  }

  /**
   * 요청 유형과 사용 가능한 모델 목록에서 최적 모델을 선택합니다.
   * 요청 유형에 맞는 모델이 없으면 기본값(envDefault)을 반환합니다.
   */
  selectModel(requestType: LLMModelType, availableModels: string[], envDefault: string): string {
    const matching = availableModels.filter((m) => this.classifyModelType(m) === requestType);
    if (matching.length > 0) return matching[0] ?? envDefault;

    // 폴백: chat 요청 시 embed/multimodal이 아닌 첫 번째 모델
    if (requestType === 'chat') {
      const chatModel = availableModels.find((m) => this.classifyModelType(m) === 'chat');
      return chatModel ?? envDefault;
    }

    return envDefault;
  }
}

export const modelRouter = new ModelRouter();
