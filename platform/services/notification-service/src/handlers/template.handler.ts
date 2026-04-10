// 알림 템플릿 CRUD 핸들러
// Design Ref: DESIGN-MTU-Q2 §1 FR-P11.1
// Plan SC: FR-P11.1
// CSAP: D-12 입력 검증

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { logNotificationEvent } from '../lib/audit.js';

/**
 * 알림 템플릿 인터페이스
 * Mustache 패턴: {{변수명}} 치환 지원
 */
interface NotificationTemplate {
  id: string;
  name: string;
  channel: 'email' | 'in-app' | 'webhook';
  subject: string;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 인메모리 저장소 (단일 인스턴스)
// NOTE: 프로덕션에서는 DB 저장으로 전환 예정
const templateStore: Map<string, NotificationTemplate> = new Map();

// 기본 템플릿 초기화
const defaultTemplates: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'user_welcome',
    channel: 'email',
    subject: '{{userName}}님, 공공기관 SaaS 플랫폼에 오신 것을 환영합니다',
    body: '안녕하세요 {{userName}}님,\n\n{{tenantName}} 테넌트의 {{role}} 역할로 등록되었습니다.\n\n플랫폼 관리 포털: {{portalUrl}}',
    isActive: true,
  },
  {
    name: 'subscription_expiry',
    channel: 'email',
    subject: '[{{tenantName}}] 구독 만료 {{daysLeft}}일 전 안내',
    body: '{{tenantName}} 테넌트의 {{planName}} 구독이 {{daysLeft}}일 후 만료됩니다.\n\n갱신이 필요하시면 관리 포털에서 진행해 주세요.',
    isActive: true,
  },
  {
    name: 'security_alert',
    channel: 'in-app',
    subject: '[보안 알림] {{alertType}}',
    body: '{{description}}\n\n발생 시각: {{timestamp}}\n대상 IP: {{ip}}',
    isActive: true,
  },
  {
    name: 'webhook_default',
    channel: 'webhook',
    subject: '[공공SaaS] {{eventType}}',
    body: '{"event":"{{eventType}}","tenantId":"{{tenantId}}","timestamp":"{{timestamp}}","data":{{data}}}',
    isActive: true,
  },
];

// 기본 템플릿 등록
for (const tmpl of defaultTemplates) {
  const id = randomUUID();
  const now = new Date().toISOString();
  templateStore.set(id, { id, ...tmpl, createdAt: now, updatedAt: now });
}

// Zod 검증 스키마
const createTemplateSchema = z.object({
  name: z.string().min(1, '템플릿 이름은 필수입니다').max(100),
  channel: z.enum(['email', 'in-app', 'webhook']),
  subject: z.string().min(1, '제목 템플릿은 필수입니다').max(500),
  body: z.string().min(1, '본문 템플릿은 필수입니다'),
  isActive: z.boolean().default(true),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  channel: z.enum(['email', 'in-app', 'webhook']).optional(),
  subject: z.string().min(1).max(500).optional(),
  body: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Mustache 변수 치환
 * {{변수명}} 패턴을 실제 값으로 교체
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return variables[key] ?? `{{${key}}}`;
  });
}

/**
 * 템플릿 생성
 */
export async function createTemplateHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parseResult = createTemplateSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  // 이름 중복 검사
  const existing = Array.from(templateStore.values()).find((t) => t.name === parseResult.data.name);
  if (existing) {
    await reply.status(409).send({
      success: false,
      error: { code: 'TEMPLATE_EXISTS', message: `템플릿 '${parseResult.data.name}'이 이미 존재합니다` },
    });
    return;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const template: NotificationTemplate = {
    id,
    ...parseResult.data,
    createdAt: now,
    updatedAt: now,
  };

  templateStore.set(id, template);

  // CSAP D-06: 템플릿 생성 감사 로그
  const createActor = (request.headers['x-user-id'] as string) || 'system';
  await logNotificationEvent(
    'TEMPLATE_CREATED',
    createActor,
    id,
    (request.headers['x-user-tenant-id'] as string) || 'platform',
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { name: parseResult.data.name, channel: parseResult.data.channel },
  );

  await reply.status(201).send({ success: true, data: template });
}

/**
 * 템플릿 목록 조회
 */
export async function listTemplatesHandler(
  request: FastifyRequest<{ Querystring: { channel?: string; active?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  let templates = Array.from(templateStore.values());

  if (request.query.channel) {
    templates = templates.filter((t) => t.channel === request.query.channel);
  }

  if (request.query.active !== undefined) {
    const isActive = request.query.active === 'true';
    templates = templates.filter((t) => t.isActive === isActive);
  }

  await reply.send({ success: true, data: templates, total: templates.length });
}

/**
 * 템플릿 상세 조회
 */
export async function getTemplateHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const template = templateStore.get(request.params.id);
  if (!template) {
    await reply.status(404).send({
      success: false,
      error: { code: 'TEMPLATE_NOT_FOUND', message: '템플릿을 찾을 수 없습니다' },
    });
    return;
  }

  await reply.send({ success: true, data: template });
}

/**
 * 템플릿 수정
 */
export async function updateTemplateHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = updateTemplateSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const existing = templateStore.get(request.params.id);
  if (!existing) {
    await reply.status(404).send({
      success: false,
      error: { code: 'TEMPLATE_NOT_FOUND', message: '템플릿을 찾을 수 없습니다' },
    });
    return;
  }

  const updated: NotificationTemplate = {
    ...existing,
    ...parseResult.data,
    updatedAt: new Date().toISOString(),
  };

  templateStore.set(request.params.id, updated);

  // CSAP D-06: 템플릿 수정 감사 로그
  const updateActor = (request.headers['x-user-id'] as string) || 'system';
  await logNotificationEvent(
    'TEMPLATE_UPDATED',
    updateActor,
    request.params.id,
    (request.headers['x-user-tenant-id'] as string) || 'platform',
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { fields: Object.keys(parseResult.data) },
  );

  await reply.send({ success: true, data: updated });
}

/**
 * 템플릿 삭제
 */
export async function deleteTemplateHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  if (!templateStore.has(request.params.id)) {
    await reply.status(404).send({
      success: false,
      error: { code: 'TEMPLATE_NOT_FOUND', message: '템플릿을 찾을 수 없습니다' },
    });
    return;
  }

  templateStore.delete(request.params.id);

  // CSAP D-06: 템플릿 삭제 감사 로그
  const deleteActor = (request.headers['x-user-id'] as string) || 'system';
  await logNotificationEvent(
    'TEMPLATE_DELETED',
    deleteActor,
    request.params.id,
    (request.headers['x-user-tenant-id'] as string) || 'platform',
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
  );

  await reply.send({ success: true, message: '템플릿이 삭제되었습니다' });
}

/**
 * 템플릿 이름으로 조회 (내부 사용)
 */
export function getTemplateByName(name: string): NotificationTemplate | undefined {
  return Array.from(templateStore.values()).find((t) => t.name === name && t.isActive);
}
