# Plan: SVC-SECMON-R1 -- 보안 모니터링 서비스 고도화

> 작성일: 2026-04-10 | 버전: 1.0

---

## 기능 요구사항

### FR-SECMON.1: Rate Limiting
- 읽기: 100 req/60s, 쓰기: 20 req/60s

### FR-SECMON.2: 알림 확인(Acknowledge) API
- `PUT /security/alerts/:id/acknowledge`
- 감사 로그 기록

### FR-SECMON.3: 알림 심각도 대시보드
- `GET /security/alerts/summary`
- 심각도별 카운트 + 미확인 알림 수

### FR-SECMON.4: 차단 IP 만료 자동 정리
- 조회 시 만료된 엔트리 자동 제거
- 만료 상태 응답에 포함

### FR-SECMON.5: IP 형식 검증 강화
- IPv4/IPv6 정규식 검증 추가
- CIDR 표기 지원 (/24 등)
