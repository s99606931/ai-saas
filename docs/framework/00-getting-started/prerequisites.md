# 사전 요건 체크리스트

| 항목 | 내용 |
|------|------|
| 문서 ID | FW-PREREQ |
| 버전 | 0.1.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 | 개발자, DevOps 담당자 |
| FR 매핑 | FR-0.3 (사전 요건 체크리스트) |

<!-- Design Ref: MTU-F1-getting-started.design.md 2.3절 -- 사전 요건 체크리스트 설계 -->

---

## 목적

공공기관 SaaS 프레임워크를 사용하기 위한 필수 소프트웨어 및 환경 요건을 정의합니다. 모든 항목이 충족되어야 Phase 2(Infrastructure) MTU 착수가 가능합니다.

---

## 1. 운영체제 요건

| # | 항목 | 최소 요건 | 권장 요건 | 확인 명령 | 확인 |
|---|------|---------|---------|---------|------|
| 1 | Windows 버전 | Windows 10 21H2+ | Windows 11 23H2+ | `winver` | ☐ |
| 2 | WSL2 활성화 | WSL2 커널 5.15+ | 최신 WSL2 커널 | `wsl --version` | ☐ |
| 3 | Ubuntu 배포판 | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS | `lsb_release -a` | ☐ |
| 4 | 시스템 메모리 | 8GB RAM | 16GB RAM | `free -h` | ☐ |
| 5 | 디스크 여유 공간 | 20GB | 50GB | `df -h` | ☐ |

### WSL2 설치 확인

```bash
# WSL2 설치 상태 확인
wsl --list --verbose
# 기대 결과: Ubuntu-22.04 또는 Ubuntu-24.04가 VERSION 2로 표시

# WSL2 커널 버전 확인
uname -r
# 기대 결과: 5.15.x 이상 (예: 6.6.87.2-microsoft-standard-WSL2)
```

---

## 2. 컨테이너 환경 (k3s)

| # | 항목 | 최소 요건 | 권장 요건 | 확인 명령 | 확인 |
|---|------|---------|---------|---------|------|
| 6 | k3s 버전 | v1.28+ | v1.30+ | `k3s --version` | ☐ |
| 7 | kubectl | v1.28+ (k3s 내장) | — | `kubectl version --client` | ☐ |
| 8 | Helm | v3.12+ | v3.15+ | `helm version` | ☐ |

### k3s 설치 (미설치 시)

```bash
# k3s 설치 (WSL2 환경)
curl -sfL https://get.k3s.io | sh -

# 설치 확인
sudo k3s kubectl get nodes
# 기대 결과: Ready 상태의 노드 1개 표시
```

> **주의**: k3s 설치는 Phase 2(MTU-I1) 인프라 구축 시 상세 레시피가 제공됩니다. 여기서는 설치 가능 여부만 확인합니다.

---

## 3. 형상관리 (Gitea)

| # | 항목 | 최소 요건 | 권장 요건 | 확인 명령 | 확인 |
|---|------|---------|---------|---------|------|
| 9 | Gitea 버전 | v1.21+ | v1.22+ | Gitea 웹 UI 하단 버전 표시 | ☐ |
| 10 | Git CLI | v2.38+ | v2.44+ | `git --version` | ☐ |

### Gitea 환경 확인

```bash
# Git 버전 확인
git --version
# 기대 결과: git version 2.38.0 이상

# Gitea는 k3s 클러스터 내 배포 예정 (Phase 2 MTU-I2)
# 현 단계에서는 Git CLI만 확인
```

> **참고**: Gitea 서버 설치는 Phase 2(MTU-I2) CI/CD 구축 시 수행합니다. 외부 클라우드 Git 서비스(GitHub, GitLab 등) 사용은 CLAUDE.md 절대 제약에 의해 금지됩니다 (공공기관 데이터 외부 전송 금지).

---

## 4. AI 도구 (Claude Code)

| # | 항목 | 최소 요건 | 권장 요건 | 확인 명령 | 확인 |
|---|------|---------|---------|---------|------|
| 11 | Claude Code 버전 | v2.1.69+ | v2.1.78+ | `claude --version` | ☐ |
| 12 | Node.js | v18.0+ | v20.0+ | `node --version` | ☐ |
| 13 | npm | v9.0+ | v10.0+ | `npm --version` | ☐ |

### Claude Code 하네스 확인

```bash
# CLAUDE.md 파일 존재 확인
ls -la CLAUDE.md
# 기대 결과: 프로젝트 루트에 CLAUDE.md 파일 존재

# 하네스 구성 파일 전수 확인
ls -la .claude/agents/*.md .claude/rules/*.md .claude/settings.json
# 기대 결과: 에이전트 5개 + 규칙 3개 + 설정 1개 = 9개 파일

# 상세 검증: 07-cc-harness/harness-verification-guide.md 참조
```

> **중요**: CC 하네스가 올바르게 구성되지 않으면 이후 모든 산출물 품질이 보장되지 않습니다. `07-cc-harness/harness-verification-guide.md`의 15항목 체크리스트를 반드시 수행하세요.

---

## 5. 편집기 (권장)

| # | 항목 | 최소 요건 | 권장 요건 | 비고 | 확인 |
|---|------|---------|---------|------|------|
| 14 | VS Code | 최신 버전 | 최신 버전 | WSL2 Remote 지원 필수 | ☐ |

### VS Code 권장 확장

| 확장 | 용도 |
|------|------|
| Remote - WSL | WSL2 환경 원격 개발 |
| Markdown All in One | 마크다운 편집 + 미리보기 |
| markdownlint | 마크다운 린트 (문서 품질 관리) |
| YAML | k3s/Helm 매니페스트 편집 |
| Kubernetes | k3s 클러스터 관리 UI |

---

## 6. 네트워크 요건

| # | 항목 | 요건 | 비고 | 확인 |
|---|------|------|------|------|
| 15 | 인터넷 접속 | AI LLM API 호출용 (N2SF O등급 데이터만) | CSAP/N2SF 준수 필수 |  ☐ |
| 16 | 내부 네트워크 | k3s 클러스터 노드 간 통신 | Phase 2 상세 설정 | ☐ |

> **N2SF 데이터 통제**: AI API 호출 시 C/S 등급 데이터 전송 절대 금지. O등급 데이터만 PII 마스킹 후 전송 가능. 상세 규칙은 `CLAUDE.md` 5절 및 `99-references/regulations-index.md` REF-02 참조.

---

## 7. 체크리스트 요약

### 필수 항목 (Phase 1 착수 기준)

| 영역 | 항목 수 | 필수 통과 |
|------|--------|---------|
| 운영체제 (WSL2) | 5 | 전수 |
| 컨테이너 (k3s) | 3 | 설치 가능 여부만 확인 (Phase 2 상세) |
| 형상관리 (Git) | 2 | Git CLI만 필수 (Gitea는 Phase 2) |
| AI 도구 (CC) | 3 | 전수 |
| 편집기 | 1 | 권장 |
| 네트워크 | 2 | AI API 접속 가능 |

**Phase 1 최소 요건**: 운영체제 5개 + Git CLI 1개 + Claude Code 3개 = **9개 항목 통과**

---

## 8. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 -- WSL2/k3s/Gitea/CC/VS Code 사전 요건 16항목 | Claude Code (PM Lead) |
