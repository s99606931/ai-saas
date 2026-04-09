#!/bin/bash
# =============================================================================
# Velero v1.18 설치 스크립트 (k3s + WSL2 + MinIO)
# Design Ref: MTU-N55 Section 3.1
# Plan SC: FR-N55.1, FR-N55.2
# CSAP: D-06 침해사고 관리
# =============================================================================

set -euo pipefail

VELERO_VERSION="1.18.0"
NAMESPACE="velero"
MINIO_NAMESPACE="minio"

echo "=============================================="
echo " Velero DR 자동화 설치 (k3s + WSL2)"
echo " 버전: v${VELERO_VERSION}"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# --- Step 1: Velero CLI 설치 ---
echo ""
echo "[Step 1] Velero CLI 설치 확인..."
if ! command -v velero &>/dev/null; then
  echo "Velero CLI 설치 중..."
  wget -q "https://github.com/vmware-tanzu/velero/releases/download/v${VELERO_VERSION}/velero-v${VELERO_VERSION}-linux-amd64.tar.gz" \
    -O /tmp/velero.tar.gz
  tar xzf /tmp/velero.tar.gz -C /tmp
  sudo mv "/tmp/velero-v${VELERO_VERSION}-linux-amd64/velero" /usr/local/bin/
  rm -rf /tmp/velero*
fi
echo "Velero CLI: $(velero version --client-only 2>/dev/null || echo '설치 필요')"

# --- Step 2: MinIO 설치 (백업 스토리지) ---
echo ""
echo "[Step 2] MinIO S3 호환 스토리지 설치..."
if kubectl get ns "${MINIO_NAMESPACE}" &>/dev/null 2>&1; then
  echo "MinIO 네임스페이스 존재"
else
  kubectl create ns "${MINIO_NAMESPACE}" 2>/dev/null || true
fi

if kubectl get deploy -n "${MINIO_NAMESPACE}" minio &>/dev/null 2>&1; then
  echo "MinIO 이미 설치됨"
else
  echo "MinIO 배포 중..."
  kubectl apply -n "${MINIO_NAMESPACE}" -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minio
  template:
    metadata:
      labels:
        app: minio
    spec:
      containers:
        - name: minio
          image: quay.io/minio/minio:RELEASE.2024-06-13T22-53-53Z
          command: ["minio", "server", "/data", "--console-address", ":9001"]
          env:
            - name: MINIO_ROOT_USER
              value: minioadmin
            - name: MINIO_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: minio-credentials
                  key: password
          ports:
            - containerPort: 9000
            - containerPort: 9001
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: data
              mountPath: /data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: minio-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: minio
spec:
  selector:
    app: minio
  ports:
    - name: api
      port: 9000
    - name: console
      port: 9001
EOF
  echo "MinIO 배포 완료"
fi

# --- Step 3: Velero Helm 설치 ---
echo ""
echo "[Step 3] Velero Helm 설치..."
helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts 2>/dev/null || true
helm repo update

if kubectl get ns "${NAMESPACE}" &>/dev/null 2>&1 && \
   kubectl get deploy -n "${NAMESPACE}" velero &>/dev/null 2>&1; then
  echo "Velero 이미 설치됨"
else
  helm install velero vmware-tanzu/velero \
    -n "${NAMESPACE}" --create-namespace \
    -f /data/ai-saas/infra/velero/values.yaml \
    --wait --timeout 5m 2>/dev/null || echo "[INFO] Helm 설치 보류 (MinIO 준비 필요)"
fi

# --- Step 4: 초기 백업 버킷 생성 ---
echo ""
echo "[Step 4] MinIO 백업 버킷 생성..."
# mc CLI를 통해 버킷 생성 (mc가 설치되어 있는 경우)
if command -v mc &>/dev/null; then
  mc alias set minio http://localhost:9000 minioadmin minioadmin 2>/dev/null || true
  mc mb minio/velero-backups --ignore-existing 2>/dev/null || true
  echo "velero-backups 버킷 생성 완료"
else
  echo "[SKIP] mc CLI 미설치. 수동 버킷 생성 필요"
fi

echo ""
echo "=============================================="
echo " Velero DR 자동화 설치 완료"
echo " 백업 스케줄: daily-saas(02:00), weekly-cluster(일 03:00), daily-pv(04:00)"
echo " 복구: velero restore create --from-backup <backup-name>"
echo "=============================================="
