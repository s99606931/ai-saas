// SVC-AI-ADV-R39: TTS 처리기 (텍스트→음성)
// Design Ref: §모듈 구성, §인터페이스 시그니처
// Plan SC: FR-R39.2
//
// 로컬 VITS-Korean 모델 기반 TTS. 발화 전 ai-guardrails 검증 필수.

export type VoiceType = 'female-ko' | 'male-ko' | 'female-en' | 'male-en'

export interface TTSOptions {
  voice?: VoiceType
  speed?: number  // 0.5 ~ 2.0
  pitch?: number  // -10 ~ 10
}

export interface TTSResult {
  audio: Buffer
  durationMs: number
  voice: VoiceType
  textLength: number
}

/**
 * TTS 처리기 — 로컬 VITS-Korean 모델 래퍼.
 * 공공기관 민원 응대 음성 합성에 사용된다.
 */
export class TTSProcessor {
  private readonly _modelEndpoint: string
  private readonly safetyChecker?: (text: string) => Promise<boolean>

  constructor(modelEndpoint?: string, safetyChecker?: (text: string) => Promise<boolean>) {
    this._modelEndpoint = modelEndpoint ?? process.env.VITS_LOCAL_ENDPOINT ?? 'http://host.docker.internal:9101/tts'
    void this._modelEndpoint
    this.safetyChecker = safetyChecker
  }

  /**
   * 텍스트를 음성으로 합성한다. 발화 전 안전성 검증 필수.
   */
  async synthesize(text: string, opts: TTSOptions = {}): Promise<TTSResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('TTS input empty')
    }
    if (text.length > 5000) {
      throw new Error('TTS input too long (max 5000 chars per request)')
    }

    const safe = await this.validateSafety(text)
    if (!safe) {
      throw new Error('BLOCKED: TTS 안전성 검증 실패 (ai-guardrails)')
    }

    const voice = opts.voice ?? 'female-ko'
    const start = Date.now()
    const audio = await this.invokeLocalModel(text, voice, opts.speed ?? 1.0, opts.pitch ?? 0)

    return {
      audio,
      durationMs: Date.now() - start,
      voice,
      textLength: text.length,
    }
  }

  /**
   * 발화 텍스트의 안전성을 검증한다.
   * ai-guardrails 연동 또는 내장 필터로 독성/개인정보 포함 여부를 체크.
   */
  async validateSafety(text: string): Promise<boolean> {
    if (this.safetyChecker) {
      return this.safetyChecker(text)
    }
    return this.builtinSafetyCheck(text)
  }

  private builtinSafetyCheck(text: string): boolean {
    // 주민등록번호 형식 차단
    if (/\d{6}-?\d{7}/.test(text)) return false
    // 카드번호 형식 차단
    if (/\d{4}-?\d{4}-?\d{4}-?\d{4}/.test(text)) return false
    // 욕설/공격성 단어 차단 (간단 목록)
    const blocked = ['욕설1', '욕설2']  // 실제 배포 시 확장
    return !blocked.some((w) => text.includes(w))
  }

  private async invokeLocalModel(
    text: string,
    voice: VoiceType,
    speed: number,
    pitch: number,
  ): Promise<Buffer> {
    // NOTE: 스텁 구현. Phase 2에서 실제 VITS ONNX runtime 연결 예정.
    const header = `[TTS:${voice}:${speed}:${pitch}]`
    return Buffer.from(header + text)
  }
}

export function createTTSProcessor(
  endpoint?: string,
  safetyChecker?: (text: string) => Promise<boolean>,
): TTSProcessor {
  return new TTSProcessor(endpoint, safetyChecker)
}
