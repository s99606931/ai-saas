# PRD: MTU-N38 Gitea Actions 워크플로우 최적화

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead

---

## WHY

현재 5개 Gitea Actions 워크플로우에 중복 설정(pnpm, Node.js, Harbor 로그인)이 산재하고, 의존성 캐싱이 미적용되어 빌드 시간이 불필요하게 길다. 캐싱, 재사용 가능한 워크플로우, 병렬화 최적화로 파이프라인 효율을 30% 이상 개선한다.

## WHO

- DevOps 엔지니어: 파이프라인 유지보수 효율 향상
- 개발자: 빌드 대기 시간 단축
- 비용 관리자: Runner 자원 효율 개선

## RISK

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 캐시 무효화 빈번 | 캐시 히트율 저하 | lock 파일 해시 기반 키 |
| 재사용 워크플로우 변경 파급 | 전체 파이프라인 영향 | 버전 태깅 + 테스트 |
| 병렬화로 Runner 자원 부족 | 빌드 큐잉 | concurrency 제한 |

## SUCCESS

| ID | 기준 | 측정 방법 |
|----|------|---------|
| SC-N38.1 | pnpm 의존성 캐싱 적용 | 캐시 히트 시 install 30초 이내 |
| SC-N38.2 | Docker 레이어 캐싱 적용 | 재빌드 시 50% 시간 절약 |
| SC-N38.3 | 재사용 가능한 공통 작업 분리 | composite action 또는 reusable workflow |
| SC-N38.4 | 워크플로우 중복 코드 50% 감소 | 라인 수 비교 |
| SC-N38.5 | 워크플로우 문법 검증 통과 | YAML lint 성공 |

## SCOPE

### In Scope
- pnpm store 캐싱 (actions/cache)
- Docker BuildKit 레이어 캐싱 (cache-from/cache-to)
- 공통 단계 reusable workflow 분리
- ci.yml, ci-cd-pipeline.yml 최적화
- 워크플로우 통합 정리 (중복 제거)

### Out of Scope
- 신규 CI 도구 도입
- Gitea Runner 하드웨어 업그레이드
