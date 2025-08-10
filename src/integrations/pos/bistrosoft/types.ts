export interface BistroLine {
  sku?: string;
  name?: string;
  quantity: number;
  unit_price: number;
}

export interface BistrosoftSale {
  id: string | number;
  datetime: string | number | Date; // local datetime
  total: number;
  status?: string;
  lines?: BistroLine[];
  discounts_total?: number;
  taxes_total?: number;
  [k: string]: unknown;
}

export interface BistroFetchSalesParams {
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface BistroFetchSalesResponse {
  data: BistrosoftSale[];
  next?: string; // pagination token
}

export interface BistrosoftClient {
  validate(): Promise<boolean>;
  fetchSales(params: BistroFetchSalesParams): Promise<BistroFetchSalesResponse>;
}
