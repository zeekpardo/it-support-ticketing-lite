-- CreateEnum
CREATE TYPE "EmailRuleMatchType" AS ENUM ('EXACT_ADDRESS', 'DOMAIN', 'CATCH_ALL');

-- CreateEnum
CREATE TYPE "InboundEmailStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "email_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "match_type" "EmailRuleMatchType" NOT NULL,
    "match_value" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_emails" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "in_reply_to" TEXT,
    "subject" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "from_name" TEXT,
    "to" TEXT NOT NULL,
    "html_body" TEXT,
    "text_body" TEXT,
    "status" "InboundEmailStatus" NOT NULL DEFAULT 'PENDING',
    "processing_error" TEXT,
    "email_rule_id" TEXT,
    "ticket_id" TEXT,
    "comment_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "inbound_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_emails" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "comment_id" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email_type" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_rules_organization_id_is_active_idx" ON "email_rules"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "email_rules_match_type_match_value_idx" ON "email_rules"("match_type", "match_value");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_emails_message_id_key" ON "inbound_emails"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_emails_ticket_id_key" ON "inbound_emails"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_emails_comment_id_key" ON "inbound_emails"("comment_id");

-- CreateIndex
CREATE INDEX "inbound_emails_message_id_idx" ON "inbound_emails"("message_id");

-- CreateIndex
CREATE INDEX "inbound_emails_status_received_at_idx" ON "inbound_emails"("status", "received_at");

-- CreateIndex
CREATE INDEX "inbound_emails_from_idx" ON "inbound_emails"("from");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_emails_message_id_key" ON "outbound_emails"("message_id");

-- CreateIndex
CREATE INDEX "outbound_emails_message_id_idx" ON "outbound_emails"("message_id");

-- CreateIndex
CREATE INDEX "outbound_emails_ticket_id_idx" ON "outbound_emails"("ticket_id");

-- AddForeignKey
ALTER TABLE "email_rules" ADD CONSTRAINT "email_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_rules" ADD CONSTRAINT "email_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_email_rule_id_fkey" FOREIGN KEY ("email_rule_id") REFERENCES "email_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "ticket_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_emails" ADD CONSTRAINT "outbound_emails_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_emails" ADD CONSTRAINT "outbound_emails_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "ticket_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
