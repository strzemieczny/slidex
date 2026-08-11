DROP INDEX IF EXISTS "Material_laneId_idx";

CREATE UNIQUE INDEX "ChuteLane_code_key" ON "ChuteLane"("code");
CREATE INDEX "Material_laneId_status_entryTime_idx"
ON "Material"("laneId", "status", "entryTime");
