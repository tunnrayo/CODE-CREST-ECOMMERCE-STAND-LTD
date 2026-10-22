import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* ───────────────────────── Enums ───────────────────────── */
export const userRole = pgEnum("user_role", ["CUSTOMER", "STAFF", "ADMIN"]);
export const productStatus = pgEnum("product_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const verificationStatus = pgEnum("verification_status", ["UNVERIFIED", "SUPPLIER_VERIFIED"]);
export const stockStatus = pgEnum("stock_status", ["UNKNOWN", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]);
export const imageSourceType = pgEnum("image_source_type", [
  "ORIGINAL_ILLUSTRATION",
  "MANUFACTURER",
  "SUPPLIER",
  "STOCK_LICENSED",
  "ADMIN_UPLOAD",
  "PLACEHOLDER",
]);
export const imageLicenseStatus = pgEnum("image_license_status", ["OWNED", "PERMITTED", "LICENSED", "PENDING_PERMISSION", "UNKNOWN"]);
export const imageVerification = pgEnum("image_verification", ["VERIFIED", "PENDING", "NEEDS_REPLACEMENT"]);
export const supplierIntegrationType = pgEnum("supplier_integration_type", ["MANUAL", "API"]);
export const supplierIntegrationStatus = pgEnum("supplier_integration_status", ["NOT_CONFIGURED", "IN_REVIEW", "TEST", "ACTIVE", "DISABLED"]);
export const orderStatus = pgEnum("order_status", ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]);
export const paymentStatus = pgEnum("payment_status", ["UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED"]);
export const orderMode = pgEnum("order_mode", ["REQUEST", "LIVE"]);
export const txStatus = pgEnum("payment_tx_status", ["INITIATED", "PENDING", "SUCCESS", "FAILED", "ABANDONED", "REFUNDED"]);
export const txMode = pgEnum("payment_tx_mode", ["TEST", "LIVE"]);
export const notificationStatus = pgEnum("notification_status", ["QUEUED", "SENT", "FAILED", "NOT_CONFIGURED"]);

/* ───────────────────────── Users & auth ───────────────────────── */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    role: userRole("role").notNull().default("CUSTOMER"),
    isActive: boolean("is_active").notNull().default(true),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastLoginAt: ts("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the session token
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(), // sha256 of token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: createdAt(),
});

export const customerAddresses = pgTable("customer_addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull().default("NG"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: createdAt(),
});

/* ───────────────────────── Catalogue ───────────────────────── */
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  code: text("code"),
  position: integer("position").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull().unique(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
    description: text("description").notNull().default(""),
    /** Verified specifications only — key/value pairs. Empty until confirmed with a supplier. */
    specifications: jsonb("specifications").$type<{ label: string; value: string }[]>().notNull().default([]),
    keywords: text("keywords").notNull().default(""),
    status: productStatus("status").notNull().default("DRAFT"),
    isFeatured: boolean("is_featured").notNull().default(false),
    currency: text("currency").notNull().default("NGN"),
    /** Original planning price from the Word catalogue (NOT a supplier cost). */
    basePlanningPriceKobo: integer("base_planning_price_kobo"),
    /** Suggested retail price from the catalogue at import time (kept for audit). */
    catalogueSuggestedPriceKobo: integer("catalogue_suggested_price_kobo"),
    /** Current selling price displayed to customers. */
    retailPriceKobo: integer("retail_price_kobo").notNull(),
    /** Optional discounted price; must be lower than retail. */
    salePriceKobo: integer("sale_price_kobo"),
    verificationStatus: verificationStatus("verification_status").notNull().default("UNVERIFIED"),
    pricingNote: text("pricing_note"),
    catalogueSource: text("catalogue_source"),
    catalogueKey: text("catalogue_key").unique(),
    trackInventory: boolean("track_inventory").notNull().default(false),
    stockQuantity: integer("stock_quantity"),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    stockStatus: stockStatus("stock_status").notNull().default("UNKNOWN"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_status_idx").on(t.status),
    index("products_price_idx").on(t.retailPriceKobo),
    index("products_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.name} || ' ' || ${t.description} || ' ' || ${t.keywords})`,
    ),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    options: jsonb("options").$type<Record<string, string>>().notNull().default({}),
    priceOverrideKobo: integer("price_override_kobo"),
    trackInventory: boolean("track_inventory").notNull().default(false),
    stockQuantity: integer("stock_quantity"),
    isActive: boolean("is_active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  orderId: uuid("order_id"),
  actorUserId: uuid("actor_user_id"),
  createdAt: createdAt(),
});

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    storageKey: text("storage_key"),
    altText: text("alt_text").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    position: integer("position").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    sourceType: imageSourceType("source_type").notNull(),
    sourceName: text("source_name"),
    sourcePageUrl: text("source_page_url"),
    licenseStatus: imageLicenseStatus("license_status").notNull().default("UNKNOWN"),
    verificationStatus: imageVerification("verification_status").notNull().default("PENDING"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("images_product_idx").on(t.productId)],
);

