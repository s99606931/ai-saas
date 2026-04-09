# MTU-N22: DevOps 파이프라인 통합 테스트 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **복잡도**: HIGH | **의존**: MTU-N21 (환경 구축 완료 후)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | DevOps 파이프라인 전 구간(코드 Push → 빌드 → 이미지 → 배포 → 모니터링)의 실동작 검증 |
| 기술 | Gitea Actions → Harbor Push → k3s 배포 → Prometheus 메트릭 수집 End-to-End 테스트 |
| 보안 | CI/CD 파이프라인 내 시크릿 관리, 이미지 취약점 스캔 검증 (CSAP D-12) |
| 운영 | 자동화된 테스트 스크립트로 파이프라인 건강 상태 지속 확인 가능 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 개별 서비스 설치는 완료되었으나, 서비스 간 통합 동작(Push→Build→Deploy)이 미검증 |
| WHO | DevOps 엔지니어, QA 팀 |
| RISK | 네트워크 격리로 인한 서비스 간 통신 불가, Runner 권한 부족, Harbor 인증 실패 |
| SUCCESS | test-cicd-pipeline.sh 실행 시 모든 테스트 항목 PASS |
| SCOPE | WSL2 로컬 환경 내 통합 테스트. 외부 연동 테스트는 범위 밖 |

---

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 | CSAP |
|-------|---------|----------|------|
| FR-N22.1 | 인프라 상태 확인 테스트 | Docker, k3s, Gitea, Harbor 모두 정상 응답 | D-11 |
| FR-N22.2 | Gitea API 연동 테스트 | 저장소 생성/조회 API 정상 동작 | D-12 |
| FR-N22.3 | Gitea Actions 워크플로우 테스트 | 샘플 워크플로우 실행 및 완료 확인 | D-12 |
| FR-N22.4 | Harbor 이미지 빌드/Push 테스트 | docker build → docker push → Harbor에서 확인 | D-11-04 |
| FR-N22.5 | Harbor 이미지 Pull 테스트 | k3s에서 Harbor 이미지 Pull 성공 | D-11 |
| FR-N22.6 | k3s 배포 테스트 | 테스트 Pod 배포 및 Running 확인 | D-11 |
| FR-N22.7 | Prometheus 메트릭 수집 테스트 | 메트릭 엔드포인트 쿼리 성공 | D-06 |
| FR-N22.8 | 서비스 Health Check 통합 테스트 | 전체 서비스 /health 엔드포인트 응답 | - |

---

## 비기능 요구사항

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-N22.1 | 전체 테스트 실행 시간 | 10분 이내 |
| NFR-N22.2 | 테스트 결과 리포트 | PASS/FAIL/WARN 분류, 총점 출력 |
| NFR-N22.3 | 반복 실행 가능 | 멱등성 보장 (테스트 리소스 정리) |

---

## 산출물 목록

| 산출물 | 경로 | 설명 |
|--------|------|------|
| 통합 테스트 스크립트 | scripts/test-cicd-pipeline.sh | 검증 및 보강 |
| 테스트 결과 로그 | docs/04-report/MTU-N22-test-results.md | 실행 결과 기록 |
| 검증 보고서 | docs/04-report/MTU-N22.report.md | 테스트 통과 현황 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
