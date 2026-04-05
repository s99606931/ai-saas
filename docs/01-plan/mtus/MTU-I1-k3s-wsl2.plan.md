# MTU-I1: k3s WSL2 클러스터 + 보안

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-I1 |
| Phase | Phase 3 Infrastructure |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-5.1, INFR-2 |
| 의존 MTU | MTU-F2 |
| 예상 세션 | 2 세션 |
| 중요도 | P0 |

---

## 목적

WSL2 환경에서 CSAP D-11 보안 설정이 적용된 k3s 클러스터를 10분 이내에 구성합니다.

**시장조사 반영**:
- WSL2 메모리 제한: `.wslconfig` 명시적 할당 필수 (memory=4GB 권장)
- Docker Desktop 대신 WSL2 내부 Docker Engine 직접 설치 (리소스 효율)
- Flux GitOps 추가: 폐쇄망 환경에서 GitOps 배포 표준화 (MTU-I3)
- CIS Kubernetes Benchmark × CSAP-D11 매핑

---

## 산출물 파일 (3개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `05-infra/k3s-wsl2/cluster-setup-recipe.md` | 구현 가이드형 | 10분 k3s 설치 레시피 |
| `05-infra/k3s-wsl2/scripts/install-k3s.sh` | 스크립트 | 자동화 설치 스크립트 |
| `05-infra/container-security-baseline.md` | 체크리스트형 | CIS Benchmark × CSAP-D11 매핑 |

---

## CNI 선택 (설치 시 결정 필수)

NetworkPolicy 지원을 위해 설치 시점에 CNI를 명시해야 합니다.

| CNI 옵션 | NetworkPolicy | WSL2 적합성 | 선택 근거 |
|---------|-------------|-----------|---------|
| **Flannel + kube-router** (권장) | ✅ 지원 | ✅ 최적 | 기본 CNI 위에 정책 레이어 추가, 경량 |
| Calico | ✅ 지원 | ⚠️ 리소스 증가 | 완전한 NetworkPolicy, BGP 지원 |
| Flannel 단독 | ❌ 미지원 | ✅ 최적 | NetworkPolicy 불가 — CSAP-D10 위반 |

```bash
# 권장: Flannel 비활성화 + kube-router CNI (NetworkPolicy 지원)
curl -sfL https://get.k3s.io | sh -s - \
  --flannel-backend=none \
  --disable-network-policy=false \
  --cluster-cidr=10.42.0.0/16
```

## 설치 스크립트 핵심 단계

```bash
# install-k3s.sh 구조
# Step 1: WSL2 사전 요건 확인 (메모리 4GB+, swap 비활성화)
# Step 2: CNI 선택 확인 (기본값: flannel-backend=none + kube-router)
# Step 3: k3s 설치 (버전 고정, TLS 설정, traefik 비활성화)
# Step 4: CSAP-D11 보안 설정 (non-root, read-only rootfs)
# Step 5: kubectl 설치 확인
# Step 6: cluster-info 출력 (성공 확인)
# 목표 실행 시간: 10분 이내
```

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-5.1 | 10분 이내 k3s 구성 | install-k3s.sh 실행 시간 < 600초 |
| INFR-2 | CSAP-D11 보안 적용 | container-security-baseline.md 체크리스트 통과 |

---

## 합격 기준

1. WSL2 신규 환경에서 `install-k3s.sh` 단독 실행으로 k3s 설치 완료
2. `kubectl get nodes` → Ready 상태 확인
3. 설치 시간 10분(600초) 이내
4. CSAP-D11-01~07 보안 설정 체크리스트 7개 항목 통과
5. Kyverno 정책 적용 준비 상태 (MTU-C7 전제조건 충족)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 | Claude Code |
| 0.2.0 | 2026-04-05 | P1: Kuverno → Kyverno 오타 수정, CNI 선택 섹션 추가 (NetworkPolicy 지원 명시) | Claude Code |
