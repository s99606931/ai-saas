// 테넌트별 UI 테마/화이트라벨 관리 -- FR-N333.1~FR-N333.4
// Design Ref: MTU-N333 | CSAP: D-06, D-08

export interface ThemeConfig { readonly themeId: string; readonly tenantId: string; readonly name: string; readonly primaryColor: string; readonly secondaryColor: string; readonly backgroundColor: string; readonly fontFamily: string; readonly logoUrl: string; readonly faviconUrl: string; readonly customCss: string; readonly createdAt: string; readonly updatedAt: string; }
export interface CSSVariables { readonly [key: string]: string; }
export interface ThemeAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: ThemeAuditEntry[] = [];
function recordAudit(entry: Omit<ThemeAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getThemeAuditLog(tenantId: string): readonly ThemeAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const themeStore: Map<string, ThemeConfig> = new Map();

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function validateColor(color: string): boolean { return COLOR_REGEX.test(color); }

export function createTheme(tenantId: string, name: string, opts: { primaryColor?: string; secondaryColor?: string; backgroundColor?: string; fontFamily?: string; logoUrl?: string; faviconUrl?: string; customCss?: string } = {}): ThemeConfig {
  const primary = opts.primaryColor ?? '#1a56db';
  const secondary = opts.secondaryColor ?? '#6b7280';
  if (!validateColor(primary)) throw new Error(`유효하지 않은 색상: ${primary}`);
  if (!validateColor(secondary)) throw new Error(`유효하지 않은 색상: ${secondary}`);
  const now = new Date().toISOString();
  const theme: ThemeConfig = { themeId: `theme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, name, primaryColor: primary, secondaryColor: secondary, backgroundColor: opts.backgroundColor ?? '#ffffff', fontFamily: opts.fontFamily ?? 'Pretendard, sans-serif', logoUrl: opts.logoUrl ?? '', faviconUrl: opts.faviconUrl ?? '', customCss: opts.customCss ?? '', createdAt: now, updatedAt: now };
  themeStore.set(tenantId, theme);
  recordAudit({ actor: 'system', tenantId, action: 'THEME_CREATED', target: theme.themeId, details: { name, primaryColor: primary } });
  return theme;
}

export function getTheme(tenantId: string): ThemeConfig | null { return themeStore.get(tenantId) ?? null; }

export function generateCSSVariables(theme: ThemeConfig): CSSVariables {
  return { '--color-primary': theme.primaryColor, '--color-secondary': theme.secondaryColor, '--color-background': theme.backgroundColor, '--font-family': theme.fontFamily, '--logo-url': `url('${theme.logoUrl}')` };
}

export function updateTheme(tenantId: string, updates: Partial<Pick<ThemeConfig, 'primaryColor' | 'secondaryColor' | 'backgroundColor' | 'fontFamily' | 'logoUrl' | 'faviconUrl' | 'customCss'>>): ThemeConfig | null {
  const existing = themeStore.get(tenantId);
  if (!existing) return null;
  if (updates.primaryColor && !validateColor(updates.primaryColor)) throw new Error(`유효하지 않은 색상: ${updates.primaryColor}`);
  const updated: ThemeConfig = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  themeStore.set(tenantId, updated);
  recordAudit({ actor: 'system', tenantId, action: 'THEME_UPDATED', target: existing.themeId, details: updates });
  return updated;
}

export class TenantThemeManagerService {
  constructor(private readonly tenantId: string) {}
  create(name: string, opts?: Parameters<typeof createTheme>[2]): ThemeConfig { return createTheme(this.tenantId, name, opts); }
  get(): ThemeConfig | null { return getTheme(this.tenantId); }
  cssVars(theme: ThemeConfig): CSSVariables { return generateCSSVariables(theme); }
  update(updates: Parameters<typeof updateTheme>[1]): ThemeConfig | null { return updateTheme(this.tenantId, updates); }
  getAuditLog(): readonly ThemeAuditEntry[] { return getThemeAuditLog(this.tenantId); }
}
