export interface FudoSaleItem {
  sku?: string;
  name?: string;
  quantity: number;
  price: number;
}

export interface FudoSale {
  id: string;
  created_at: string | number | Date;
  total: number;
  status?: string;
  items?: FudoSaleItem[];
  [k: string]: unknown;
}

export interface FudoFetchSalesParams {
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface FudoFetchSalesResponse {
  data: FudoSale[];
  nextCursor?: string;
}

export interface FudoClient {
  validate(): Promise<boolean>;
  fetchSales(params: FudoFetchSalesParams): Promise<FudoFetchSalesResponse>;
}
