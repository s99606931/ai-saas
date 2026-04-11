// 공공기관 보고서 템플릿 엔진 -- FR-N344.1~FR-N344.4
// Design Ref: MTU-N344 | CSAP: D-06, D-08

export interface ReportTemplate { readonly templateId: string; readonly name: string; readonly category: string; readonly body: string; readonly variables: readonly string[]; readonly createdAt: string; }
export interface RenderedReport { readonly reportId: string; readonly templateId: string; readonly tenantId: string; readonly format: 'html' | 'text'; readonly content: string; readonly renderedAt: string; }
export interface ReportTplAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: ReportTplAuditEntry[] = [];
function recordAudit(entry: Omit<ReportTplAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getReportTplAuditLog(tenantId: string): readonly ReportTplAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const templateStore: Map<string, ReportTemplate> = new Map();

export function createTemplate(templateId: string, name: string, category: string, body: string): ReportTemplate {
  const varRegex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = varRegex.exec(body)) !== null) { const v = match[1]; if (v && !variables.includes(v)) variables.push(v); }
  const template: ReportTemplate = { templateId, name, category, body, variables, createdAt: new Date().toISOString() };
  templateStore.set(templateId, template);
  return template;
}

export function getTemplate(templateId: string): ReportTemplate | null { return templateStore.get(templateId) ?? null; }

export function renderTemplate(tenantId: string, templateId: string, data: Record<string, string>, format: 'html' | 'text' = 'text'): RenderedReport {
  const template = templateStore.get(templateId);
  if (!template) throw new Error(`템플릿 미등록: ${templateId}`);
  let content = template.body;
  for (const [key, value] of Object.entries(data)) { content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value); }
  if (format === 'html') { content = `<div class="report">${content.replace(/\n/g, '<br/>')}</div>`; }
  recordAudit({ actor: 'system', tenantId, action: 'REPORT_RENDERED', target: templateId, details: { format, variables: Object.keys(data) } });
  return { reportId: `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, templateId, tenantId, format, content, renderedAt: new Date().toISOString() };
}

export class ReportTemplateEngineService {
  constructor(private readonly tenantId: string) {}
  create(id: string, name: string, cat: string, body: string): ReportTemplate { return createTemplate(id, name, cat, body); }
  get(id: string): ReportTemplate | null { return getTemplate(id); }
  render(templateId: string, data: Record<string, string>, format?: 'html' | 'text'): RenderedReport { return renderTemplate(this.tenantId, templateId, data, format); }
  getAuditLog(): readonly ReportTplAuditEntry[] { return getReportTplAuditLog(this.tenantId); }
}
