# PRD: MTU-N169 DORA 4 Metrics 자동화 대시보드

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## WHY (배경)

플랫폼 엔지니어링 성숙도를 객관적으로 측정하려면 DORA(DevOps Research and Assessment) 4대 지표를
자동으로 수집하고 시각화해야 한다. 2026년 현재 80% 이상의 대규모 엔지니어링 조직이 플랫폼 팀을 보유하며,
DORA 지표는 소프트웨어 배포 성과의 표준 측정 방법으로 자리잡았다.

## WHO (이해관계자)

- 플랫폼 엔지니어링 팀: 배포 파이프라인 성과 모니터링
- 개발팀 리드: 팀별 배포 빈도 및 리드타임 추적
- 경영진/감리관: 정량적 DevOps 성숙도 보고

## RISK

- Gitea Actions 로그에서 배포 이벤트 파싱 정확도
- 장애 분류(CFR) 자동화의 오탐/미탐
- Grafana 대시보드 복잡도에 따른 성능 영향

## SUCCESS (성공 기준)

- SC-1: 4대 DORA 지표(DF, LT, CFR, MTTR) 자동 수집 파이프라인 구축
- SC-2: Grafana 대시보드에서 팀별/서비스별 지표 시각화
- SC-3: Prometheus 메트릭 기반 지표 계산 정확도 95%+
- SC-4: 주간/월간 자동 리포트 생성

## SCOPE

- 포함: Gitea webhook 이벤트 수집, Prometheus 메트릭 정의, Grafana 대시보드, 리포트 자동화
- 제외: 외부 SaaS 도구(LinearB, Sleuth 등) 사용 금지 (N2SF 준수)
