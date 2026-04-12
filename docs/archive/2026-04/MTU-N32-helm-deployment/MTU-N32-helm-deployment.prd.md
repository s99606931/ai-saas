# PRD: MTU-N32 Helm 실전 배포 테스트

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N32 |
| 작성일 | 2026-04-08 |
| 복잡도 | HIGH |
| 상태 | 착수 |

## WHY (배경)

현재 saas-platform 서비스들은 kubectl apply 기반 kustomize 배포. 운영 환경에서는 Helm Chart 기반 배포가 표준이며, 버전 관리/롤백/값 오버라이드 등 운영 편의 기능이 필수. 실전 Helm 배포 검증으로 프로덕션 준비도를 높임.

## WHO (이해관계자)

- DevOps 엔지니어: Helm 차트 관리 및 배포
- 개발자: helm values로 환경별 설정 변경
- 운영자: helm upgrade/rollback으로 안전한 업데이트

## RISK (위험)

- 기존 kustomize 배포와 리소스 이름 충돌
- Helm release와 기존 리소스 소유권(ownership) 충돌
- WSL2 리소스 한계 내 추가 namespace 부하

## SUCCESS (성공 기준)

- FR-N32.1: Helm Chart 구조 완성 (Chart.yaml, values.yaml, templates/)
- FR-N32.2: helm install 성공 (별도 네임스페이스 helm-test)
- FR-N32.3: 배포된 Pod Running + Health Check 통과
- FR-N32.4: helm upgrade/rollback 동작 확인
- FR-N32.5: Helm 배포 가이드 문서 작성

## SCOPE (범위)

- 포함: api-gateway 단일 서비스 Helm Chart, 배포 테스트, 가이드
- 제외: 전체 서비스 Helm 전환 (별도 MTU), Helmfile 멀티차트 관리
