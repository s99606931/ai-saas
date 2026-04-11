// 다국어 리소스 관리 -- FR-N363.1~FR-N363.4
// Design Ref: MTU-N363 | CSAP: D-06, D-08

export interface LanguageResource { readonly locale: string; readonly key: string; readonly value: string; }
export interface TranslationBundle { readonly locale: string; readonly entries: Record<string, string>; readonly totalKeys: number; }
export interface MissingTranslation { readonly key: string; readonly missingLocales: readonly string[]; }
export interface LangAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: LangAuditEntry[] = [];
function recordAudit(entry: Omit<LangAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getLangAuditLog(tenantId: string): readonly LangAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const resourceStore: Map<string, Map<string, string>> = new Map(); // locale -> key -> value

export function addResource(locale: string, key: string, value: string): LanguageResource {
  const localeMap = resourceStore.get(locale) ?? new Map();
  localeMap.set(key, value);
  resourceStore.set(locale, localeMap);
  return { locale, key, value };
}

export function addBulkResources(locale: string, entries: Record<string, string>): number {
  for (const [key, value] of Object.entries(entries)) addResource(locale, key, value);
  return Object.keys(entries).length;
}

export function getTranslation(locale: string, key: string, fallbackLocale: string = 'ko'): string {
  const localeMap = resourceStore.get(locale);
  const value = localeMap?.get(key);
  if (value) return value;
  const fallback = resourceStore.get(fallbackLocale);
  return fallback?.get(key) ?? key;
}

export function getBundle(locale: string): TranslationBundle {
  const localeMap = resourceStore.get(locale) ?? new Map();
  const entries: Record<string, string> = {};
  for (const [k, v] of localeMap.entries()) entries[k] = v;
  return { locale, entries, totalKeys: localeMap.size };
}

export function findMissingTranslations(tenantId: string, baseLocale: string, targetLocales: string[]): MissingTranslation[] {
  const baseKeys = resourceStore.get(baseLocale);
  if (!baseKeys) return [];
  const missing: MissingTranslation[] = [];
  for (const key of baseKeys.keys()) {
    const missingLocales = targetLocales.filter(l => !resourceStore.get(l)?.has(key));
    if (missingLocales.length > 0) missing.push({ key, missingLocales });
  }
  recordAudit({ actor: 'system', tenantId, action: 'MISSING_TRANSLATIONS_CHECKED', target: tenantId, details: { baseLocale, targets: targetLocales, missing: missing.length } });
  return missing;
}

export class MultiLanguageManagerService {
  constructor(private readonly tenantId: string) {}
  add(locale: string, key: string, value: string): LanguageResource { return addResource(locale, key, value); }
  addBulk(locale: string, entries: Record<string, string>): number { return addBulkResources(locale, entries); }
  get(locale: string, key: string): string { return getTranslation(locale, key); }
  bundle(locale: string): TranslationBundle { return getBundle(locale); }
  missing(base: string, targets: string[]): MissingTranslation[] { return findMissingTranslations(this.tenantId, base, targets); }
  getAuditLog(): readonly LangAuditEntry[] { return getLangAuditLog(this.tenantId); }
}
