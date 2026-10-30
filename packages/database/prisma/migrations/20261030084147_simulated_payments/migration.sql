-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('CREATED', 'REQUIRES_AUTHORIZATION', 'PROCESSING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "payer_id" UUID NOT NULL,
    "payee_id" UUID NOT NULL,
    "payer_account_id" UUID NOT NULL,
    "payee_account_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "request_fingerprint" CHAR(64) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "state" "PaymentState" NOT NULL DEFAULT 'CREATED',
    "provider_reference" VARCHAR(100),
    "failure_code" VARCHAR(40),
    "simulation" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_reference_key" ON "payments"("provider_reference");

-- CreateIndex
CREATE INDEX "payments_payer_id_created_at_idx" ON "payments"("payer_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_payee_id_created_at_idx" ON "payments"("payee_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_payer_id_idempotency_key_key" ON "payments"("payer_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_account_id_fkey" FOREIGN KEY ("payer_account_id") REFERENCES "linked_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payee_account_id_fkey" FOREIGN KEY ("payee_account_id") REFERENCES "linked_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
