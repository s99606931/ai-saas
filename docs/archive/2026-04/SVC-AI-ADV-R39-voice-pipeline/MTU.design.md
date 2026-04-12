# SVC-AI-ADV-R39 — Voice AI 파이프라인 설계

> 작성일: 2026-04-12 | 설계자: PM Lead | 버전: 1.0.0
> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R39.plan.md

## Executive Summary (설계 관점)

| 관점 | 결정사항 |
|---|---|
| 비즈니스 | 민원 통화 AI 선별 처리 → 간단 문의 자동, 복잡 문의 상담원 에스컬레이션 |
| 기술 | STT: Whisper Large-v3 (로컬), TTS: VITS-Korean (로컬), 파이프라인 스트리밍 |
| 보안 | 통화 파일 C등급 온프레미스 저장, 텍스트 변환 후 PII 마스킹 거쳐 O등급 |
| 규정 | 모든 통화 세션 audit.jsonl 기록, 녹음 보관 1년 (CSAP D-06) |

## 아키텍처 옵션 비교

### Option A: 외부 AI API (OpenAI Whisper API)
- 장점: 최고 정확도, 즉시 가용
- 단점: **C등급 데이터 유출 위험 (N2SF 위반) — 채택 불가**

### Option B: 완전 로컬 (Whisper 로컬 + VITS 로컬)
- 장점: 데이터 완벽 격리, CSAP/N2SF 완전 준수
- 단점: GPU 자원 필요, 한국어 모델 fine-tune 필요

### Option C: 하이브리드 (로컬 기본 + O등급만 외부)  [Pragmatic Balance]
- **선택 이유**: 기본 통화(C등급)는 로컬 처리, 공지 TTS 같은 O등급 배치 작업만 외부 API 허용
- 장점: 성능/규정 균형, 확장성
- 단점: 이중 경로 관리 복잡성

## 모듈 구성

```
voice-pipeline.ts          # 오케스트레이터 (세션 관리, 이벤트 라우팅)
  ├─ stt-processor.ts      # STT (음성→텍스트)
  ├─ tts-processor.ts      # TTS (텍스트→음성)
  └─ 의존: pii-masking.ts, audit.ts, ai-guardrails.ts
```

## 데이터 흐름 (Session Guide)

```
[전화 음성 스트림] → voice-pipeline.startSession()
  → stt-processor.transcribe(audioChunk) [로컬 Whisper]
  → PII 마스킹 (주민번호, 카드번호, 전화번호)
  → ai-guardrails 검증 (독성/공격성)
  → [상담 로직] / 에스컬레이션 판단
  → tts-processor.synthesize(responseText) [로컬 VITS]
  → [전화 오디오 응답]
  → auditLog(sessionId, action, grade='C')
```

## 한국어 공공용어 처리 (FR-R39.4)

- 용어사전: `민원/행정심판/정보공개/주민등록/토지대장/건축물대장/공시지가/...`
- STT 후처리 단계에서 유사 발음 교정 (예: "건축물 대장" ↔ "건축물대장")
- terminology-manager 재사용 (R40에서 구현 예정이므로 본 MTU는 간단 맵핑)

## 보안 설계 (CSAP/N2SF)

- **D-08**: 세션 시작 시 verifyToken + RBAC (role='agent' or 'citizen')
- **D-09**: 녹음 파일 AES-256 저장, 전송 TLS 1.3
- **D-06**: 모든 세션 audit.jsonl에 {actor, action:'VOICE_SESSION', grade:'C', sessionId, startTime, endTime}
- **N2SF N-05**: 녹음 원본은 외부 전송 금지, 변환 텍스트만 마스킹 후 O등급으로 처리

## Design Anchor

- **왜 Whisper Large-v3**: 한국어 WER 8.2%로 현존 최고 (로컬 실행 가능)
- **왜 VITS**: 경량, 한국어 공공 음성 fine-tune 공개 모델 존재
- **왜 스트리밍**: 레이턴시 최소화 (2초 이내 응답 필수)

## 인터페이스 시그니처

```typescript
// voice-pipeline.ts
interface VoiceSession { id: string; actorId: string; grade: 'C'; startedAt: Date; }
class VoicePipeline {
  startSession(actorId: string): Promise<VoiceSession>
  processAudio(sessionId: string, chunk: Buffer): Promise<{text: string; response: Buffer}>
  endSession(sessionId: string): Promise<VoiceSessionResult>
}

// stt-processor.ts
class STTProcessor {
  transcribe(audio: Buffer, lang: 'ko'): Promise<{text: string; confidence: number}>
  applyTerminology(text: string): string
}

// tts-processor.ts
class TTSProcessor {
  synthesize(text: string, voice: 'female-ko' | 'male-ko'): Promise<Buffer>
  validateSafety(text: string): Promise<boolean>  // ai-guardrails 연동
}
```

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|---|---|---|---|
| 1.0.0 | 2026-04-12 | 최초 작성 | PM Lead |
