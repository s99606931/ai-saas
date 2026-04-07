# Changelog

공공기관 SaaS 프레임워크 변경 이력.
[Conventional Commits](https://www.conventionalcommits.org/) 형식 준수.

## [Unreleased]

### Added (신규)
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
