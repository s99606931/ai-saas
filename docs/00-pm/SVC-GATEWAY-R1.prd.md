# PRD: api-gateway 라운드 1 고도화

> MTU ID: SVC-GATEWAY-R1
> 버전: 1.0.0 | 작성일: 2026-04-09

---

## WHY

API 게이트웨이는 플랫폼의 모든 트래픽이 경유하는 단일 진입점입니다.
현재 기본 프록시/인증/Rate Limiting이 구현되어 있으나, 운영 수준의 보안 강화가 필요합니다:

1. IP 기반 접근 제어 (화이트/블랙리스트) 미구현 — CSAP D-10 네트워크 보안
2. 요청 페이로드 크기 제한 없음 — DoS 취약
3. Circuit Breaker 상태를 외부에서 확인할 수 없음
4. 느린 요청 감지 및 알림 미구현
5. 요청 본문 검증 (JSON 스키마) 미구현
6. 서비스별 타임아웃 설정 미구현

## SUCCESS

| ID | 기준 |
|----|------|
| SC-1 | IP 블랙리스트에 등록된 IP 접근 시 403 |
| SC-2 | 요청 본문 10MB 초과 시 413 |
| SC-3 | /admin/circuits 엔드포인트에서 CB 상태 조회 가능 |
| SC-4 | 응답시간 5초 초과 요청 로그에 SLOW_REQUEST 기록 |
| SC-5 | 요청 헤더 보안 강화 (X-Content-Type-Options, X-Frame-Options) |
| SC-6 | 테스트 커버리지 80% 이상 |
