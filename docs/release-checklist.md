# stg -> main 릴리스 체크리스트

| 항목 | 내용 |
|------|------|
| 문서 ID | REL-CHK-001 |
| 버전 | 1.1.0 |
| 작성일 | 2026-04-08 |
| MTU 매핑 | MTU-N30 |

<!-- Design Ref: MTU-N30 Design -->
<!-- Plan SC: FR-N30.2 -->

---

## 사전 확인 항목

| 번호 | 항목 | 상태 | 확인 방법 |
|------|------|------|---------|
| 1 | 전체 MTU 완료 | 65/65 (100%) | pdca-status.json, _INDEX.md |
| 2 | 테스트 통과 | 28/28 ALL PASS | scripts/test-e2e-scenarios.sh |
| 3 | 시크릿 파일 미포함 | PASS | git ls-files grep |
| 4 | CHANGELOG 업데이트 | 완료 | CHANGELOG.md |
| 5 | 인프라 정상 | 36 pods Running | kubectl get pods -A |
| 6 | Grafana/Prometheus | 정상 | localhost:30302, :30090 |
| 7 | Harbor | 정상 | localhost:8080 |
| 8 | Flux GitOps | 정상 | kubectl get kustomization -A |
| 9 | NetworkPolicy | 15개 적용 | kubectl get netpol -A |
| 10 | Cosign 서명 | 검증 성공 | cosign verify |

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
git merge --no-ff stg -m "release: v1.1.0 공공기관 SaaS 프레임워크 (65 MTU, CSAP 100%)"

# 4. 태그 생성
git tag -a v1.1.0 -m "v1.1.0 - DevOps 인프라 완성 + 보안 강화"

# 5. 원격 푸시
git push origin main --tags
```

---

## v1.1.0 주요 변경사항

### 신규 (4개 MTU)
- MTU-N27: Cosign 이미지 서명 실전 적용 (CSAP D-05/D-09/D-12)
- MTU-N28: NetworkPolicy 격리 강화 (CSAP D-10/N2SF N-01)
- MTU-N29: E2E 시나리오 테스트 28건 (CSAP D-12)
- MTU-N30: 릴리스 체크리스트 (문서)

### 이전 Unreleased 포함
- MTU-N19~N26: 성능/보안/DevOps 인프라 완성
- MTU-N16~N18: 모니터링/플러그인/릴리스 준비

---

## 롤백 절차

```bash
# 문제 발생 시 이전 태그로 롤백
git checkout v1.0.0
```
