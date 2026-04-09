# MTU-N22: DevOps 파이프라인 통합 테스트 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **Plan 참조**: docs/01-plan/mtus/MTU-N22-devops-integration-test.plan.md

---

## 1. 테스트 아키텍처

### 5단계 테스트 전략

```
Phase 1: 인프라 상태 검증
  → Docker, k3s, Gitea, Harbor 각 서비스 응답 확인

Phase 2: Gitea CI/CD 검증
  → API 연동, 저장소 CRUD, Actions 워크플로우 실행

Phase 3: 컨테이너 레지스트리 검증
  → 이미지 빌드, Harbor Push/Pull, k3s Pull 테스트

Phase 4: k8s 배포 검증
  → 테스트 Pod 배포, 서비스 노출, 정리

Phase 5: 모니터링 검증
  → Prometheus 메트릭 쿼리, Grafana 대시보드 접근
```

---

## 2. 테스트 항목 상세

### Phase 1: 인프라 상태 (4항목)

| TC ID | 테스트 | 명령어 | 기대 결과 |
|-------|--------|--------|----------|
| TC-1.1 | Docker 데몬 | docker info | 정상 출력 |
| TC-1.2 | k3s 클러스터 | kubectl get nodes | Ready 상태 |
| TC-1.3 | Gitea 응답 | curl http://localhost:3001/api/v1/version | HTTP 200 |
| TC-1.4 | Harbor 응답 | curl http://localhost:8080/api/v2.0/health | HTTP 200 |

### Phase 2: Gitea CI/CD (4항목)

| TC ID | 테스트 | 방법 | 기대 결과 |
|-------|--------|------|----------|
| TC-2.1 | 저장소 목록 조회 | Gitea API GET /repos/search | HTTP 200 |
| TC-2.2 | 테스트 저장소 생성 | Gitea API POST /user/repos | HTTP 201 |
| TC-2.3 | 워크플로우 파일 Push | git push workflow yaml | 커밋 성공 |
| TC-2.4 | Actions 실행 확인 | Gitea API GET /repos/.../actions/runs | 실행 이력 존재 |

### Phase 3: 컨테이너 레지스트리 (3항목)

| TC ID | 테스트 | 방법 | 기대 결과 |
|-------|--------|------|----------|
| TC-3.1 | 이미지 빌드 | docker build -t test-app:latest | 빌드 성공 |
| TC-3.2 | Harbor Push | docker push localhost:8080/public-saas/test-app:latest | Push 성공 |
| TC-3.3 | k3s Pull | kubectl run test --image=localhost:8080/... | Pull 성공 |

### Phase 4: k8s 배포 (3항목)

| TC ID | 테스트 | 방법 | 기대 결과 |
|-------|--------|------|----------|
| TC-4.1 | Pod 배포 | kubectl apply -f test-pod.yaml | Running 상태 |
| TC-4.2 | 서비스 노출 | kubectl expose / NodePort | 외부 접근 가능 |
| TC-4.3 | 리소스 정리 | kubectl delete | 정상 삭제 |

### Phase 5: 모니터링 (2항목)

| TC ID | 테스트 | 방법 | 기대 결과 |
|-------|--------|------|----------|
| TC-5.1 | Prometheus 쿼리 | curl prometheus:9090/api/v1/query | 메트릭 반환 |
| TC-5.2 | Grafana 접근 | curl grafana:3002 | HTTP 200 |

---

## 3. 테스트 스크립트 설계

기존 `scripts/test-cicd-pipeline.sh`를 확장하여 사용합니다.

```bash
# 실행 모드:
#   --quick     : Phase 1만 (인프라 상태 확인)
#   --build     : Phase 1~3 (이미지 빌드 포함)
#   (기본)       : Phase 1~5 전체 테스트
#   --cleanup   : 테스트 리소스 정리
```

**결과 출력 형식**:
```
============================================
  DevOps 파이프라인 통합 테스트 결과
============================================
  총 테스트: 16
  PASS:      14
  FAIL:       1
  WARN:       1
  통과율:    87.5%
============================================
```

---

## 4. Design Anchor

| 항목 | 참조 |
|------|------|
| Plan | docs/01-plan/mtus/MTU-N22-devops-integration-test.plan.md |
| 기존 스크립트 | scripts/test-cicd-pipeline.sh |
| CSAP 매핑 | D-12(시스템 개발 보안 - 통합시험) |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
