-- 공공기관 SaaS 플랫폼 -- 초기 마이그레이션
-- Design Ref: D-P00.6 DB 스키마
-- Plan SC: FR-P00.6
-- CSAP: D-06 감사 로그, D-08 접근 통제, D-09 암호화
--
-- 이 마이그레이션은 prisma/schema.prisma 기반으로 생성되었습니다.
-- 운영 환경 적용 시 반드시 DBA 검토 필수.

-- ============================================================
-- ENUM 타입
-- ============================================================

CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'USER', 'VIEWER', 'AUDITOR');
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'ARCHIVED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

-- ============================================================
-- 테넌트 (N2SF N-03 격리)
-- ============================================================

CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "maxStorage" BIGINT NOT NULL DEFAULT 1073741824,
    "config" JSONB,
    "theme" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- ============================================================
-- 사용자 (CSAP D-08)
-- ============================================================

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "User_email_idx" ON "User"("email");

ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 세션 (CSAP D-08 토큰 관리)
-- ============================================================

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshToken" TEXT,
    "refreshExpiresAt" TIMESTAMP(3),
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 권한 (CSAP D-08 RBAC)
-- ============================================================

CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- SaaS 서비스 카탈로그
-- ============================================================

CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureFlag_serviceId_key_key" ON "FeatureFlag"("serviceId", "key");

ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 구독 관리
-- ============================================================

CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "interval" TEXT NOT NULL DEFAULT 'monthly',
    "maxUsers" INTEGER NOT NULL,
    "maxStorage" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

CREATE TABLE "PlanService" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "PlanService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanService_planId_serviceId_key" ON "PlanService"("planId", "serviceId");

ALTER TABLE "PlanService" ADD CONSTRAINT "PlanService_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanService" ADD CONSTRAINT "PlanService_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 빌링
-- ============================================================

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- CRM
-- ============================================================

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "size" TEXT,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Customer_status_idx" ON "Customer"("status");

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contact_customerId_idx" ON "Contact"("customerId");

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contract_customerId_idx" ON "Contract"("customerId");
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 메뉴 관리
-- ============================================================

CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "parentId" TEXT,
    "label" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "roles" JSONB,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MenuItem_tenantId_idx" ON "MenuItem"("tenantId");
CREATE INDEX "MenuItem_parentId_idx" ON "MenuItem"("parentId");

ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 감사 로그 (CSAP D-06) -- append-only, SHA-256 체인
-- ============================================================

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "targetType" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "hash" TEXT NOT NULL,
    "previousHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- AI 서비스 (N2SF N-05)
-- ============================================================

CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "maxGrade" TEXT NOT NULL DEFAULT 'O',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "cost" DECIMAL(10,4) NOT NULL,
    "grade" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiUsage_tenantId_createdAt_idx" ON "AiUsage"("tenantId", "createdAt");
CREATE INDEX "AiUsage_modelId_idx" ON "AiUsage"("modelId");

ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_modelId_fkey"
    FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 알림
-- ============================================================

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- ============================================================
-- 파일 관리 (CSAP D-09 AES-256 암호화)
-- ============================================================

CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "File_tenantId_idx" ON "File"("tenantId");
CREATE INDEX "File_uploadedBy_idx" ON "File"("uploadedBy");
