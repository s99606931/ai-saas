# PRD: MTU-N35 Helm Umbrella Chart

| 항목 | 내용 |
|------|------|
| 문서 ID | PRD-N35-001 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-09 |
| 작성자 | PM Lead (Opus 4.6) |
| MTU | MTU-N35 |
| 복잡도 | HIGH |

---

## WHY

현재 saas-platform의 19개 서비스가 개별 kustomize 매니페스트로 관리됨. Helm Umbrella Chart로 통합하면 단일 명령으로 전체 스택 배포/업그레이드/롤백이 가능하며, 환경별(dev/stg/prod) 값 파일로 구성을 분리할 수 있음.

## WHO

- DevOps 엔지니어: 통합 배포/업그레이드
- 개발자: 로컬 환경 일관된 구성
- 감리인: 배포 구성 표준화 증적

## RISK

- Umbrella Chart 복잡도 증가
- 개별 서비스 독립 배포 유연성 감소
- WSL2 메모리 제한으로 전체 스택 동시 배포 시 리소스 부족

## SUCCESS

1. saas-platform Umbrella Chart 구조 완성
2. 하위 차트 14개 서비스 (인프라 제외)
3. 공통 라이브러리 차트 (_helpers.tpl 재사용)
4. 환경별 values 파일 (dev, stg, prod)
5. helm lint 통과
6. 설계 문서 + 사용 가이드

## SCOPE

- IN: Umbrella Chart 구조, 하위 차트 템플릿, 환경별 values
- OUT: 실제 전체 배포 (기존 kustomize 배포와 병행, 향후 마이그레이션)
