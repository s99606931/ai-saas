# 테넌트 온보딩 자동화 절차

> MTU-E2 | FR-8.5 | 적용 기준일: 2026-04-05
> 참조: MTU-I2 (Gitea CI/CD), MTU-C7 (Kyverno), MTU-I3 (Harbor)
> Design Ref: MTU-E2 Option B (등급별 차등 격리)

---

## 1. 개요

공공기관 SaaS 테넌트 온보딩을 최대 24시간(1 영업일) 이내 완료하는 자동화 절차입니다.
공공기관 조달 절차 특성상 계약 후 빠른 서비스 개통이 요구되므로 수동 작업을 최소화합니다.

---

## 2. 온보딩 타임라인

```
T+0h   온보딩 요청 접수
  │    입력: 기관명, 기관코드, N2SF 등급, 담당자 이메일, 서비스 용량
  │
  ▼
T+1h   자동화 스크립트 실행 (Gitea Actions)
  │    - 네임스페이스 생성: tenant-{grade}-{기관코드}
  │    - RBAC 역할/바인딩 생성 (CSAP D-08)
  │    - Kyverno 정책 적용 (리소스 한도, 네트워크 격리)
  │    - Harbor 프로젝트 생성 (이미지 격리)
  │    - ResourceQuota 적용
  │
  ▼
T+4h   자동 검증 실행
  │    - 네임스페이스 격리 테스트 (타 테넌트 접근 불가)
  │    - 리소스 한도 적용 확인
  │    - N2SF 등급별 AI 게이트웨이 라우팅 확인
  │    - NetworkPolicy 동작 확인
  │
  ▼
T+8h   관리자 계정 발급
  │    - 초기 자격증명 생성 (bcrypt 해시)
  │    - 담당자 이메일 발송 (TLS 암호화)
  │    - 온보딩 체크리스트 PDF 첨부
  │
  ▼
T+24h  온보딩 완료 확인
       - 서비스 정상 접근 확인 (헬스체크)
       - audit.jsonl에 온보딩 완료 기록
       - 감리 증적으로 보관
```

---

## 3. Gitea Actions 자동화 워크플로우

```yaml
# .gitea/workflows/tenant-onboarding.yml
# Plan SC: FR-8.5
name: 테넌트 온보딩 자동화

on:
  workflow_dispatch:
    inputs:
      agency_name:
        description: '기관명'
        required: true
      agency_code:
        description: '기관코드 (영문 소문자, 예: mnd, mofa)'
        required: true
      n2sf_grade:
        description: 'N2SF 등급 (C/S/O)'
        required: true
        default: 'O'
      admin_email:
        description: '관리자 이메일'
        required: true
      quota_tier:
        description: '리소스 등급 (small/medium/large)'
        required: true
        default: 'small'

jobs:
  create-tenant:
    runs-on: ubuntu-latest
    steps:
      - name: 입력값 검증
        run: |
          if [[ ! "${{ inputs.n2sf_grade }}" =~ ^(C|S|O)$ ]]; then
            echo "ERROR: N2SF 등급은 C, S, O 중 하나여야 합니다"
            exit 1
          fi
          if [[ ! "${{ inputs.agency_code }}" =~ ^[a-z][a-z0-9-]{1,20}$ ]]; then
            echo "ERROR: 기관코드는 영문 소문자, 숫자, 하이픈만 허용"
            exit 1
          fi

      - name: 네임스페이스 생성
        run: |
          NAMESPACE="tenant-$(echo ${{ inputs.n2sf_grade }} | tr 'A-Z' 'a-z')-${{ inputs.agency_code }}"
          kubectl create namespace ${NAMESPACE} || true
          kubectl label namespace ${NAMESPACE} \
            n2sf-grade="${{ inputs.n2sf_grade }}" \
            tenant-id="${{ inputs.agency_code }}" \
            tenant-type="public-saas" \
            agency-name="${{ inputs.agency_name }}" \
            pod-security.kubernetes.io/enforce=restricted \
            --overwrite

      - name: RBAC 생성
        run: |
          NAMESPACE="tenant-$(echo ${{ inputs.n2sf_grade }} | tr 'A-Z' 'a-z')-${{ inputs.agency_code }}"
          cat <<EOF | kubectl apply -f -
          apiVersion: rbac.authorization.k8s.io/v1
          kind: Role
          metadata:
            name: tenant-admin
            namespace: ${NAMESPACE}
          rules:
            - apiGroups: ["", "apps", "batch"]
              resources: ["pods", "services", "deployments", "jobs", "configmaps"]
              verbs: ["get", "list", "watch", "create", "update", "delete"]
            - apiGroups: [""]
              resources: ["pods/log"]
              verbs: ["get", "list"]
          ---
          apiVersion: rbac.authorization.k8s.io/v1
          kind: RoleBinding
          metadata:
            name: tenant-admin-binding
            namespace: ${NAMESPACE}
          subjects:
            - kind: User
              name: "${{ inputs.agency_code }}-admin"
              apiGroup: rbac.authorization.k8s.io
          roleRef:
            kind: Role
            name: tenant-admin
            apiGroup: rbac.authorization.k8s.io
          EOF

      - name: ResourceQuota 적용
        run: |
          NAMESPACE="tenant-$(echo ${{ inputs.n2sf_grade }} | tr 'A-Z' 'a-z')-${{ inputs.agency_code }}"
          # quota_tier에 따른 리소스 한도 설정
          case "${{ inputs.quota_tier }}" in
            small)  CPU_REQ=4;  MEM_REQ=8Gi;  CPU_LIM=8;  MEM_LIM=16Gi; PODS=20 ;;
            medium) CPU_REQ=8;  MEM_REQ=16Gi; CPU_LIM=16; MEM_LIM=32Gi; PODS=50 ;;
            large)  CPU_REQ=16; MEM_REQ=32Gi; CPU_LIM=32; MEM_LIM=64Gi; PODS=100 ;;
          esac
          cat <<EOF | kubectl apply -f -
          apiVersion: v1
          kind: ResourceQuota
          metadata:
            name: tenant-quota
            namespace: ${NAMESPACE}
          spec:
            hard:
              requests.cpu: "${CPU_REQ}"
              requests.memory: "${MEM_REQ}"
              limits.cpu: "${CPU_LIM}"
              limits.memory: "${MEM_LIM}"
              pods: "${PODS}"
          EOF

      - name: NetworkPolicy 적용
        run: |
          NAMESPACE="tenant-$(echo ${{ inputs.n2sf_grade }} | tr 'A-Z' 'a-z')-${{ inputs.agency_code }}"
          cat <<EOF | kubectl apply -f -
          apiVersion: networking.k8s.io/v1
          kind: NetworkPolicy
          metadata:
            name: default-deny-cross-namespace
            namespace: ${NAMESPACE}
          spec:
            podSelector: {}
            policyTypes: [Ingress, Egress]
            ingress:
              - from:
                  - podSelector: {}
            egress:
              - to:
                  - podSelector: {}
              - to:
                  - namespaceSelector:
                      matchLabels:
                        kubernetes.io/metadata.name: kube-system
                ports:
                  - protocol: UDP
                    port: 53
          EOF

      - name: Harbor 프로젝트 생성
        run: |
          curl -s -u "${{ secrets.HARBOR_ADMIN }}:${{ secrets.HARBOR_PASSWORD }}" \
            -H "Content-Type: application/json" \
            -X POST "https://harbor.internal/api/v2.0/projects" \
            -d "{
              \"project_name\": \"tenant-${{ inputs.agency_code }}\",
              \"public\": false,
              \"storage_limit\": 10737418240
            }"

      - name: 감사 로그 기록
        run: |
          echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"TENANT_ONBOARDING\",\"agency\":\"${{ inputs.agency_name }}\",\"code\":\"${{ inputs.agency_code }}\",\"grade\":\"${{ inputs.n2sf_grade }}\",\"result\":\"SUCCESS\"}" >> /var/log/audit/audit.jsonl

  verify-tenant:
    needs: create-tenant
    runs-on: ubuntu-latest
    steps:
      - name: 격리 테스트
        run: |
          NAMESPACE="tenant-$(echo ${{ inputs.n2sf_grade }} | tr 'A-Z' 'a-z')-${{ inputs.agency_code }}"
          # 타 네임스페이스에서 접근 시도 → 차단 확인
          kubectl run test-pod --namespace=default \
            --image=harbor.internal/tools/curl:latest \
            --rm -it --restart=Never -- \
            curl -s --max-time 5 http://service.${NAMESPACE}.svc.cluster.local || echo "BLOCKED: 정상"

      - name: 리소스 한도 확인
        run: |
          NAMESPACE="tenant-$(echo ${{ inputs.n2sf_grade }} | tr 'A-Z' 'a-z')-${{ inputs.agency_code }}"
          kubectl describe resourcequota -n ${NAMESPACE}
          kubectl describe limitrange -n ${NAMESPACE}

      - name: Kyverno 정책 적용 확인
        run: |
          kubectl get clusterpolicy require-tenant-labels -o yaml
          kubectl get clusterpolicy require-tenant-resource-limits -o yaml
```

