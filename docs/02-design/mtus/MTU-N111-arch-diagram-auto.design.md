# MTU-N111: 아키텍처 다이어그램 자동 업데이트 — Design

> **MTU ID**: MTU-N111 | **작성일**: 2026-04-10

---

## 아키텍처: Pragmatic Balance

```
infra/ 디렉토리 변경 감지
    |
    v
generate-arch-diagram.sh
    |
    +-- infra/ 디렉토리 구조 스캔
    +-- Helm values, k8s 매니페스트 파싱
    +-- Mermaid 다이어그램 생성
    +-- docs-portal/docs/architecture/ 업데이트
    |
    v
Docusaurus 빌드 -> 정적 사이트 반영
```

### DS-N111.1: 스캔 대상

- infra/ 하위 디렉토리 = 컴포넌트
- values.yaml = Helm 배포 구성
- namespace 라벨 = 네임스페이스 그룹핑
- NetworkPolicy = 통신 경로

### DS-N111.2: Mermaid 다이어그램 형식

- C4 모델 기반 (System Context -> Container)
- 네임스페이스별 그룹핑
- 컴포넌트 간 의존 관계 표시
- 색상: 보안 컴포넌트(빨강), 모니터링(파랑), CI/CD(초록), 플랫폼(회색)

## Design Anchor

- Plan SC: FR-N111.1~FR-N111.5 전수 반영
