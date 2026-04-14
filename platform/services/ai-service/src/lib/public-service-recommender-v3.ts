// Design Ref: §N2SF — C/S등급 BLOCKED, 매칭: category∈requested&&region매칭&&ageGroup∈ageGroups
// Plan SC: SC-R571-1, SC-R571-2, SC-R571-3

interface ServiceEntry {
  serviceId: string;
  category: string;
  region: string;
  ageGroups: string[];
}

interface RecommendInput {
  userId: string;
  dataGrade: 'C' | 'S' | 'O';
  ageGroup: string;
  region: string;
  requestedCategories: string[];
  availableServices: ServiceEntry[];
}

interface RecommendResult {
  userIdMasked: string;
  recommendedServices: string[];
  totalMatched: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  userIdMasked: string;
  totalMatched: number;
  grade: string;
}

export class PublicServiceRecommenderV3 {
  private readonly auditLog: AuditEntry[] = [];

  recommend(input: RecommendInput): RecommendResult {
    const { userId, dataGrade, ageGroup, region, requestedCategories, availableServices } = input;

    // Plan SC: N2SF N-05 — C/S 등급 AI 전송 금지
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }

    const userIdMasked = this.maskId(userId);

    const matched = availableServices.filter(
      (svc) =>
        requestedCategories.includes(svc.category) &&
        (svc.region === 'ALL' || svc.region === region) &&
        svc.ageGroups.includes(ageGroup),
    );

    const recommendedServices = matched.map((s) => s.serviceId);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SERVICE_RECOMMENDED',
      userIdMasked,
      totalMatched: recommendedServices.length,
      grade: dataGrade,
    });

    return { userIdMasked, recommendedServices, totalMatched: recommendedServices.length };
  }

  private maskId(id: string): string {
    if (id.length < 4) return '***';
    return id.slice(0, 2) + '***' + id.slice(-2);
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
