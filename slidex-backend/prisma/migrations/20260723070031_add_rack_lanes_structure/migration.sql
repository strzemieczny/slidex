-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('IN_CHUTE', 'CONSUMED', 'REMOVED');

-- CreateEnum
CREATE TYPE "RackStatus" AS ENUM ('OK', 'WARNING_LOW', 'FULL', 'BLOCKED');

-- CreateTable
CREATE TABLE "Rack" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "totalShelves" INTEGER NOT NULL DEFAULT 3,
    "totalColumns" INTEGER NOT NULL DEFAULT 4,
    "laneCapacity" INTEGER NOT NULL DEFAULT 5,
    "status" "RackStatus" NOT NULL DEFAULT 'OK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChuteLane" (
    "id" TEXT NOT NULL,
    "rackId" TEXT NOT NULL,
    "shelf" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "ChuteLane_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "status" "MaterialStatus" NOT NULL DEFAULT 'IN_CHUTE',
    "laneId" TEXT NOT NULL,
    "entryTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitTime" TIMESTAMP(3),

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FifoViolationLog" (
    "id" TEXT NOT NULL,
    "rackId" TEXT NOT NULL,
    "scannedBarcode" TEXT NOT NULL,
    "expectedBarcode" TEXT NOT NULL,
    "locationCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FifoViolationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rack_code_key" ON "Rack"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ChuteLane_rackId_shelf_column_key" ON "ChuteLane"("rackId", "shelf", "column");

-- CreateIndex
CREATE INDEX "Material_laneId_status_entryTime_idx" ON "Material"("laneId", "status", "entryTime");

-- AddForeignKey
ALTER TABLE "ChuteLane" ADD CONSTRAINT "ChuteLane_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "Rack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "ChuteLane"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FifoViolationLog" ADD CONSTRAINT "FifoViolationLog_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "Rack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
