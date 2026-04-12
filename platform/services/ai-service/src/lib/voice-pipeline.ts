// SVC-AI-ADV-R39: 음성 파이프라인 오케스트레이터
// Design Ref: §데이터 흐름, §인터페이스 시그니처
// Plan SC: FR-R39.3, FR-R39.5, FR-R39.6
//
// 민원 전화 음성 세션을 관리하고 STT→마스킹→응답→TTS 흐름을 조율한다.

import { STTProcessor, createSTTProcessor } from './stt-processor'
import { TTSProcessor, createTTSProcessor } from './tts-processor'
import { randomUUID } from 'crypto'

export interface VoiceSession {
  id: string
  actorId: string
  grade: 'C'  // 통화 녹음 C등급 고정
  startedAt: Date
  endedAt?: Date
  turnCount: number
}

export interface VoiceTurnResult {
  sessionId: string
  userText: string       // 마스킹 적용 후
  userTextRaw: string    // 감사용 해시
  responseText: string
  responseAudio: Buffer
  latencyMs: number
}

export interface VoiceSessionResult {
  session: VoiceSession
  totalTurns: number
  totalDurationMs: number
  escalated: boolean
}

type AuditSink = (event: Record<string, unknown>) => Promise<void> | void
type ResponseGenerator = (userText: string, session: VoiceSession) => Promise<string>

/**
 * PII 마스킹 함수 — 주민번호/카드번호/전화번호 치환.
 * 완전한 구현은 pii-masking.ts 모듈 참조.
 */
function maskPII(text: string): string {
  return text
    .replace(/\d{6}-?\d{7}/g, '[주민번호]')
    .replace(/\d{4}-?\d{4}-?\d{4}-?\d{4}/g, '[카드번호]')
    .replace(/01[016789]-?\d{3,4}-?\d{4}/g, '[전화번호]')
}

/**
 * 음성 파이프라인 — 세션 수명 주기 관리 + 감사 기록.
 */
export class VoicePipeline {
  private readonly stt: STTProcessor
  private readonly tts: TTSProcessor
  private readonly auditSink: AuditSink
  private readonly respond: ResponseGenerator
  private readonly sessions: Map<string, VoiceSession> = new Map()

  constructor(options: {
    stt?: STTProcessor
    tts?: TTSProcessor
    auditSink: AuditSink
    respond: ResponseGenerator
  }) {
    this.stt = options.stt ?? createSTTProcessor()
    this.tts = options.tts ?? createTTSProcessor()
    this.auditSink = options.auditSink
    this.respond = options.respond
  }

  /**
   * 새 음성 세션을 시작한다.
   * 감사 로그에 세션 시작 이벤트 기록.
   */
  async startSession(actorId: string): Promise<VoiceSession> {
    if (!actorId) throw new Error('actorId required')

    const session: VoiceSession = {
      id: randomUUID(),
      actorId,
      grade: 'C',
      startedAt: new Date(),
      turnCount: 0,
    }
    this.sessions.set(session.id, session)

    await this.auditSink({
      ts: session.startedAt.toISOString(),
      actor: actorId,
      action: 'VOICE_SESSION_START',
      sessionId: session.id,
      grade: 'C',
      source: 'voice-pipeline',
    })

    return session
  }

  /**
   * 한 턴의 음성 처리: 오디오 → STT → 마스킹 → 응답 → TTS.
   */
  async processAudio(sessionId: string, audioChunk: Buffer): Promise<VoiceTurnResult> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`session not found: ${sessionId}`)
    if (session.endedAt) throw new Error(`session already ended: ${sessionId}`)

    const start = Date.now()
    const fp = this.stt.fingerprint(audioChunk)

    // 1) STT
    const stt = await this.stt.transcribe(audioChunk, { language: 'ko', applyTerminology: true })

    // 2) PII 마스킹 (C등급 → O등급 전환)
    const maskedText = maskPII(stt.text)

    // 3) 응답 생성
    const responseText = await this.respond(maskedText, session)

    // 4) TTS
    const ttsResult = await this.tts.synthesize(responseText, { voice: 'female-ko' })

    session.turnCount += 1

    // 5) 감사 로그 (원본 텍스트는 기록 금지, 지문만)
    await this.auditSink({
      ts: new Date().toISOString(),
      actor: session.actorId,
      action: 'VOICE_TURN',
      sessionId: session.id,
      turn: session.turnCount,
      fingerprint: fp,
      maskedTextLen: maskedText.length,
      responseLen: responseText.length,
      grade: 'C',
    })

    return {
      sessionId: session.id,
      userText: maskedText,
      userTextRaw: fp,
      responseText,
      responseAudio: ttsResult.audio,
      latencyMs: Date.now() - start,
    }
  }

  /**
   * 세션 종료.
   */
  async endSession(sessionId: string, escalated = false): Promise<VoiceSessionResult> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`session not found: ${sessionId}`)

    session.endedAt = new Date()
    const totalDurationMs = session.endedAt.getTime() - session.startedAt.getTime()

    await this.auditSink({
      ts: session.endedAt.toISOString(),
      actor: session.actorId,
      action: 'VOICE_SESSION_END',
      sessionId: session.id,
      totalTurns: session.turnCount,
      totalDurationMs,
      escalated,
      grade: 'C',
    })

    this.sessions.delete(sessionId)

    return {
      session,
      totalTurns: session.turnCount,
      totalDurationMs,
      escalated,
    }
  }

  /**
   * 활성 세션 수 조회 (모니터링용).
   */
  getActiveSessionCount(): number {
    return this.sessions.size
  }
}

export function createVoicePipeline(options: {
  stt?: STTProcessor
  tts?: TTSProcessor
  auditSink: AuditSink
  respond: ResponseGenerator
}): VoicePipeline {
  return new VoicePipeline(options)
}
