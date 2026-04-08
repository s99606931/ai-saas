# stg -> main 머지 PR 체크리스트

| 항목 | 내용 |
|------|------|
| 버전 | v1.0.0 |
| 브랜치 | stg -> main |
| 작성일 | 2026-04-08 |
| Plan SC | FR-N18.2 |

---

## 코드 품질

- [x] 전체 테스트 PASS (1,000개 단위 + 155개 E2E + 40개 플러그인 통합)
- [x] TypeScript 컴파일 오류 없음
- [x] pre-commit hook 통과 (시크릿 검사 + TypeScript 검사)
- [x] ESLint 오류 없음
- [x] pnpm audit: HIGH 취약점 0건

## CSAP/N2SF 준수

- [x] CSAP 79항목 100% 커버리지
- [x] N2SF 6개 영역 100% 커버리지
- [x] D-06 침해사고 관리: 감사 로그 전수 기록 (append-only, SHA-256 체인)
- [x] D-07 가용성: SLO 대시보드 + burn rate 알림 + Graceful Shutdown
- [x] D-08 접근 통제: 전 API RBAC + 테넌트 격리 + JWT 15분 만료
- [x] D-09 암호화: AES-256 (저장) + TLS 1.3+ (전송) + bcryptjs (해시)
- [x] D-12 시스템 개발 보안: Zod 입력 검증 + 매개변수화 쿼리 + XSS 방지

## 아키텍처

- [x] 마이크로서비스 17개 + 포털 3개 + 플러그인 2개
- [x] 모노레포 구조 (pnpm workspace)
- [x] 감사 SDK (audit-sdk), 인증 SDK (auth-sdk), UI 패키지
- [x] 비즈니스 플러그인 SDK

## 인프라

- [x] Docker Compose 전체 서비스 오케스트레이션
- [x] k8s (k3s) 배포 매니페스트 (네임스페이스, 시크릿, ConfigMap, NetworkPolicy)
- [x] Helm Chart 패키징 (20개 서비스 + 인프라, 환경별 values)
- [x] Gitea CI/CD 파이프라인 (ci.yml + deploy.yml)
- [x] WSL2 셋업 스크립트 (Gitea, Harbor, Act-Runner, 통합)
- [x] Prometheus + Grafana + AlertManager 배포 매니페스트
- [x] DB 백업 CronJob (매일 02:00 KST, SHA-256 무결성)

## 모니터링

- [x] Prometheus 알림 규칙 20개 (6그룹)
- [x] Grafana 대시보드 3종 (운영/SLO/보안, 총 36패널)
- [x] SLO: API P95 < 200ms, 가용성 99.9%
- [x] burn rate 알림: fast 1h / slow 6h

## 문서화

- [x] CHANGELOG v1.0.0 최종 정리
- [x] 릴리스 노트 작성
- [x] OpenAPI 3.0 사양 (docs/api/openapi.yaml)
- [x] 플러그인 SDK 사용 가이드 (docs/api/plugin-sdk-guide.md)
- [x] WSL2 CI/CD 전체 셋업 가이드 (docs/infra/wsl2-cicd-setup-guide.md)
- [x] MTU Plan/Design 문서 53개

## 시크릿 확인

- [x] `.env` 파일 커밋 없음
- [x] 하드코딩된 시크릿 없음
- [x] secrets.yaml에 실제 값 없음 (secrets.example.yaml만 커밋)
- [x] API 키/비밀번호 환경 변수 참조 방식

## 머지 전 확인사항 (사용자 수동)

- [ ] stg 브랜치 최신 상태 확인
- [ ] git diff stg..main 검토
- [ ] PR 생성 및 리뷰 요청
- [ ] CI 파이프라인 통과 확인
- [ ] 사용자 최종 승인

---

## 주의사항

- 실제 머지(PR 생성/머지)는 사용자 승인 후 수행
- force push 절대 금지
- main 브랜치에 직접 커밋 금지
