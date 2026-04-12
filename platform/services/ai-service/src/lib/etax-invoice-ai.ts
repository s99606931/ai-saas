// Design Ref: MTU-N439 §전자세금계산서 AI
// Plan SC: FR-N439.1~5

export interface EtaxInvoice {
  approvalNumber: string;
  issueDate: string;
  supplierBizNo: string;
  supplierName: string;
  buyerBizNo: string;
  buyerName: string;
  itemName: string;
  supplyAmountKrw: number;
  vatKrw: number;
  totalKrw: number;
}

export interface FieldValidation {
  approvalNumber: string;
  valid: boolean;
  errors: string[];
}

export interface VatCheck {
  approvalNumber: string;
  expectedVat: number;
  actualVat: number;
  diff: number;
  valid: boolean;
}

export interface DuplicateGroup {
  approvalNumber: string;
  count: number;
}

export interface AnomalyList {
  invalidFields: FieldValidation[];
  duplicates: DuplicateGroup[];
  vatMismatches: VatCheck[];
}

export class EtaxInvoiceAi {
  /** FR-N439.1 XML 파싱 (단순 key-value 매핑 가정) */
  parseInvoice(xmlLike: Record<string, string>): EtaxInvoice | null {
    const required = ['approvalNumber', 'issueDate', 'supplierBizNo', 'buyerBizNo', 'itemName'];
    for (const k of required) {
      if (!xmlLike[k]) return null;
    }
    return {
      approvalNumber: xmlLike['approvalNumber'] ?? '',
      issueDate: xmlLike['issueDate'] ?? '',
      supplierBizNo: xmlLike['supplierBizNo'] ?? '',
      supplierName: xmlLike['supplierName'] ?? '',
      buyerBizNo: xmlLike['buyerBizNo'] ?? '',
      buyerName: xmlLike['buyerName'] ?? '',
      itemName: xmlLike['itemName'] ?? '',
      supplyAmountKrw: Number(xmlLike['supplyAmountKrw'] ?? 0),
      vatKrw: Number(xmlLike['vatKrw'] ?? 0),
      totalKrw: Number(xmlLike['totalKrw'] ?? 0),
    };
  }

  /** FR-N439.2 필드 검증 */
  validateFields(invoice: EtaxInvoice): FieldValidation {
    const errors: string[] = [];
    if (!/^\d{10}$/.test(invoice.supplierBizNo)) errors.push('공급자 사업자번호 형식 오류');
    if (!/^\d{10}$/.test(invoice.buyerBizNo)) errors.push('공급받는자 사업자번호 형식 오류');
    if (invoice.supplyAmountKrw <= 0) errors.push('공급가액 0 이하');
    if (!invoice.itemName) errors.push('품명 누락');
    if (!invoice.approvalNumber) errors.push('승인번호 누락');
    return { approvalNumber: invoice.approvalNumber, valid: errors.length === 0, errors };
  }

  /** FR-N439.3 중복 검출 */
  detectDuplicates(invoices: EtaxInvoice[]): DuplicateGroup[] {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      map.set(inv.approvalNumber, (map.get(inv.approvalNumber) ?? 0) + 1);
    }
    const dups: DuplicateGroup[] = [];
    for (const [num, count] of map) {
      if (count > 1) dups.push({ approvalNumber: num, count });
    }
    return dups;
  }

  /** FR-N439.4 VAT 자동 계산 검증 */
  verifyVat(invoice: EtaxInvoice): VatCheck {
    const expected = Math.round(invoice.supplyAmountKrw * 0.1);
    const diff = invoice.vatKrw - expected;
    return {
      approvalNumber: invoice.approvalNumber,
      expectedVat: expected,
      actualVat: invoice.vatKrw,
      diff,
      valid: Math.abs(diff) <= 1,
    };
  }

  /** FR-N439.5 이상 건 리스트 */
  listAnomalies(invoices: EtaxInvoice[]): AnomalyList {
    const invalid = invoices.map((i) => this.validateFields(i)).filter((r) => !r.valid);
    const dups = this.detectDuplicates(invoices);
    const vatIssues = invoices.map((i) => this.verifyVat(i)).filter((r) => !r.valid);
    return { invalidFields: invalid, duplicates: dups, vatMismatches: vatIssues };
  }
}

export const etaxInvoiceAi = new EtaxInvoiceAi();
