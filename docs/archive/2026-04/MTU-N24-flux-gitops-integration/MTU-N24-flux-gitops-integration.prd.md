# PRD: MTU-N24 Flux GitOps 연동 심화

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead

---

## WHY (왜 필요한가)

현재 Flux v2 컨트롤러 4개가 k3s에 설치되어 있으나 실제 GitRepository/Kustomization 리소스가 없다.
Gitea와 Flux를 연동하여 Git Push 시 자동 배포가 이루어지는 GitOps 파이프라인을 완성해야 한다.
이는 공공기관 SaaS 프레임워크의 폐쇄망 CI/CD 자동화 요건(CSAP D-12, 감리기준 T05)에 직결된다.

## WHO (대상 사용자)

- DevOps 엔지니어: GitOps 기반 배포 자동화 구축
- 보안 담당자: 배포 변경 추적 및 감사 로그
- 감리관: CI/CD 자동화 증적 확인

## RISK

| 위험 | 대응 |
|------|------|
| Gitea HTTP 인증 실패 | Basic Auth + API Token 이중 설정 |
| Flux reconcile 무한 루프 | interval 5m, timeout 3m 설정 |
| 폐쇄망 환경 이미지 Pull 불가 | Harbor 미러 활용 (이미 구축) |

## SUCCESS (성공 기준)

1. Gitea 저장소에 GitRepository 리소스 생성 및 연동 확인
2. Kustomization 리소스로 자동 배포 동작 확인
3. Git Push 시 3분 이내 k3s 배포 반영 확인
4. Flux 알림 → Gitea 커밋 상태 업데이트 확인
5. 배포 가이드 문서 작성 완료

## SCOPE

- IN: Gitea + Flux GitRepository/Kustomization 연동, 알림 설정, 가이드 문서
- OUT: 프로덕션 멀티클러스터 배포, Helm Controller 심화 (향후 MTU)
