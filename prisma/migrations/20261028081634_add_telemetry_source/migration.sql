-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "device_id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "asn_number" INTEGER NOT NULL DEFAULT 0,
    "page_dwell_time" REAL NOT NULL,
    "is_off_peak" INTEGER NOT NULL DEFAULT 0,
    "hardware_mismatch" INTEGER NOT NULL DEFAULT 0,
    "telemetry_source" TEXT NOT NULL DEFAULT 'UNSPECIFIED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fee_invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("amount", "asn_number", "created_at", "device_id", "hardware_mismatch", "id", "invoice_id", "ip_address", "is_off_peak", "page_dwell_time", "reference", "status", "student_id", "updated_at") SELECT "amount", "asn_number", "created_at", "device_id", "hardware_mismatch", "id", "invoice_id", "ip_address", "is_off_peak", "page_dwell_time", "reference", "status", "student_id", "updated_at" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");
CREATE INDEX "transactions_device_id_created_at_idx" ON "transactions"("device_id", "created_at");
CREATE INDEX "transactions_student_id_status_created_at_idx" ON "transactions"("student_id", "status", "created_at");
CREATE INDEX "transactions_device_id_student_id_created_at_idx" ON "transactions"("device_id", "student_id", "created_at");
CREATE INDEX "transactions_telemetry_source_created_at_idx" ON "transactions"("telemetry_source", "created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
