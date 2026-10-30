-- CreateEnum
CREATE TYPE "LinkedBankAccountStatus" AS ENUM ('PENDING_AUTHORIZATION', 'CONNECTED', 'REJECTED', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "linked_bank_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "connector_id" VARCHAR(40) NOT NULL,
    "provider_account_reference" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "connection_status" "LinkedBankAccountStatus" NOT NULL DEFAULT 'PENDING_AUTHORIZATION',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linked_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(64) NOT NULL,
    "entity_id" VARCHAR(64) NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "linked_bank_accounts_provider_account_reference_key" ON "linked_bank_accounts"("provider_account_reference");

-- CreateIndex
CREATE INDEX "linked_bank_accounts_user_id_connection_status_idx" ON "linked_bank_accounts"("user_id", "connection_status");

-- CreateIndex
CREATE INDEX "linked_bank_accounts_user_id_created_at_idx" ON "linked_bank_accounts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_entity_id_occurred_at_idx" ON "audit_events"("entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_event_type_occurred_at_idx" ON "audit_events"("event_type", "occurred_at");

-- AddForeignKey
ALTER TABLE "linked_bank_accounts" ADD CONSTRAINT "linked_bank_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
