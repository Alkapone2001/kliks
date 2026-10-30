CREATE TYPE "MerchantStaffRole" AS ENUM ('MANAGER', 'VIEWER');
CREATE TABLE "merchant_profiles" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "merchant_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "merchant_profiles_name" CHECK (length(trim("display_name")) > 0)
);
CREATE UNIQUE INDEX "merchant_profiles_owner_id_key" ON "merchant_profiles"("owner_id");
CREATE TABLE "merchant_memberships" (
    "merchant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MerchantStaffRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_memberships_pkey" PRIMARY KEY ("merchant_id", "user_id")
);
CREATE INDEX "merchant_memberships_user_id_idx" ON "merchant_memberships"("user_id");
CREATE TABLE "merchant_requests" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "merchant_requests_request_id_key" ON "merchant_requests"("request_id");
CREATE INDEX "merchant_requests_merchant_id_created_at_idx" ON "merchant_requests"("merchant_id", "created_at");
ALTER TABLE "qr_payment_sessions" ADD COLUMN "merchant_id" UUID;
ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "merchant_memberships" ADD CONSTRAINT "merchant_memberships_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "merchant_memberships" ADD CONSTRAINT "merchant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "merchant_requests" ADD CONSTRAINT "merchant_requests_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "merchant_requests" ADD CONSTRAINT "merchant_requests_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "payment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "merchant_requests" ADD CONSTRAINT "merchant_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qr_payment_sessions" ADD CONSTRAINT "qr_payment_sessions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "qr_payment_sessions_merchant_id_created_at_idx" ON "qr_payment_sessions"("merchant_id", "created_at");