# SVC-LOGGER-R29 DESIGN: Structured Logger 라이브러리

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-LOGGER-R29.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 | PM Lead |

---

## 로그 출력 형식

```json
{
  "timestamp": "2026-04-12T00:00:00.000Z",
  "level": "info",
  "message": "요청 처리 완료",
  "service": "user-service",
  "tenantId": "org-123",
  "requestId": "req-abc-def",
  "duration": 42,
  "extra": {}
}
```

---

## 로그 레벨

| 레벨 | 숫자 | 용도 |
|------|------|------|
| debug | 0 | 개발 디버깅 |
| info | 1 | 정상 운영 정보 |
| warn | 2 | 잠재적 문제 |
| error | 3 | 오류 (복구 가능) |
| fatal | 4 | 치명적 오류 (서비스 중단) |

설정된 레벨 이상만 출력합니다.

---

## PII 마스킹 패턴

```
이메일: user@example.com → u***@e***.com
전화번호: 010-1234-5678 → 010-****-5678
IP주소: 192.168.1.100 → 192.168.*.* 
```

---

## 주요 인터페이스

```typescript
interface LoggerOptions {
  level?: LogLevel;
  service?: string;
  context?: Record<string, unknown>;
  maskPii?: boolean;
  output?: (line: string) => void;  // 테스트 시 커스텀 출력
}

interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
  fatal(message: string, extra?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
  startTimer(): () => number;  // 타이머 시작 → 종료 시 경과 ms 반환
}
```

---

## Session Guide

### 구현 순서
1. `src/structured-logger.ts` -- 코어 로거
2. `src/index.ts` -- 패키지 엔트리포인트
3. `tests/structured-logger.test.ts` -- 단위 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-LOGGER-R29 DESIGN`
- 모든 함수: `// Plan SC: FR-LOG.{번호}`
