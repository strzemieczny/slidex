// slidex-backend/prisma/seed.ts
import { PrismaClient, MaterialStatus, ChuteLane } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Wczytujemy zmienne z pliku .env
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🧹 Czyszczenie bazy danych...');
    await prisma.fifoViolationLog.deleteMany();
    await prisma.material.deleteMany();
    await prisma.chuteLane.deleteMany();
    await prisma.rack.deleteMany();

    console.log('🏗️ Tworzenie regału testowego RACK-01...');

    const rack = await prisma.rack.create({
        data: {
            code: 'RACK-01',
            name: 'Regał Grawitacyjny Buforowy A1',
            totalShelves: 3,
            totalColumns: 4,
            laneCapacity: 5,
        },
    });

    console.log('🛣️ Tworzenie torów grawitacyjnych (Lanes)...');
    const lanes: ChuteLane[] = [];

    for (let shelf = 1; shelf <= 3; shelf++) {
        for (let col = 1; col <= 4; col++) {
            const lane = await prisma.chuteLane.create({
                data: {
                    code: `RACK-01-S${shelf}-C${col}`,
                    shelf: shelf,
                    column: col,
                    rackId: rack.id,
                },
            });
            lanes.push(lane);
        }
    }

    console.log('📦 Zasilanie torów pojemnikami z ilością sztuk (quantity)...');

    const laneS1C1 = lanes.find((l) => l.code === 'RACK-01-S1-C1');
    if (laneS1C1) {
        await prisma.material.create({
            data: {
                barcode: 'BOX-OLDER-101',
                partNumber: 'PN-99281-A',
                quantity: 120,
                status: MaterialStatus.IN_CHUTE,
                laneId: laneS1C1.id,
                entryTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
            },
        });

        await prisma.material.create({
            data: {
                barcode: 'BOX-MID-102',
                partNumber: 'PN-99281-A',
                quantity: 120,
                status: MaterialStatus.IN_CHUTE,
                laneId: laneS1C1.id,
                entryTime: new Date(Date.now() - 1000 * 60 * 30),
            },
        });

        await prisma.material.create({
            data: {
                barcode: 'BOX-NEWEST-103',
                partNumber: 'PN-99281-A',
                quantity: 60,
                status: MaterialStatus.IN_CHUTE,
                laneId: laneS1C1.id,
                entryTime: new Date(Date.now() - 1000 * 60 * 5),
            },
        });
    }

    const laneS2C2 = lanes.find((l) => l.code === 'RACK-01-S2-C2');
    if (laneS2C2) {
        await prisma.material.create({
            data: {
                barcode: 'BOX-BEARING-50',
                partNumber: 'PN-BEARING-02',
                quantity: 250,
                status: MaterialStatus.IN_CHUTE,
                laneId: laneS2C2.id,
                entryTime: new Date(Date.now() - 1000 * 60 * 45),
            },
        });
    }

    console.log('✅ Seedowanie zakończone pomyślnie!');
}

main()
    .catch((e) => {
        console.error('❌ Błąd podczas seedowania:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });