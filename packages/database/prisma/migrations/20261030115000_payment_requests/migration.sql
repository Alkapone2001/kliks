CREATE TYPE "PaymentRequestState" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

CREATE TABLE "payment_requests" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "payer_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "state" "PaymentRequestState" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(128) NOT NULL,
    "payment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_requests_distinct_participants" CHECK ("requester_id" <> "payer_id"),
    CONSTRAINT "payment_requests_valid_amount" CHECK ("amount_minor" > 0 AND "amount_minor" <= 9007199254740991 AND "currency" = 'EUR'),
    CONSTRAINT "payment_requests_payment_link" CHECK (("state" = 'ACCEPTED') = ("payment_id" IS NOT NULL))
);

CREATE UNIQUE INDEX "payment_requests_payment_id_key" ON "payment_requests"("payment_id");
CREATE UNIQUE INDEX "payment_requests_requester_id_idempotency_key_key" ON "payment_requests"("requester_id", "idempotency_key");
CREATE INDEX "payment_requests_requester_id_created_at_idx" ON "payment_requests"("requester_id", "created_at");
CREATE INDEX "payment_requests_payer_id_created_at_idx" ON "payment_requests"("payer_id", "created_at");

ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;