# MTU-N57: Prometheus Recording Rules + AlertManager 라우팅 최적화 — PRD

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## WHY (목적)

현재 Prometheus에 recording rules가 부재하여 대시보드 및 SLO 쿼리가 매번 원시 메트릭에서 계산됩니다. 
이로 인해:
1. Grafana 대시보드 로드 시간 증가 (복잡 쿼리 실시간 계산)
2. SLO 번레이트 알림의 정확도 저하 (집계 데이터 미활용)
3. Prometheus 리소스 낭비 (동일 쿼리 반복 실행)

AlertManager 라우팅도 수신자 3개(default, critical, dba-team)만 정의되어 있고 실제 webhook이 비어있어 알림이 전달되지 않습니다.

## WHO (대상)

- DevOps 엔지니어: 알림 수신 및 대응
- SRE 팀: SLO 모니터링 및 에러 버짓 관리
- 보안 담당자: CSAP 관련 보안 이벤트 알림
- 감리 위원: D-06 감사 로그 알림 체계 검증

## RISK (위험)

- Recording rules 과다 생성 시 Prometheus 메모리 사용량 증가
- AlertManager 알림 폭주 (alert fatigue) 위험
- webhook 수신자 미연결 시 알림 누락

## SUCCESS (성공 기준)

- Recording rules 15개+ 정의 (서비스 RED, 노드, SLO 집계)
- AlertManager 라우팅 5개 채널 세분화
- 대시보드 쿼리 응답 시간 50% 단축 (recording rules 활용)
- 알림 파이프라인 E2E 검증 완료

## SCOPE (범위)

- Prometheus recording rules (PrometheusRule CRD)
- AlertManager 라우팅 구성 최적화
- 알림 억제 규칙 (inhibition rules)
- 테스트 스크립트

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
