-- Data integrity constraints
ALTER TABLE "products" ADD CONSTRAINT "products_retail_price_nonneg" CHECK ("retail_price_kobo" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sale_price_valid" CHECK ("sale_price_kobo" IS NULL OR ("sale_price_kobo" >= 0 AND "sale_price_kobo" < "retail_price_kobo"));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_stock_nonneg" CHECK ("stock_quantity" IS NULL OR "stock_quantity" >= 0);--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "variants_stock_nonneg" CHECK ("stock_quantity" IS NULL OR "stock_quantity" >= 0);--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_qty_range" CHECK ("quantity" > 0 AND "quantity" <= 99);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_qty_pos" CHECK ("quantity" > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_nonneg" CHECK ("total_kobo" >= 0 AND "subtotal_kobo" >= 0 AND "shipping_kobo" >= 0);--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_amount_pos" CHECK ("amount_kobo" > 0);--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_one_primary" ON "product_images" ("product_id") WHERE "is_primary";
