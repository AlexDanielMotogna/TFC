-- Fight Audit Log Table
-- Captures ALL changes to fight status and settling_by fields
-- This helps diagnose race conditions in fight settlement

CREATE TABLE "fight_audit_log" (
    "id" SERIAL PRIMARY KEY,
    "fight_id" TEXT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT,
    "old_settling_by" TEXT,
    "new_settling_by" TEXT,
    "old_settling_at" TIMESTAMP(3),
    "new_settling_at" TIMESTAMP(3),
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pg_backend_pid" INTEGER DEFAULT pg_backend_pid(),
    "application_name" TEXT DEFAULT current_setting('application_name', true)
);

-- Index for efficient querying by fight_id
CREATE INDEX "fight_audit_log_fight_id_idx" ON "fight_audit_log"("fight_id");
CREATE INDEX "fight_audit_log_changed_at_idx" ON "fight_audit_log"("changed_at");

-- Trigger function to log fight status changes
CREATE OR REPLACE FUNCTION log_fight_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log if status OR settling_by OR settling_at changed
  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.settling_by IS DISTINCT FROM NEW.settling_by
     OR OLD.settling_at IS DISTINCT FROM NEW.settling_at THEN
    INSERT INTO fight_audit_log (
        fight_id,
        old_status,
        new_status,
        old_settling_by,
        new_settling_by,
        old_settling_at,
        new_settling_at
    )
    VALUES (
        NEW.id,
        OLD.status,
        NEW.status,
        OLD.settling_by,
        NEW.settling_by,
        OLD.settling_at,
        NEW.settling_at
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on fights table
CREATE TRIGGER fight_status_audit
AFTER UPDATE ON "fights"
FOR EACH ROW
EXECUTE FUNCTION log_fight_status_changes();
