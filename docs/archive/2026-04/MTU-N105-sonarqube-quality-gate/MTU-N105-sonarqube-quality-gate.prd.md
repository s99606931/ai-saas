# MTU-N105: SonarQube 경량 코드 품질 게이트 — PRD

> **MTU ID**: MTU-N105
> **Phase**: 9라운드 CI/CD DevOps 고도화
> **작성일**: 2026-04-10

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | N91 Semgrep은 SAST 전용. 종합 코드 품질(코드 스멜, 중복, 커버리지, 복잡도)을 통합 관리하는 게이트 미구축. 감리기준 코드 품질 정량 증빙 필요 |
| WHO | 개발팀, QA 담당, 감리관, PM |
| RISK | 기술 부채 누적 미가시화, 코드 품질 저하 미인지, 감리 정량 지표 부재 |
| SUCCESS | SonarQube Community 경량 배포 + Gitea CI 연동 + 품질 게이트 PR 차단 + CSAP D-12 증빙 |
| SCOPE | SonarQube CE k3s 배포, Gitea Actions 연동, 품질 게이트 정책, 대시보드 설정 |

## 시장조사 결과

- SonarQube 2026: Community Edition 무료, Docker/k8s 배포 지원
- PR 데코레이션 + 품질 게이트: 코드 스멜, 버그, 취약점, 중복률, 커버리지 통합 관리
- EPAM KubeRocketCI: Operator 기반 자동 배포 사례
- 경량 대안: Codacy, DeepSource (외부 SaaS -> N2SF 제약으로 불가)
- 결론: SonarQube CE 자체 호스팅이 공공기관 N2SF 준수 유일 방안
