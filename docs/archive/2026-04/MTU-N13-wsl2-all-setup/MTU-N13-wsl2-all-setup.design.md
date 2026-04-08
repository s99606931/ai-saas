# MTU-N13: WSL2 전체 설치 자동화 스크립트 Design

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N13 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-N13-wsl2-all-setup.plan.md |

---

## 1. 스크립트 설계

### 1.1 실행 흐름

```
setup-wsl2-all.sh
  |
  +-- 1. check_prerequisites()
  |     - docker, docker-compose, helm, kubectl 확인
  |     - WSL2 환경 확인
  |     - 포트 충돌 확인 (3000, 5433, 8080)
  |
  +-- 2. setup_k3s()
  |     - k3s 설치 여부 확인 (이미 있으면 스킵)
  |     - curl -sfL https://get.k3s.io | sh -
  |     - kubectl 권한 설정
  |     - 노드 Ready 대기
  |
  +-- 3. setup_gitea()
  |     - scripts/setup-gitea-wsl2.sh 호출
  |     - Gitea 헬스체크 대기
  |
  +-- 4. setup_harbor()
  |     - scripts/setup-harbor-wsl2.sh 호출
  |     - Harbor 헬스체크 대기
  |
  +-- 5. setup_act_runner()
  |     - scripts/setup-act-runner.sh 호출
  |     - Runner 등록 확인
  |
  +-- 6. configure_k3s_registry()
  |     - /etc/rancher/k3s/registries.yaml 설정
  |     - k3s 재시작
  |
  +-- 7. verify_all()
        - 모든 구성요소 상태 확인
        - 요약 출력
```

### 1.2 멱등성 보장

각 단계에서 이미 완료된 경우 스킵:
- k3s: `kubectl get nodes` 성공 시 스킵
- Gitea: `curl localhost:3000` 응답 시 스킵
- Harbor: `curl localhost:8080` 응답 시 스킵
- Runner: Gitea API에서 runner 확인 시 스킵

### 1.3 오류 처리

- set -euo pipefail 사용
- 각 단계별 실패 시 명확한 오류 메시지 출력
- 부분 실패 시 이미 완료된 단계는 유지
- --force 옵션: 강제 재설치 (기존 데이터 백업 후)