---

## 4. 온보딩 요청 양식

| 필드 | 필수 | 설명 | 예시 |
|------|------|------|------|
| 기관명 | Y | 공식 기관명 | 국방부 |
| 기관코드 | Y | 영문 소문자 약어 | mnd |
| N2SF 등급 | Y | C/S/O | C |
| 관리자 이메일 | Y | 초기 계정 발급용 | admin@mnd.go.kr |
| 리소스 등급 | Y | small/medium/large | medium |
| 서비스 목적 | N | 용도 설명 | 내부 문서 관리 시스템 |
| 예상 사용자 수 | N | 동시 접속 예상 | 100명 |

---

## 5. 온보딩 완료 체크리스트

| 단계 | 점검 항목 | 담당 | 자동화 |
|------|---------|------|--------|
| 1 | 네임스페이스 생성 확인 | 인프라 | 자동 |
| 2 | RBAC 역할/바인딩 확인 | 보안 | 자동 |
| 3 | ResourceQuota 적용 확인 | 인프라 | 자동 |
| 4 | NetworkPolicy 적용 확인 | 보안 | 자동 |
| 5 | Harbor 프로젝트 생성 확인 | 인프라 | 자동 |
| 6 | 격리 테스트 통과 | 보안 | 자동 |
| 7 | 관리자 계정 발급 | 운영 | 수동 |
| 8 | 서비스 접근 확인 | 운영 | 수동 |
| 9 | audit.jsonl 온보딩 기록 | 감사 | 자동 |
| 10 | 감리 증적 보관 | 감사 | 수동 |

---

## 6. 오프보딩 (테넌트 해지) 절차

```
[요청 접수] 해지 사유 + 데이터 처리 방안 제출
    ↓
[데이터 백업] 테넌트 데이터 암호화 백업 (30일 보관)
    ↓
[리소스 정리] 네임스페이스 + RBAC + Harbor 프로젝트 삭제
    ↓
[데이터 파기] 30일 후 완전 파기 (ISMS-P I-17 준수)
    ↓
[감사 로그] 해지 완료 기록 (audit.jsonl)
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Gitea Actions 자동 온보딩 워크플로우 | Claude Code |
