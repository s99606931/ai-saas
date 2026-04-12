# SVC-AI-ADV-R66 — 설계

## 모듈
- `token-safety-streaming.ts`
  - `TokenSafetyStream` 클래스: push(token) → 윈도우 갱신 → 탐지기 체인 실행 → 결정 반환

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';
type Action = 'allow' | 'mask' | 'interrupt';

interface DetectionResult {
  action: Action;
  reason?: string;
  detectorId: string;
  span?: { start: number; end: number };
}

interface Detector {
  id: string;
  inspect(window: string, fullText: string): DetectionResult | null;
}

interface StreamConfig {
  windowSize: number;   // 기본 128
  grade: DataGrade;     // O만 허용
  safeFallback: string; // 인터럽트 시 대체 문구
  detectors: Detector[];
}

interface StreamEvent {
  type: 'token' | 'blocked' | 'interrupted' | 'completed';
  token?: string;
  reason?: string;
  detectorId?: string;
  timestamp: string;
}
```

## 흐름
```
1. new TokenSafetyStream(cfg) — grade 검증 (C/S 차단)
2. push(token) →
   - 윈도우에 append (maxSize 유지)
   - 각 detector.inspect(window, fullText) 순회
   - 결과에 따라:
     * allow → 이벤트 token 출력
     * mask  → 해당 범위를 '*'로 교체 후 출력
     * interrupt → 스트림 중단 + safeFallback 출력 + audit
3. end() — 완료 이벤트 + audit summary
```

## 기본 제공 탐지기
- `PiiDetector`: 주민번호/전화/이메일/계좌/카드 정규식
- `KeywordDetector`: 금지 키워드 목록
- `JailbreakDetector`: "ignore previous", "prompt leak", "system prompt" 변형
- `ProfanityDetector`: 욕설/혐오 표현 사전
- `SecretLeakDetector`: API 키 패턴 (sk-, AKIA, ghp_ 등)

## 감사 로그 (CSAP D-06)
```typescript
interface AuditEntry {
  timestamp: string;
  action: 'STREAM_START' | 'TOKEN_ALLOW' | 'TOKEN_MASK' | 'STREAM_INTERRUPT' | 'STREAM_END' | 'GRADE_BLOCK';
  detectorId?: string;
  reason?: string;
  tokenIndex?: number;
}
getAuditLog(): AuditEntry[]  // CSAP D-06 필수
```

## 보안
- C/S 등급 요청은 생성자에서 즉시 throw (`SAFETY_GRADE_BLOCKED`)
- 인터럽트 후에는 더 이상 push 불가 (상태 전환)
- 토큰 인덱스는 0부터 증가, 감사에 기록
