# MTU-N15: WSL2 CI/CD 설치 가이드 Design

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N15 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-N15-cicd-setup-guide.plan.md |

---

## 1. 문서 구조 설계

```
wsl2-cicd-setup-guide.md
  |
  +-- 1. 개요 (아키텍처 다이어그램)
  +-- 2. 사전 요구사항
  +-- 3. 빠른 시작 (원클릭 설치)
  +-- 4. 단계별 수동 설치
  |     +-- 4.1 k3s 설치
  |     +-- 4.2 Gitea + PostgreSQL
  |     +-- 4.3 Harbor
  |     +-- 4.4 Act Runner
  |     +-- 4.5 k3s 레지스트리 설정
  +-- 5. Gitea 초기 설정
  +-- 6. Harbor 프로젝트 설정
  +-- 7. Gitea Secrets 설정
  +-- 8. 파이프라인 첫 실행
  +-- 9. 문제 해결 (FAQ 10+)
  +-- 10. 포트 참조표
```

### 1.1 아키텍처 다이어그램 (ASCII)

```
+------------------------------------------+
|             WSL2 Ubuntu 22.04            |
|                                          |
|  +--------+  +--------+  +-----------+  |
|  | Gitea  |  | Harbor |  | k3s       |  |
|  | :3000  |  | :8080  |  | cluster   |  |
|  +---+----+  +---+----+  +-----+-----+  |
|      |           |              |        |
|  +---+----+      |        +----+-----+  |
|  | Act    |      |        | Pods     |  |
|  | Runner +------+------->| (helm)   |  |
|  +--------+  push image   +----------+  |
+------------------------------------------+
```
