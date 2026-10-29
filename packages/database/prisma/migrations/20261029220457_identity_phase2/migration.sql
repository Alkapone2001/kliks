-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone_number" VARCHAR(16) NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "phone_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_verification_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "salt" VARCHAR(32) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_verification_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "phone_verification_challenges_user_id_expires_at_idx" ON "phone_verification_challenges"("user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "phone_verification_challenges" ADD CONSTRAINT "phone_verification_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
