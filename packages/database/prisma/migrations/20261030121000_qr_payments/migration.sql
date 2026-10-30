CREATE TABLE "qr_payment_sessions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "amount_minor" BIGINT,
    "currency" CHAR(3) NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "payment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qr_payment_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "qr_payment_sessions_valid_amount" CHECK (("amount_minor" IS NULL OR ("amount_minor" > 0 AND "amount_minor" <= 9007199254740991)) AND "currency" = 'EUR'),
    CONSTRAINT "qr_payment_sessions_consumption_link" CHECK (("consumed_at" IS NULL) = ("payment_id" IS NULL)),
    CONSTRAINT "qr_payment_sessions_expiry" CHECK ("expires_at" > "created_at")
);

CREATE UNIQUE INDEX "qr_payment_sessions_payment_id_key" ON "qr_payment_sessions"("payment_id");
CREATE UNIQUE INDEX "qr_payment_sessions_owner_id_idempotency_key_key" ON "qr_payment_sessions"("owner_id", "idempotency_key");
CREATE INDEX "qr_payment_sessions_owner_id_created_at_idx" ON "qr_payment_sessions"("owner_id", "created_at");
ALTER TABLE "qr_payment_sessions" ADD CONSTRAINT "qr_payment_sessions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qr_payment_sessions" ADD CONSTRAINT "qr_payment_sessions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;