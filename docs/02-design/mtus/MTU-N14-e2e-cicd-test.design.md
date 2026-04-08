# MTU-N14: E2E CI/CD 검증 스크립트 Design

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N14 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-N14-e2e-cicd-test.plan.md |

---

## 1. 검증 항목 설계

```
test-cicd-pipeline.sh
  |
  +-- Phase 1: 인프라 상태 확인
  |     - Gitea 접속 (curl localhost:3000)
  |     - Harbor 접속 (curl localhost:8080)
  |     - k3s 노드 상태 (kubectl get nodes)
  |     - Act Runner 상태 (Gitea API)
  |
  +-- Phase 2: CI/CD 파이프라인 검증
  |     - Docker 이미지 빌드 (api-gateway 샘플)
  |     - Harbor 로그인 + push
  |     - Harbor에서 이미지 확인 (Harbor API)
  |
  +-- Phase 3: k3s 배포 검증
  |     - k3s에서 이미지 pull (registries.yaml)
  |     - helm template 검증
  |     - 네임스페이스 존재 확인
  |
  +-- Phase 4: 결과 보고
        - 통과/실패 요약
        - 실패 항목별 해결 안내
```

### 1.1 결과 출력 형식

```
===================================================
  WSL2 CI/CD 파이프라인 검증 결과
===================================================
[PASS] Gitea 접속 확인 (localhost:3000)
[PASS] Harbor 접속 확인 (localhost:8080)
[PASS] k3s 노드 Ready
[PASS] Act Runner 등록 확인
[PASS] Docker 이미지 빌드 성공
[PASS] Harbor 이미지 push 성공
[PASS] k3s 이미지 pull 성공
[FAIL] Helm deploy 실패 -- kubeconfig 설정 확인 필요
===================================================
  합계: 7/8 통과
===================================================
```
