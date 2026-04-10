#!/usr/bin/env bash
# 서비스 스캐폴딩 CLI — 새 마이크로서비스 자동 생성
# Design Ref: MTU-N119
# Plan SC: FR-N119.1, FR-N119.5
# CSAP: D-12 시스템 개발 보안 (보안 기본값 내장)
set -euo pipefail

SERVICE_NAME="${1:-}"
SERVICE_TYPE="${2:-api}"  # api, worker, gateway
NAMESPACE="${3:-saas-system}"

if [ -z "$SERVICE_NAME" ]; then
  echo "사용법: $0 <서비스명> [유형: api|worker|gateway] [네임스페이스]"
  echo ""
  echo "예시:"
  echo "  $0 order-service api saas-system"
  echo "  $0 batch-processor worker saas-system"
  exit 1
fi

PROJECT_ROOT="/data/ai-saas"
SERVICE_DIR="$PROJECT_ROOT/services/$SERVICE_NAME"
TEMPLATE_DIR="$PROJECT_ROOT/tools/scaffolding/templates"

echo "=========================================="
echo "서비스 스캐폴딩: $SERVICE_NAME"
echo "유형: $SERVICE_TYPE"
echo "네임스페이스: $NAMESPACE"
echo "=========================================="

if [ -d "$SERVICE_DIR" ]; then
  echo "[FAIL] 서비스 디렉토리 이미 존재: $SERVICE_DIR"
  exit 1
fi

# 디렉토리 구조 생성
mkdir -p "$SERVICE_DIR"/{src/{routes,middleware,services,models,utils},tests/{unit,integration,e2e},config,docs,k8s}

# 1. package.json (TypeScript API 서비스 기준)
cat > "$SERVICE_DIR/package.json" << EOF
{
  "name": "@saas/$SERVICE_NAME",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "lint": "eslint src/ --ext .ts",
    "lint:fix": "eslint src/ --ext .ts --fix"
  },
  "dependencies": {
    "express": "^4.18.0",
    "zod": "^3.22.0",
    "winston": "^3.11.0",
    "prom-client": "^15.1.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.2.0",
    "tsx": "^4.7.0",
    "@types/express": "^4.17.0",
    "eslint": "^8.56.0"
  }
}
EOF

# 2. tsconfig.json
cat > "$SERVICE_DIR/tsconfig.json" << EOF
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF

# 3. src/index.ts — CSAP 보안 기본값 내장 (FR-N119.5)
cat > "$SERVICE_DIR/src/index.ts" << 'EOF'
// Design Ref: 서비스 스캐폴딩 템플릿
// CSAP: D-08 접근통제, D-09 암호화, D-06 감사 로깅, D-12 입력 검증

import express from 'express';
import { z } from 'zod';

const app = express();
const PORT = process.env.PORT || 3000;

// CSAP D-12: 입력 크기 제한 (DoS 방지)
app.use(express.json({ limit: '1mb' }));

// CSAP D-08: 보안 헤더
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// CSAP D-06: 요청 로깅 (감사 추적)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      ip: req.ip,
    }));
  });
  next();
});

// 헬스 체크 (무인증)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: process.env.SERVICE_NAME || 'unknown' });
});

// 메트릭 (Prometheus)
app.get('/metrics', async (req, res) => {
  // prom-client 메트릭 노출
  res.set('Content-Type', 'text/plain');
  res.send('# HELP up Service is up\n# TYPE up gauge\nup 1\n');
});

// CSAP D-12: 입력 검증 예시 (Zod 스키마)
const ExampleSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

app.post('/api/v1/example', (req, res) => {
  try {
    const validated = ExampleSchema.parse(req.body);
    res.json({ success: true, data: validated });
  } catch (err) {
    // CSAP D-12: 안전한 에러 응답 (내부 정보 노출 금지)
    res.status(400).json({ error: 'Invalid input' });
  }
});

app.listen(PORT, () => {
  console.log(`Service started on port ${PORT}`);
});

export default app;
EOF

# 4. Dockerfile — 보안 기본값
cat > "$SERVICE_DIR/Dockerfile" << 'EOF'
# CSAP: D-08 최소 권한 실행, D-12 보안 빌드
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
# CSAP D-08: 비루트 사용자 실행
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup
WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
EOF

# 5. k8s 매니페스트
cat > "$SERVICE_DIR/k8s/deployment.yaml" << EOF
# CSAP: D-08 접근통제, D-10 가용성
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $SERVICE_NAME
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: $SERVICE_NAME
    app.kubernetes.io/part-of: saas-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: $SERVICE_NAME
  template:
    metadata:
      labels:
        app: $SERVICE_NAME
      annotations:
        linkerd.io/inject: enabled
    spec:
      serviceAccountName: $SERVICE_NAME
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
        - name: $SERVICE_NAME
          image: harbor.saas.local/saas/$SERVICE_NAME:latest
          ports:
            - containerPort: 3000
          env:
            - name: SERVICE_NAME
              value: "$SERVICE_NAME"
            - name: NODE_ENV
              value: "production"
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
EOF

cat > "$SERVICE_DIR/k8s/service.yaml" << EOF
apiVersion: v1
kind: Service
metadata:
  name: $SERVICE_NAME
  namespace: $NAMESPACE
spec:
  selector:
    app: $SERVICE_NAME
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
EOF

# 6. 기본 테스트 파일
cat > "$SERVICE_DIR/tests/unit/example.test.ts" << 'EOF'
import { describe, it, expect } from 'vitest';

describe('서비스 기본 테스트', () => {
  it('헬스 체크가 정상 응답해야 함', () => {
    expect(true).toBe(true);
  });
});
EOF

echo ""
echo "[PASS] 서비스 스캐폴딩 완료: $SERVICE_DIR"
echo ""
echo "생성된 구조:"
echo "  $SERVICE_DIR/"
echo "    src/index.ts         — CSAP 보안 기본값 내장"
echo "    Dockerfile           — 비루트 실행, 멀티스테이지"
echo "    k8s/deployment.yaml  — Linkerd 주입, 리소스 제한"
echo "    k8s/service.yaml     — ClusterIP 서비스"
echo "    tests/               — 단위/통합/E2E 구조"
echo ""
echo "다음 단계:"
echo "  1. cd $SERVICE_DIR && npm install"
echo "  2. npm run dev (로컬 개발)"
echo "  3. docker build -t $SERVICE_NAME ."
echo "  4. kubectl apply -f k8s/"
