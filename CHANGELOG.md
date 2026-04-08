# Changelog

공공기관 SaaS 프레임워크 변경 이력.
[Conventional Commits](https://www.conventionalcommits.org/) 형식 준수.

## [Unreleased]

### Added (신규)
- 성능 최적화 가이드 5종 (MTU-N19, CSAP D-07/D-11)
  - DB 인덱스 분석 + 최적화 권고 (Prisma 스키마 전수 분석)
  - k8s 리소스 requests/limits 권장값 (17 서비스 + 3 포털 + 인프라)
  - WSL2 .wslconfig 권장 설정 (RAM별 3단계)
  - Docker 이미지 크기 최적화 권고 (멀티스테이지 빌드 분석)
  - 연결 풀 (DB/Redis) 튜닝 가이드
- 보안 최종 점검 가이드 5종 (MTU-N20, CSAP D-12)
  - Trivy 컨테이너 이미지 스캔 절차 + 결과 해석 가이드
  - OWASP ZAP 동적 분석 (DAST) 실행 절차
  - 의존성 보안 감사 (pnpm audit) 결과 분석 절차
  - 보안 점검 결과 보고서 템플릿 (CSAP D-12 감리 증적)
  - CI/CD 보안 파이프라인 통합 가이드 (Gitea Actions)
- Grafana 모니터링 대시보드 3종 완성 (MTU-N16, CSAP D-06/D-07)
  - SLO 대시보드: API P95 < 200ms + 가용성 99.9% 시각화 (11패널)
  - 보안 대시보드: CSAP D-06 침해사고 모니터링 (12패널)
  - 운영 대시보드 보강: 테넌트 변수 선택기 + PVC 사용률 (2패널 추가)
- kube-prometheus-stack 배포 매니페스트 (MTU-N16)
  - Prometheus + Grafana + AlertManager + kube-state-metrics
  - k3s 최적화 리소스 설정 (Prometheus 256Mi/512Mi)
  - severity 기반 AlertManager 라우팅 + 한국어 알림 템플릿
- SLO burn rate 알림 4개 (MTU-N16, CSAP D-07)
  - Latency Fast/Slow burn (1h/6h 창)
  - Availability Fast/Slow burn (14.4x/6x burn rate)
- 플러그인 핸들러 통합 테스트 40개 (MTU-N17)
  - 전자결재: 9개 엔드포인트 25건 (CSAP D-08/D-12 검증)
  - 공공데이터: 4개 엔드포인트 15건 (CSAP D-08/D-12 검증)
- 플러그인 SDK 사용 가이드 (MTU-N17, docs/api/plugin-sdk-guide.md)
- WSL2 CI/CD 완전 구성 (MTU-N10~N15)
  - Gitea Actions self-hosted runner 전환
  - Harbor 레지스트리 구성 + push 활성화
  - 전체 셋업 스크립트 5개 (Gitea/Harbor/Act-Runner/통합/E2E)
- OWASP Top 10 테넌트 격리 강화 (MTU-N08, CSAP D-08-05)
  - billing/catalog/crm/menu/subscription 5개 서비스 핸들러 보안 강화
- Helm Chart 패키징 (MTU-N04, 20개 서비스 + 인프라)
  - 환경별 values 분리 (dev/stg/prod)
  - PDB, NetworkPolicy, Prometheus AlertRules 템플릿화
  - CSAP D-07/D-09/D-10/D-11 보안 요건 기본 적용
  - existingSecret 지원 (Sealed Secrets/Vault 연동)
  - DB 백업 CronJob 템플릿화 (CSAP D-07)
- Gitea CI E2E 통합 (MTU-N05)
  - ci.yml에 E2E 테스트 job 추가 (CSAP D-12)
  - Helm Chart lint + template dry-run job 추가
  - deploy.yml에 Helm 배포 단계 추가
- 성능 벤치마크 스크립트 (MTU-N07)
  - autocannon 기반 API 응답시간 측정
  - P95/P99/RPS/에러율 기준 검증
  - JSON 리포트 자동 생성
- E2E 통합 테스트 스위트 155건 (MTU-N01, CSAP D-12 통합시험)
  - 인증 흐름 E2E (로그인/토큰검증/로그아웃/MFA) 15건
  - API 게이트웨이 라우팅 E2E (프록시/미들웨어/헬스체크) 36건
  - 테넌트 격리 E2E (Cross-tenant 차단/캐시 격리) 13건
  - 감사 추적 E2E (append-only/SHA-256/서비스 통합) 14건
  - 보안 이벤트 E2E (로그인 실패/Rate Limiting/RBAC) 14건
  - AI 데이터 등급 E2E (C/S등급 차단/PII 마스킹) 12건
  - 서비스 아키텍처 E2E (16개 서비스+2개 플러그인+k8s+Docker) 51건
- Correlation ID (X-Request-ID) 분산 추적 플러그인 (api-gateway, CSAP D-06)
- Circuit Breaker 패턴 (동적 프록시 장애 전파 방지, CSAP D-07)
- Prometheus 알림 규칙 22개 (CPU/메모리/5xx/응답시간/보안/인프라)
- Grafana 운영 대시보드 JSON (10개 패널)
- DB 백업/복구 스크립트 (pg_dump, SHA-256 무결성, 90일 보존)
- k8s DB 백업 CronJob (매일 02:00 KST 자동 실행)
- Correlation ID + Circuit Breaker 단위 테스트 18건
- 16개 서비스 Graceful Shutdown (SIGTERM/SIGINT 핸들링, CSAP D-07)
- 14개 DB 서비스 /ready 엔드포인트 (Prisma DB 연결 상태 확인)
- k8s terminationGracePeriodSeconds: 30 (전 Deployment)
- CSAP D-07 가용성 테스트 97건 (Graceful Shutdown + Readiness Probe + k8s 구성)
- CSAP D-09 암호화 통합 테스트 (4건)
- CSAP D-10 네트워크 보안 통합 테스트 (6건)
- CSAP D-11 가상화 보안 통합 테스트 (13건 + 1건 추가)
- CSAP D-12 시스템 개발 보안 통합 테스트 (10건)
- k8s NetworkPolicy 매니페스트 (CSAP D-10 네트워크 격리)
- API 게이트웨이 라우팅 통합 테스트
- 멀티테넌트 격리 통합 테스트 (N2SF N-03)
- security-service Dockerfile 생성

### Security (보안)
- bcrypt -> bcryptjs 마이그레이션 (tar HIGH 취약점 4건 제거, CSAP D-12)
- 파일 업로드 보안 강화: 파일명 새니타이징 + Path Traversal 방어 (CSAP D-12)
- 파일 업로드 보안 강화: 실행 파일 확장자 18종 차단 (.exe, .jar, .bat 등)
- ESLint flat config 도입 (eval/new Function 금지, 미사용 변수 경고)
- Prettier 설정 추가 (코드 포맷 표준화)
- pre-commit hook 추가 (시크릿 파일/하드코딩 시크릿 차단, TypeScript 검사)
- pnpm audit: HIGH 취약점 0건 (기존 6 high -> 0 high, 2 moderate 잔여 = 개발 전용)

### Changed (변경)
- api-gateway: CORS 허용 헤더에 X-Request-ID 추가 + exposedHeaders 설정
- api-gateway: 감사 로그에 requestId 필드 추가 (분산 추적 연동)
- api-gateway: 동적 프록시 헤더에 x-request-id 전파 추가
- k8s microservices.yaml: readinessProbe 경로 /health -> /ready (DB 연결 실상태 반영)
- k8s microservices.yaml: 전 서비스 terminationGracePeriodSeconds: 30 추가
- k8s microservices.yaml: 전 서비스 securityContext 추가 (non-root, readOnlyRootFilesystem, drop ALL capabilities)
- k8s microservices.yaml: 전 서비스 livenessProbe 추가
- k8s microservices.yaml: 전 서비스 CPU requests/limits 추가
- saas-catalog-service package.json: deprecated 표시 강화
- docs 내 saas-catalog-service 참조를 catalog-service로 업데이트
- deploy-k8s.sh: NetworkPolicy 자동 적용 단계 추가
- build-all.sh: security-service 빌드 대상 추가

### Fixed (수정)
- health-check.test.ts: 서비스 포트 매핑 docker-compose.yml 기준으로 수정

## [1.0.0] - 2026-04-07

### Added
- Phase 1 Foundation 완료: 15개 MTU PDCA 통과
- 17개 마이크로서비스 구현
- 546개 단위 테스트 (42 파일)
- CSAP 79항목 + N2SF 6개 영역 100% 커버리지
- Docker Compose 전체 서비스 오케스트레이션
- k8s (k3s) 배포 매니페스트
- Gitea CI/CD 파이프라인 설정
- API 게이트웨이 (Fastify + Rate Limiting + CORS + Swagger)
- 감사 로깅 시스템 (SHA-256 체인 무결성)
- N2SF 데이터 등급 검증 미들웨어
- 전자결재 플러그인
- 공공데이터 연동 플러그인
