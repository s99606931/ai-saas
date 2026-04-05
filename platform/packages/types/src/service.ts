// SaaS 서비스 타입
// Design Ref: D-P00.2

/**
 * Feature Flag
 */
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

/**
 * SaaS 서비스 정의
 */
export interface ServiceDefinition {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  version: string;
  isBuiltIn: boolean;
  isActive: boolean;
  featureFlags: FeatureFlag[];
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
