// SVC-AI-ADV-R39: STT 처리기 (음성→텍스트)
// Design Ref: §모듈 구성, §인터페이스 시그니처
// Plan SC: FR-R39.1, FR-R39.4
//
// 한국어 공공용어 특화 Whisper Large-v3 로컬 실행 래퍼.
// 통화 오디오(C등급)는 절대 외부 API로 전송하지 않는다 (N2SF N-05).

import { createHash } from 'crypto'

export interface STTResult {
  text: string
  confidence: number
  durationMs: number
  language: 'ko' | 'en'
}

export interface STTOptions {
  language?: 'ko' | 'en'
  applyTerminology?: boolean
  sampleRate?: number
}

/**
 * 한국어 공공기관 도메인 용어 사전.
 * STT 결과 후처리 시 오인식 교정에 사용.
 */
const PUBLIC_SECTOR_TERMS: Record<string, string> = {
  '민언': '민원',
  '행정 심판': '행정심판',
  '정보 공개': '정보공개',
  '주민 등록': '주민등록',
  '토지 대장': '토지대장',
  '건축물 대장': '건축물대장',
  '공시 지가': '공시지가',
  '지방세': '지방세',
  '국세청': '국세청',
  '전자 정부': '전자정부',
}

/**
 * STT 처리기 — Whisper Large-v3 로컬 런타임 래퍼.
 *
 * ⚠️ 통화 오디오는 C등급 데이터이므로 외부 AI API로 절대 전송 금지.
 * 모든 처리는 온프레미스 로컬 모델에서 수행된다.
 */
export class STTProcessor {
  private readonly modelEndpoint: string

  constructor(modelEndpoint?: string) {
    // 로컬 추론 서버 (host.docker.internal 포트)
    this.modelEndpoint = modelEndpoint ?? process.env.WHISPER_LOCAL_ENDPOINT ?? 'http://host.docker.internal:9100/whisper'
  }

  /**
   * 오디오 버퍼를 텍스트로 변환한다.
   * @throws 외부 API 호출 시도 감지 → 차단
   */
  async transcribe(audio: Buffer, opts: STTOptions = {}): Promise<STTResult> {
    if (!audio || audio.length === 0) {
      throw new Error('STT input empty')
    }
    if (this.isExternalEndpoint(this.modelEndpoint)) {
      throw new Error('BLOCKED: STT 외부 API 호출 금지 (N2SF N-05, C등급 데이터)')
    }

    const start = Date.now()
    const raw = await this.invokeLocalModel(audio, opts.language ?? 'ko', opts.sampleRate ?? 16000)
    const text = opts.applyTerminology === false ? raw.text : this.applyTerminology(raw.text)

    return {
      text,
      confidence: raw.confidence,
      durationMs: Date.now() - start,
      language: opts.language ?? 'ko',
    }
  }

  /**
   * 공공 용어 사전을 적용하여 STT 결과를 보정한다.
   */
  applyTerminology(text: string): string {
    let corrected = text
    for (const [wrong, right] of Object.entries(PUBLIC_SECTOR_TERMS)) {
      corrected = corrected.split(wrong).join(right)
    }
    return corrected
  }

  /**
   * 오디오 지문을 생성한다 (감사 로그 기록용, 원본 미저장).
   */
  fingerprint(audio: Buffer): string {
    return createHash('sha256').update(audio).digest('hex').slice(0, 16)
  }

  private isExternalEndpoint(url: string): boolean {
    const local = ['localhost', '127.0.0.1', 'host.docker.internal', '::1']
    try {
      const u = new URL(url)
      return !local.includes(u.hostname) && !u.hostname.endsWith('.local')
    } catch {
      return true
    }
  }

  private async invokeLocalModel(
    audio: Buffer,
    lang: 'ko' | 'en',
    sampleRate: number,
  ): Promise<{ text: string; confidence: number }> {
    // 실제 프로덕션에서는 HTTP 호출로 로컬 Whisper 서버 invoke.
    // 여기서는 인터페이스 계약을 정의하고 단위 테스트용 경로를 남긴다.
    const payloadSize = audio.length
    const approxSeconds = payloadSize / (sampleRate * 2)
    // NOTE: 스텁 구현. Phase 2에서 실제 Whisper ONNX runtime 연결 예정.
    return {
      text: `[STT:${lang}:${approxSeconds.toFixed(2)}s]`,
      confidence: 0.95,
    }
  }
}

export function createSTTProcessor(endpoint?: string): STTProcessor {
  return new STTProcessor(endpoint)
}
