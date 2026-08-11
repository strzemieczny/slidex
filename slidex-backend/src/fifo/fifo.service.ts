import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, MaterialStatus, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { ScanInDto, ScanOutDto } from './dto/scan.dto';
import { CreateRackDto, UpdateRackDto } from './dto/rack.dto';
import { FifoGateway } from './fifo.gateway';

dotenv.config();

@Injectable()
export class FifoService implements OnModuleInit, OnModuleDestroy {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor(private readonly fifoGateway: FifoGateway) {
    const connectionString = process.env.DATABASE_URL;
    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool);
    this.prisma = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    await this.pool.end();
  }

  // -------------------------------------------------------------
  // 0. OBSŁUGA STREF / GRUP (RACK GROUPS)
  // -------------------------------------------------------------
  async getGroups() {
    return await this.prisma.rackGroup.findMany({
      include: {
        racks: {
          orderBy: { position: 'asc' }, // 🚀 Sortujemy regały wewnątrz strefy wg kolejności
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createGroup(data: { code: string; name: string }) {
    return await this.prisma.rackGroup.create({
      data: {
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
      },
    });
  }

  async updateGroup(id: string, data: { code?: string; name?: string }) {
    const updateData: Prisma.RackGroupUpdateInput = {};

    if (data.code) {
      updateData.code = data.code.toUpperCase().trim();
    }
    if (data.name) {
      updateData.name = data.name.trim();
    }

    return await this.prisma.rackGroup.update({
      where: { id },
      data: updateData,
      include: {
        racks: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  async deleteGroup(id: string) {
    // Odfalowywanie powiązań z regałami przed usunięciem strefy
    await this.prisma.rack.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    return await this.prisma.rackGroup.delete({
      where: { id },
    });
  }

  // -------------------------------------------------------------
  // 1. POBIERANIE PODGLĄDU REGAŁÓW (REST / Overview)
  // -------------------------------------------------------------
  async getRackOverview(rackCode?: string) {
    return await this.prisma.rack.findMany({
      where: rackCode ? { code: rackCode } : undefined,
      orderBy: { position: 'asc' }, // 🚀 Pobieranie regałów posortowanych wg pozycji
      include: {
        group: true,
        lanes: {
          include: {
            materials: {
              where: { status: MaterialStatus.IN_CHUTE },
              orderBy: { entryTime: 'asc' },
              select: {
                id: true,
                barcode: true,
                partNumber: true,
                quantity: true,
                entryTime: true,
                status: true,
                laneId: true,
              },
            },
          },
          orderBy: [{ shelf: 'asc' }, { column: 'asc' }],
        },
      },
    });
  }

  // -------------------------------------------------------------
  // 2. SKANOWANIE WJAZDOWE (SCAN IN z blokadą 1 P/N per Tor)
  // -------------------------------------------------------------
  async scanIn(dto: ScanInDto) {
    const lane = await this.prisma.chuteLane.findFirst({
      where: { code: dto.laneCode },
      include: {
        materials: {
          where: { status: MaterialStatus.IN_CHUTE },
          take: 1,
        },
      },
    });

    if (!lane) {
      throw new Error(`Tor o kodzie ${dto.laneCode} nie istnieje.`);
    }

    if (lane.materials && lane.materials.length > 0) {
      const existingPartNumber = lane.materials[0].partNumber;

      if (existingPartNumber !== dto.partNumber) {
        this.fifoGateway.notifyFifoViolation(
          dto.laneCode,
          dto.partNumber,
          existingPartNumber,
        );

        throw new Error(
          `⛔ BLOKADA TORU! Tor ${dto.laneCode} zawiera już materiał (${existingPartNumber}). Nie można mieszać różnych Part Numberów na jednym torze!`,
        );
      }
    }

    const material = await this.prisma.material.create({
      data: {
        barcode: dto.barcode,
        partNumber: dto.partNumber,
        quantity: dto.quantity || 1,
        status: MaterialStatus.IN_CHUTE,
        laneId: lane.id,
      },
    });

    this.fifoGateway.notifyLaneUpdated(dto.laneCode, 'IN');

    return material;
  }

  // -------------------------------------------------------------
  // 3. SKANOWANIE WYJAZDOWE (SCAN OUT z Kontrolą FIFO)
  // -------------------------------------------------------------
  async scanOut(dto: ScanOutDto) {
    const lane = await this.prisma.chuteLane.findFirst({
      where: { code: dto.laneCode },
      include: {
        materials: {
          where: { status: MaterialStatus.IN_CHUTE },
          orderBy: { entryTime: 'asc' },
        },
      },
    });

    if (!lane || lane.materials.length === 0) {
      throw new Error(`Tor ${dto.laneCode} jest pusty.`);
    }

    const oldestMaterial = lane.materials[0];

    if (oldestMaterial.barcode !== dto.barcode) {
      await this.prisma.fifoViolationLog.create({
        data: {
          scannedBarcode: dto.barcode,
          expectedBarcode: oldestMaterial.barcode,
          locationCode: dto.laneCode,
          rackId: lane.rackId,
        },
      });

      this.fifoGateway.notifyFifoViolation(
        dto.laneCode,
        dto.barcode,
        oldestMaterial.barcode,
      );

      throw new Error(
        `🚨 BŁĄD FIFO! Zeskanowano ${dto.barcode}, a oczekiwano ${oldestMaterial.barcode}`,
      );
    }

    const updated = await this.prisma.material.update({
      where: { id: oldestMaterial.id },
      data: {
        status: MaterialStatus.CONSUMED,
        exitTime: new Date(),
      },
    });

    this.fifoGateway.notifyLaneUpdated(dto.laneCode, 'OUT');

    return updated;
  }

  // -------------------------------------------------------------
  // 4. ADMIN: ZARZĄDZANIE REGAŁAMI (CRUD)
  // -------------------------------------------------------------
  async createRack(
    dto: CreateRackDto & { groupId?: string; position?: number },
  ) {
    const rack = await this.prisma.rack.create({
      data: {
        code: dto.code.toUpperCase().trim(),
        name: dto.name.trim(),
        groupId: dto.groupId || null,
        position: dto.position !== undefined ? Number(dto.position) : 0, // 🚀 Nowe pole position
        totalShelves: Number(dto.totalShelves),
        totalColumns: Number(dto.totalColumns),
        laneCapacity: Number(dto.laneCapacity || 10),
      },
    });

    const lanesData: Prisma.ChuteLaneCreateManyInput[] = [];

    for (let shelf = 1; shelf <= dto.totalShelves; shelf++) {
      for (let col = 1; col <= dto.totalColumns; col++) {
        lanesData.push({
          code: `${rack.code}-S${shelf}-C${col}`,
          shelf: shelf,
          column: col,
          rackId: rack.id,
        });
      }
    }

    await this.prisma.chuteLane.createMany({
      data: lanesData,
    });

    return await this.prisma.rack.findUnique({
      where: { id: rack.id },
      include: { lanes: true, group: true },
    });
  }

  async updateRack(
    id: string,
    dto: UpdateRackDto & { groupId?: string | null; position?: number },
  ) {
    const updateData: Prisma.RackUpdateInput = {};

    if (dto.name) {
      updateData.name = dto.name.trim();
    }
    if (dto.code) {
      updateData.code = dto.code.toUpperCase().trim();
    }
    if (dto.groupId !== undefined) {
      updateData.group = dto.groupId
        ? { connect: { id: dto.groupId } }
        : { disconnect: true };
    }
    if (dto.totalShelves) {
      updateData.totalShelves = Number(dto.totalShelves);
    }
    if (dto.totalColumns) {
      updateData.totalColumns = Number(dto.totalColumns);
    }
    // 🚀 KLUCZOWA POPRAWKA: Zapisywanie pozycji w bazie danych
    if (dto.position !== undefined) {
      updateData.position = Number(dto.position);
    }

    return await this.prisma.rack.update({
      where: { id },
      data: updateData,
      include: {
        group: true,
        lanes: true,
      },
    });
  }

  async deleteRack(id: string) {
    await this.prisma.chuteLane.deleteMany({
      where: { rackId: id },
    });

    return await this.prisma.rack.delete({
      where: { id },
    });
  }
}
