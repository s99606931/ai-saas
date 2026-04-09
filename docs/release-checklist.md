# stg -> main 릴리스 체크리스트

| 항목 | 내용 |
|------|------|
| 문서 ID | REL-CHK-001 |
| 버전 | 1.2.0 |
| 작성일 | 2026-04-09 |
| MTU 매핑 | MTU-N30, MTU-N36 |

<!-- Design Ref: MTU-N30 Design -->
<!-- Plan SC: FR-N30.2 -->

---

## 사전 확인 항목

| 번호 | 항목 | 상태 | 확인 방법 |
|------|------|------|---------|
| 1 | 전체 MTU 완료 | 71/71 (100%) | pdca-status.json, _INDEX.md |
| 2 | 테스트 통과 | 28/28 ALL PASS | scripts/test-e2e-scenarios.sh |
| 3 | 시크릿 파일 미포함 | PASS | git ls-files grep |
| 4 | CHANGELOG 업데이트 | 완료 (v1.2.0) | CHANGELOG.md |
| 5 | 인프라 정상 | 63 pods Running | kubectl get pods -A |
| 6 | Grafana/Prometheus | 정상 (20 targets) | localhost:30302, :30090 |
| 7 | Harbor | 정상 | localhost:8080 |
| 8 | Flux GitOps | 정상 | kubectl get kustomization -A |
| 9 | NetworkPolicy | 17개 적용 | kubectl get netpol -A |
| 10 | Cosign 서명 | 검증 성공 | cosign verify |
| 11 | Policy Reporter | 정상 (3 pods) | localhost:30380 |
| 12 | Helm Umbrella | lint 통과 | infra/helm/saas-platform/ |
| 13 | Kyverno Enforce | 적용 (4 pods) | kubectl get clusterpolicy |

---

## 머지 절차 (사용자 승인 필요)

```bash
# 1. stg 브랜치 최신 상태 확인
git checkout stg
git pull origin stg

# 2. main 브랜치로 전환
git checkout main
git pull origin main

# 3. stg 머지 (--no-ff로 머지 커밋 생성)
git merge --no-ff stg -m "release: v1.2.0 공공기관 SaaS 프레임워크 (71 MTU, CSAP 100%)"

# 4. 태그 생성
git tag -a v1.2.0 -m "v1.2.0 - Policy Reporter + Helm Umbrella Chart + 보안 강화"

# 5. 원격 푸시
git push origin main --tags
```

---

## v1.2.0 주요 변경사항

### 신규 (6개 MTU, N31~N36)
- MTU-N31: Kyverno Enforce 전환 (CSAP D-05/D-12)
- MTU-N32: Helm 실전 배포 테스트 (CSAP D-12)
- MTU-N33: 부하 테스트 (CSAP NFR/D-08)
- MTU-N34: Policy Reporter 설치 (CSAP D-05/D-06/D-12)
- MTU-N35: Helm Umbrella Chart (CSAP D-07/D-12)
- MTU-N36: 릴리스 체크리스트 v1.2.0 업데이트

### v1.1.0 이후 (N27~N30)
- MTU-N27: Cosign 이미지 서명 실전 적용
- MTU-N28: NetworkPolicy 격리 강화
- MTU-N29: E2E 시나리오 테스트 28건
- MTU-N30: v1.1.0 릴리스 준비

### v1.0.0 이후 (N16~N26)
- MTU-N19~N26: 성능/보안/DevOps 인프라 완성
- MTU-N16~N18: 모니터링/플러그인/릴리스 준비

---

## 롤백 절차

```bash
# 문제 발생 시 이전 태그로 롤백
git checkout v1.0.0
```
