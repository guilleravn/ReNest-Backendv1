-- CreateEnum
CREATE TYPE "listing_condition" AS ENUM ('LIKE_NEW', 'GENTLY_USED', 'HEAVILY_USED');

-- CreateEnum
CREATE TYPE "listing_status" AS ENUM ('ACTIVE', 'PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "phone_e164" VARCHAR(20),
    "city" VARCHAR(100) NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "condition" "listing_condition" NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "status" "listing_status" NOT NULL DEFAULT 'ACTIVE',
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_photos" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listing_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_options" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "location_label" VARCHAR(120) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "weekdays" "weekday"[],
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pickup_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "listings_status_published_at_idx" ON "listings"("status", "published_at");

-- CreateIndex
CREATE INDEX "listings_status_category_id_idx" ON "listings"("status", "category_id");

-- CreateIndex
CREATE INDEX "listings_seller_id_status_idx" ON "listings"("seller_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "listing_photos_listing_id_position_key" ON "listing_photos"("listing_id", "position");

-- CreateIndex
CREATE INDEX "pickup_options_listing_id_idx" ON "pickup_options"("listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_options_id_listing_id_key" ON "pickup_options"("id", "listing_id");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_options" ADD CONSTRAINT "pickup_options_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written constraints (Prisma does not generate CHECKs). See docs/erd.dbml and
-- docs/rules/business-invariants.md.

-- Prisma creates scalar lists as nullable arrays; a NULL array would bypass the cardinality CHECK.
ALTER TABLE "pickup_options" ALTER COLUMN "weekdays" SET NOT NULL;

-- Minimum price is $1 (USD minor units).
ALTER TABLE "listings" ADD CONSTRAINT "listings_price_cents_check" CHECK ("price_cents" >= 100);

-- A pickup option needs at least one weekday, a non-empty location and address, and a valid hour range.
ALTER TABLE "pickup_options" ADD CONSTRAINT "pickup_options_weekdays_check" CHECK (cardinality("weekdays") >= 1);
ALTER TABLE "pickup_options" ADD CONSTRAINT "pickup_options_location_label_check" CHECK (btrim("location_label") <> '');
ALTER TABLE "pickup_options" ADD CONSTRAINT "pickup_options_address_check" CHECK (btrim("address") <> '');
ALTER TABLE "pickup_options" ADD CONSTRAINT "pickup_options_time_range_check" CHECK ("end_time" > "start_time");
