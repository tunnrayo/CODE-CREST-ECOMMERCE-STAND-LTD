import type { SupplierAdapter } from "./types";

/**
 * Manual adapter — the default. Supplier data (costs, stock, references) is
 * entered by staff in Admin → Suppliers. It performs no network calls.
 */
export const manualAdapter: SupplierAdapter = {
  key: "manual",
  displayName: "Manual (no API)",
  capabilities: [],
  async checkConfiguration() {
    return { ok: true, data: { message: "Manual supplier — data is maintained by Code Crest staff. No API connection." } };
  },
};

/**
 * Register real adapters here once a supplier has approved Code Crest,
 * provided API documentation and credentials, and a test environment exists.
 * Example: `import { exampleSupplierAdapter } from "./adapters/example";`
 */
const ADAPTERS: Record<string, SupplierAdapter> = {
  [manualAdapter.key]: manualAdapter,
};

export function getAdapter(key: string | null | undefined): SupplierAdapter {
  return (key && ADAPTERS[key]) || manualAdapter;
}

export function listAdapters() {
  return Object.values(ADAPTERS).map((a) => ({ key: a.key, displayName: a.displayName, capabilities: a.capabilities }));
}