/* ───────────────────────── Suppliers ───────────────────────── */
export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  website: text("website"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  country: text("country"),
  notes: text("notes"),
  integrationType: supplierIntegrationType("integration_type").notNull().default("MANUAL"),
  integrationStatus: supplierIntegrationStatus("integration_status").notNull().default("NOT_CONFIGURED"),
  adapterKey: text("adapter_key"),
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const supplierProducts = pgTable(
  "supplier_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    supplierSku: text("supplier_sku"),
    supplierProductUrl: text("supplier_product_url"),
    /** Verified supplier cost in minor units of costCurrency. */
    costMinor: integer("cost_minor"),
    costCurrency: text("cost_currency").notNull().default("NGN"),
    /** Additional procurement/shipping costs in kobo, if known. */
    additionalCostsKobo: integer("additional_costs_kobo"),
    additionalCostsNote: text("additional_costs_note"),
    costVerifiedAt: ts("cost_verified_at"),
    deliveryEstimateText: text("delivery_estimate_text"),
    deliveryEstimateSource: text("delivery_estimate_source"),
    isPrimary: boolean("is_primary").notNull().default(true),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("supplier_products_unique").on(t.supplierId, t.productId), index("supplier_products_product_idx").on(t.productId)],
);

export const integrationLogs = pgTable("integration_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  payload: jsonb("payload"),
  createdAt: createdAt(),
});

/* ───────────────────────── Carts ───────────────────────── */
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("cart_items_unique").on(t.cartId, t.productId, sql`coalesce(${t.variantId}, '00000000-0000-0000-0000-000000000000'::uuid)`)],
);

/* ───────────────────────── Shipping ───────────────────────── */
export const shippingZones = pgTable("shipping_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  countries: text("countries").array().notNull().default(sql`ARRAY['NG']::text[]`),
  states: text("states").array().notNull().default(sql`ARRAY[]::text[]`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const shippingMethods = pgTable("shipping_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id").notNull().references(() => shippingZones.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  /** null = fee not yet confirmed */
  feeKobo: integer("fee_kobo"),
  feeConfirmed: boolean("fee_confirmed").notNull().default(false),
  freeOverKobo: integer("free_over_kobo"),
  estimatedDeliveryText: text("estimated_delivery_text"),
  isActive: boolean("is_active").notNull().default(true),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

/* ───────────────────────── Orders & payments ───────────────────────── */
export type AddressSnapshot = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  country: string;
};

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    shippingAddress: jsonb("shipping_address").$type<AddressSnapshot>().notNull(),
    status: orderStatus("status").notNull().default("PENDING"),
    paymentStatus: paymentStatus("payment_status").notNull().default("UNPAID"),
    mode: orderMode("mode").notNull(),
    currency: text("currency").notNull().default("NGN"),
    subtotalKobo: integer("subtotal_kobo").notNull(),
    shippingKobo: integer("shipping_kobo").notNull().default(0),
    shippingConfirmed: boolean("shipping_confirmed").notNull().default(false),
    discountKobo: integer("discount_kobo").notNull().default(0),
    totalKobo: integer("total_kobo").notNull(),
    shippingMethodId: uuid("shipping_method_id").references(() => shippingMethods.id, { onDelete: "set null" }),
    shippingMethodName: text("shipping_method_name"),
    customerNote: text("customer_note"),
    accessTokenHash: text("access_token_hash").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status), index("orders_created_idx").on(t.createdAt)],
);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  variantName: text("variant_name"),
  imageUrl: text("image_url"),
  unitPriceKobo: integer("unit_price_kobo").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotalKobo: integer("line_total_kobo").notNull(),
});

export const orderStatusHistory = pgTable("order_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  actorUserId: uuid("actor_user_id"),
  createdAt: createdAt(),
});

export const orderNotes = pgTable("order_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const shipments = pgTable("shipments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  carrier: text("carrier").notNull(),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  status: text("status").notNull().default("CREATED"),
  /** true only when tracking data came from a verified carrier integration */
  carrierDataVerified: boolean("carrier_data_verified").notNull().default(false),
  shippedAt: ts("shipped_at"),
  deliveredAt: ts("delivered_at"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    reference: text("reference").notNull().unique(),
    amountKobo: integer("amount_kobo").notNull(),
    currency: text("currency").notNull(),
    status: txStatus("status").notNull().default("INITIATED"),
    mode: txMode("mode").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    gatewayResponse: text("gateway_response"),
    verificationData: jsonb("verification_data"),
    verifiedAt: ts("verified_at"),
    verifiedVia: text("verified_via"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payment_tx_order_idx").on(t.orderId)],
);

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  eventKey: text("event_key").notNull().unique(),
  eventType: text("event_type").notNull(),
  signatureValid: boolean("signature_valid").notNull(),
  processedAt: ts("processed_at"),
  result: text("result"),
  receivedAt: ts("received_at").notNull().defaultNow(),
});

/* ───────────────────────── Marketing & content ───────────────────────── */
export const promotions = pgTable("promotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  badge: text("badge"),
  ctaLabel: text("cta_label"),
  ctaHref: text("cta_href"),
  placement: text("placement").notNull().default("HOME_STRIP"),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export const storeSettings = pgTable("store_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
  updatedBy: uuid("updated_by"),
});

export const policyPages = pgTable("policy_pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isReviewed: boolean("is_reviewed").notNull().default(false),
  updatedAt: updatedAt(),
});

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    status: text("status").notNull().default("SUBSCRIBED"),
    source: text("source"),
    consentAt: ts("consent_at").notNull().defaultNow(),
    unsubscribedAt: ts("unsubscribed_at"),
  },
  (t) => [uniqueIndex("newsletter_email_idx").on(sql`lower(${t.email})`)],
);

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("NEW"),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: notificationStatus("status").notNull().default("QUEUED"),
  provider: text("provider"),
  error: text("error"),
  relatedOrderId: uuid("related_order_id"),
  createdAt: createdAt(),
  sentAt: ts("sent_at"),
});

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id"),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);
