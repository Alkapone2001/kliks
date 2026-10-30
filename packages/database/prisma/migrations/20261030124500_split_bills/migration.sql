CREATE TYPE "SplitBillMode" AS ENUM ('EQUAL', 'CUSTOM');
CREATE TYPE "SplitBillState" AS ENUM ('OPEN', 'CANCELLED');

CREATE TABLE "split_bills" (
    "id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "total_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "mode" "SplitBillMode" NOT NULL,
    "state" "SplitBillState" NOT NULL DEFAULT 'OPEN',
    "idempotency_key" VARCHAR(128) NOT NULL,
    "request_fingerprint" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "split_bills_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "split_bills_valid_total" CHECK ("total_minor" > 0 AND "total_minor" <= 9007199254740991 AND "currency" = 'EUR'),
    CONSTRAINT "split_bills_title" CHECK (length(trim("title")) > 0)
);

CREATE TABLE "split_bill_shares" (
    "id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "request_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "split_bill_shares_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "split_bill_shares_valid_amount" CHECK ("amount_minor" > 0 AND "amount_minor" <= 9007199254740991),
    CONSTRAINT "split_bill_shares_position" CHECK ("position" >= 0 AND "position" < 20)
);

CREATE UNIQUE INDEX "split_bills_creator_id_idempotency_key_key" ON "split_bills"("creator_id", "idempotency_key");
CREATE INDEX "split_bills_creator_id_created_at_idx" ON "split_bills"("creator_id", "created_at");
CREATE UNIQUE INDEX "split_bill_shares_request_id_key" ON "split_bill_shares"("request_id");
CREATE UNIQUE INDEX "split_bill_shares_bill_id_user_id_key" ON "split_bill_shares"("bill_id", "user_id");
CREATE UNIQUE INDEX "split_bill_shares_bill_id_position_key" ON "split_bill_shares"("bill_id", "position");
CREATE INDEX "split_bill_shares_user_id_created_at_idx" ON "split_bill_shares"("user_id", "created_at");
ALTER TABLE "split_bills" ADD CONSTRAINT "split_bills_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "split_bill_shares" ADD CONSTRAINT "split_bill_shares_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "split_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "split_bill_shares" ADD CONSTRAINT "split_bill_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "split_bill_shares" ADD CONSTRAINT "split_bill_shares_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "payment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;