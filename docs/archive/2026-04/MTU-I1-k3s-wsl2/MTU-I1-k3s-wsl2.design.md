# MTU-I1: k3s WSL2 클러스터 + 보안 Design 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-I1 |
| Phase | Phase 3 Infrastructure |
| 버전 | 0.1.0 |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-I1-k3s-wsl2.plan.md |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 공공기관 SaaS를 위한 온프레미스 k3s 환경 표준화. WSL2에서 10분 이내 재현 가능한 클러스터 + CSAP-D11 보안 설정 |
| **WHO** | DevOps 엔지니어, 보안 담당자, 인프라 운영팀 |
| **RISK** | WSL2 환경 특이성(cgroup, systemd), CNI 선택 오류 시 NetworkPolicy 미동작, k3s 버전 변경 시 호환성 |
| **SUCCESS** | 설치 스크립트 10분 이내 완료 + CSAP-D11 7항목 보안 체크리스트 통과 + Kyverno 적용 준비 |
| **SCOPE** | `docs/framework/08-infra/k3s-wsl2/` 3개 파일 |

---

## 1. 설계 개요

### 1.1 아키텍처 선택: Option C (실용적 균형)

| 비교 항목 | Option A (최소) | Option B (완전) | **Option C (실용)** |
|---------|---------------|---------------|------------------|
| 스크립트 수 | 1개 (단일 all-in-one) | 5개 (단계별 분리) | **1개 + 설정 파일** |
| 보안 적용 | 기본 설치만 | CIS 전수 벤치마크 | **CSAP-D11 7항목 집중** |
| 문서 구조 | README 하나 | 단계별 5개 문서 | **레시피 1개 + 보안 체크리스트 1개** |

### 1.2 기술 스택

| 구성요소 | 버전/설정 | 근거 |
|---------|---------|------|
| k3s | v1.29+ (LTS) | 안정성, 보안 패치 지원 |
| CNI | Flannel 비활성화 + kube-router | NetworkPolicy 지원 (CSAP-D10) |
| WSL2 | Ubuntu 22.04+ | 공공기관 표준 Linux |
| 메모리 | 4GB+ (.wslconfig) | k3s + 워크로드 최소 요건 |

---

## 2. 파일별 설계

### 2.1 cluster-setup-recipe.md

**문서 유형**: 단계별 구현 가이드
**구조**:
1. 사전 요건 (WSL2, 메모리, swap)
2. k3s 설치 (CNI 선택, 버전 고정, TLS)
3. 보안 강화 (CSAP-D11 매핑)
4. 검증 (kubectl get nodes, 시간 측정)
5. 문제 해결 (FAQ 5개)

### 2.2 scripts/install-k3s.sh

**스크립트 유형**: Bash 자동화
**실행 흐름**:
```
사전 요건 확인 -> CNI 선택 -> k3s 설치 -> 보안 설정 -> 검증 -> 완료 보고
```
**핵심 설정**:
- `--flannel-backend=none` (kube-router CNI)
- `--disable=traefik` (별도 인그레스 사용)
- `--protect-kernel-defaults`
- `--secrets-encryption`

### 2.3 container-security-baseline.md

**문서 유형**: 체크리스트형
**CSAP-D11 매핑**:

| CSAP ID | CIS Benchmark | k3s 설정 |
|---------|--------------|---------|
| CSAP-D11-01 | 4.1 워커 노드 격리 | Pod Security Standards (restricted) |
| CSAP-D11-02 | 1.1 API 서버 보안 | --kube-apiserver-arg 설정 |
| CSAP-D11-03 | 5.1 네트워크 정책 | NetworkPolicy + kube-router |
| CSAP-D11-04 | 4.2 이미지 스캔 | Trivy 연동 |
| CSAP-D11-05 | 3.1 스토리지 암호화 | etcd 암호화 + PV 설정 |
| CSAP-D11-06 | 4.3 이미지 무결성 | Cosign 서명 검증 |
| CSAP-D11-07 | 4.4 모니터링 | Prometheus + 알림 |

---

## 3. 검증 기준

| AC ID | 수용 기준 | 검증 방법 |
|-------|---------|---------|
| AC-1 | 설치 레시피 문서 완비 | 5개 섹션 존재 확인 |
| AC-2 | 설치 스크립트 실행 가능 | bash 문법 오류 없음 |
| AC-3 | CSAP-D11 7항목 매핑 | 체크리스트 7행 존재 |
| AC-4 | 보안 설정 명시 | PSS, NetworkPolicy, etcd 암호화 포함 |
| AC-5 | CNI 선택 가이드 | 3개 옵션 비교 테이블 포함 |
| AC-6 | 문제 해결 섹션 | FAQ 5개 이상 |

---

## 4. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 -- Option C 선택, 3파일 설계 | PM Lead Agent |
