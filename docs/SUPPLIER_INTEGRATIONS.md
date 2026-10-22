# Supplier integrations

No supplier is connected. Suppliers are records you create in Admin → Suppliers.

* `src/server/suppliers/types.ts` defines `SupplierAdapter` (test connection, fetch product/stock/price, create order).
* `src/server/suppliers/registry.ts` registers adapters by `adapterKey`. Only `manual` exists.
* To add one: implement the interface with the supplier's documented API, register it, add credentials as environment variables (never in the DB), set the supplier to `API`, and use "Check configuration". Results are written to `integration_logs`.
* Cost, stock and delivery estimates are only treated as verified when staff mark them so (cost verification timestamp) or an adapter returns them; margins are computed only from verified NGN costs.
