# SVC-GRACEFUL-R26 DESIGN: Graceful Shutdown 라이브러리

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-GRACEFUL-R26.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## 셧다운 흐름

```
SIGTERM 수신
  -> isShuttingDown = true
  -> 헬스체크 503 반환 시작 (k8s 라우팅 중단)
  -> 진행 중 요청 완료 대기 (inflightCount === 0)
  -> 셧다운 콜백 실행 (역순: LIFO)
  -> process.exit(0)

forceTimeout 초과 시
  -> 강제 process.exit(1)
```

## 주요 인터페이스

```typescript
interface GracefulShutdownOptions {
  forceTimeoutMs?: number;     // 강제 종료 타임아웃 (기본: 30000)
  drainDelayMs?: number;       // 헬스체크 실패 후 대기 (기본: 5000, k8s 라우팅 전환)
  onShutdown?: () => void;     // 셧다운 시작 콜백 (로깅용)
}
```

## Session Guide

### 구현 순서
1. `src/graceful-shutdown.ts` -- 코어 셧다운 로직
2. `src/index.ts` -- 패키지 엔트리포인트
3. `tests/graceful-shutdown.test.ts` -- 단위 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-GRACEFUL-R26 DESIGN`
- 모든 함수: `// Plan SC: FR-GS.{번호}`
