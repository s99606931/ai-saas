// Design Ref: MTU-ECO3 Design 2.2
// Plan SC: FR-ECO3.5

/**
 * 공공데이터포털(data.go.kr) API 클라이언트
 *
 * 공공데이터포털 OpenAPI를 호출하여 데이터셋을 검색/조회합니다.
 * API 키는 환경 변수(DATA_PORTAL_API_KEY)로 관리합니다.
 *
 * 참조: https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do
 */

const DATA_PORTAL_BASE_URL = 'https://api.data.go.kr/openapi';

interface DatasetInfo {
  id: string;
  title: string;
  description: string;
  category: string;
  format: string;
  provider: string;
  updatedAt: string;
  downloadUrl: string;
}

interface SearchResult {
  items: DatasetInfo[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 공공데이터포털 API 클라이언트
 */
export class DataPortalClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DATA_PORTAL_API_KEY || '';
    this.baseUrl = DATA_PORTAL_BASE_URL;

    if (!this.apiKey) {
      process.stderr.write('DATA_PORTAL_API_KEY 환경 변수가 설정되지 않았습니다. 샘플 데이터를 반환합니다.\n');
    }
  }

  /**
   * 데이터셋 검색
   */
  async searchDatasets(params: {
    keyword?: string;
    category?: string;
    format?: string;
    page: number;
    limit: number;
  }): Promise<SearchResult> {
    // API 키가 없는 경우 샘플 데이터 반환
    if (!this.apiKey) {
      return this.getSampleData(params);
    }

    const url = new URL(`${this.baseUrl}/datasets`);
    if (params.keyword) url.searchParams.set('keyword', params.keyword);
    if (params.category) url.searchParams.set('category', params.category);
    url.searchParams.set('page', String(params.page));
    url.searchParams.set('perPage', String(params.limit));

    // CSAP D-09: API 키를 URL 쿼리 파라미터 대신 헤더로 전달 (서버 로그 노출 방지)
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`공공데이터포털 API 오류: ${response.status}`);
    }

    const data = await response.json();
    return {
      items: data.items || [],
      total: data.totalCount || 0,
      page: params.page,
      limit: params.limit,
    };
  }

  /**
   * 데이터셋 상세 조회
   */
  async getDataset(id: string): Promise<DatasetInfo | null> {
    if (!this.apiKey) {
      return {
        id,
        title: `샘플 데이터셋 ${id}`,
        description: '공공데이터포털 API 키가 설정되지 않아 샘플 데이터를 반환합니다.',
        category: 'general',
        format: 'json',
        provider: '샘플 기관',
        updatedAt: new Date().toISOString(),
        downloadUrl: `https://api.data.go.kr/openapi/datasets/${id}/download`,
      };
    }

    // CSAP D-09: API 키를 헤더로 전달
    const url = `${this.baseUrl}/datasets/${id}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) return null;
    return response.json();
  }

  /**
   * 데이터셋 데이터 조회
   */
  async getDatasetData(id: string): Promise<unknown> {
    if (!this.apiKey) {
      return {
        datasetId: id,
        data: [
          { id: 1, name: '서울특별시', population: 9776000 },
          { id: 2, name: '부산광역시', population: 3404000 },
          { id: 3, name: '대구광역시', population: 2418000 },
        ],
        message: '샘플 데이터 (API 키 미설정)',
      };
    }

    // CSAP D-09: API 키를 헤더로 전달
    const url = `${this.baseUrl}/datasets/${id}/data`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`데이터 조회 실패: ${response.status}`);
    }
    return response.json();
  }

  private getSampleData(params: { keyword?: string; page: number; limit: number }): SearchResult {
    const sampleItems: DatasetInfo[] = [
      {
        id: 'sample-001',
        title: '전국 인구 통계',
        description: '시도별 인구 현황 데이터',
        category: 'society',
        format: 'json',
        provider: '통계청',
        updatedAt: '2026-03-01',
        downloadUrl: 'https://api.data.go.kr/openapi/datasets/sample-001/download',
      },
      {
        id: 'sample-002',
        title: '공공 WiFi 위치 정보',
        description: '전국 공공 WiFi 설치 위치',
        category: 'general',
        format: 'csv',
        provider: '과학기술정보통신부',
        updatedAt: '2026-02-15',
        downloadUrl: 'https://api.data.go.kr/openapi/datasets/sample-002/download',
      },
    ];

    const filtered = params.keyword
      ? sampleItems.filter((item) => item.title.includes(params.keyword!) || item.description.includes(params.keyword!))
      : sampleItems;

    return {
      items: filtered,
      total: filtered.length,
      page: params.page,
      limit: params.limit,
    };
  }
}
