/**
 * Supplier / fulfilment adapter contract.
 *
 * Each supplier integration lives in its own adapter module and implements
 * only the capabilities the supplier's real, documented API supports.
 * Storefront and checkout code never call adapters directly — they work from
 * the local database. Adapters feed data into the database for manual review.
 *
 * No supplier integration is active by default. See docs/SUPPLIER_INTEGRATIONS.md.
 */
export type SupplierCapability =
  | "importProducts"
  | "syncCosts"
  | "syncStock"
  | "syncImages"
  | "deliveryEstimate"
  | "submitOrder"
  | "fulfilmentStatus"
  | "tracking";

export type SupplierProductData = {
  supplierSku: string;
  name: string;
  description?: string;
  costMinor?: number;
  costCurrency?: string;
  stockQuantity?: number | null;
  imageUrls?: { url: string; licenseNote?: string }[];
  productUrl?: string;
};

export type SupplierOrderLine = { supplierSku: string; quantity: number };
export type SupplierOrderRequest = {
  orderReference: string;
  lines: SupplierOrderLine[];
  shipTo: { fullName: string; phone: string; line1: string; line2?: string | null; city: string; state: string; country: string };
};

export type SupplierResult<T> = { ok: true; data: T } | { ok: false; error: string; retryable?: boolean };

export interface SupplierAdapter {
  key: string;
  displayName: string;
  capabilities: SupplierCapability[];
  /** Validates that credentials/config exist. Must not perform side effects. */
  checkConfiguration(): Promise<SupplierResult<{ message: string }>>;
  importProducts?(cursor?: string): Promise<SupplierResult<{ products: SupplierProductData[]; nextCursor?: string }>>;
  getProduct?(supplierSku: string): Promise<SupplierResult<SupplierProductData>>;
  getDeliveryEstimate?(supplierSku: string, state: string): Promise<SupplierResult<{ text: string }>>;
  submitOrder?(order: SupplierOrderRequest): Promise<SupplierResult<{ supplierOrderId: string }>>;
  getFulfilmentStatus?(supplierOrderId: string): Promise<SupplierResult<{ status: string; trackingNumber?: string; carrier?: string; trackingUrl?: string }>>;
}
