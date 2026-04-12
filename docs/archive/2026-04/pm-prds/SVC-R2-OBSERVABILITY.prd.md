# PRD: SVC-R2-OBSERVABILITY — 마이크로서비스 Round 2 관찰가능성 고도화

> Design Ref: SVC-R2-OBS
> 작성일: 2026-04-10
> 작성자: PM Lead

---

## WHY (배경)

Round 1에서 16개 마이크로서비스의 기능 고도화(통계, 감사 로그, 검색, 테넌트 격리)를 완료했다.
Round 2에서는 운영 환경에서의 관찰가능성(Observability)과 성능 추적, 에러 표준화를 강화한다.

## WHO (이해관계자)

- 플랫폼 운영팀: 분산 추적, 요청 ID 기반 로그 조회
- SRE: 응답 시간 모니터링, 에러율 추적
- 개발팀: 표준화된 에러 응답 구조

## RISK

- R1: 미들웨어 추가로 인한 레이턴시 증가 → 경량 구현 (Date.now() 기반)
- R2: 기존 테스트 회귀 → 기존 테스트 먼저 실행 후 고도화

## SUCCESS (검증 기준)

| ID | 기준 | 측정 |
|----|------|------|
| SC-R2.1 | 전 서비스 X-Request-ID 헤더 응답 | 테스트 검증 |
| SC-R2.2 | 전 서비스 X-Response-Time 헤더 응답 | 테스트 검증 |
| SC-R2.3 | 표준화된 에러 응답 구조 | 스키마 검증 |
| SC-R2.4 | 기존 테스트 100% 통과 유지 | vitest |

## SCOPE

- IN: 16개 활성 서비스에 관찰가능성 미들웨어 추가
- OUT: OpenTelemetry 분산 추적 (auth-service에 이미 있음, 다른 서비스는 Round 3)
