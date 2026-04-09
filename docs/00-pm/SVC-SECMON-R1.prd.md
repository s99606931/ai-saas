# PRD: SVC-SECMON-R1 -- 보안 모니터링 서비스 고도화 라운드 1

> 작성일: 2026-04-10 | 버전: 1.0

---

## WHY
보안 모니터링 서비스가 실시간 위협 탐지의 핵심이나, 알림 확인/해제, 차단 IP 만료 정리, 테넌트 격리, Rate Limiting이 누락되어 운영 환경 배포에 부적합합니다.

## SCOPE
- 알림 확인(acknowledge) API
- 알림 심각도 대시보드 API
- Rate Limiting
- 차단 IP 만료 자동 정리
- IP 형식 검증 강화
- 테넌트 격리 (alerts, login-failures)
