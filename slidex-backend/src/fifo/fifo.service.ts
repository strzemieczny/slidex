import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MaterialStatus, Prisma } from '@prisma/client';
import { RackAuditDto, ScanInDto, ScanOutDto } from './dto/scan.dto';
import { CreateRackDto, UpdateRackDto } from './dto/rack.dto';
import { FifoGateway } from './fifo.gateway';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FifoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fifoGateway: FifoGateway,
  ) {}

  // -------------------------------------------------------------
  // 0. OBSŁUGA STREF / GRUP (RACK GROUPS)
  // -------------------------------------------------------------
  async getGroups() {
    return this.prisma.rackGroup.findMany({
      include: {
        racks: {
          orderBy: { position: 'asc' }, // 🚀 Sortujemy regały wewnątrz strefy wg kolejności
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createGroup(data: { code: string; name: string }) {
    return this.prisma.rackGroup.create({
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

    return this.prisma.rackGroup.update({
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
    return this.prisma.$transaction(async (tx) => {
      await tx.rack.updateMany({
        where: { groupId: id },
        data: { groupId: null },
      });

      return tx.rackGroup.delete({ where: { id } });
    });
  }

  // -------------------------------------------------------------
  // 1. POBIERANIE PODGLĄDU REGAŁÓW (REST / Overview)
  // -------------------------------------------------------------
  async getRackOverview(rackCode?: string) {
    return this.prisma.rack.findMany({
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
    const lane = await this.prisma.chuteLane.findUnique({
      where: { code: dto.laneCode },
      select: {
        id: true,
        rack: { select: { code: true, auditStartedAt: true } },
        materials: {
          where: { status: MaterialStatus.IN_CHUTE },
          take: 1,
          select: { partNumber: true },
        },
      },
    });

    if (!lane) {
      throw new Error(`Tor o kodzie ${dto.laneCode} nie istnieje.`);
    }

    if (lane.rack.auditStartedAt) {
      throw new ConflictException(
        `Regał ${lane.rack.code} jest obecnie audytowany. SCAN IN dla tego regału jest zablokowany.`,
      );
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
    const lane = await this.prisma.chuteLane.findUnique({
      where: { code: dto.laneCode },
      select: {
        rackId: true,
        rack: { select: { code: true, auditStartedAt: true } },
        materials: {
          where: { status: MaterialStatus.IN_CHUTE },
          orderBy: { entryTime: 'asc' },
          take: 1,
        },
      },
    });

    if (!lane) {
      throw new Error(`Tor ${dto.laneCode} nie istnieje.`);
    }

    if (lane.rack.auditStartedAt) {
      throw new ConflictException(
        `Regał ${lane.rack.code} jest obecnie audytowany. SCAN OUT dla tego regału jest zablokowany.`,
      );
    }

    if (lane.materials.length === 0) {
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

  async auditRack(rackId: string, dto: RackAuditDto) {
    const materialIds = dto.items.map((item) => item.materialId);
    if (new Set(materialIds).size !== materialIds.length) {
      throw new BadRequestException(
        'Każdy pojemnik może wystąpić w audycie tylko raz.',
      );
    }

    const startedAt = new Date(dto.startedAt);
    const result = await this.prisma.$transaction(async (tx) => {
      const rack = await tx.rack.findUnique({
        where: { id: rackId },
        select: {
          id: true,
          code: true,
          groupId: true,
          auditStartedAt: true,
          lanes: { select: { id: true, code: true } },
        },
      });
      if (!rack) throw new NotFoundException('Wybrany regał nie istnieje.');
      if (
        !rack.auditStartedAt ||
        rack.auditStartedAt.getTime() !== startedAt.getTime()
      ) {
        throw new ConflictException(
          'Ta sesja audytu nie jest już aktywna. Rozpocznij audyt ponownie.',
        );
      }

      const laneIds = rack.lanes.map((lane) => lane.id);
      const auditedMaterials = await tx.material.findMany({
        where: {
          id: { in: materialIds },
          laneId: { in: laneIds },
          status: MaterialStatus.IN_CHUTE,
          entryTime: { lte: startedAt },
        },
        select: { id: true },
      });

      if (auditedMaterials.length !== materialIds.length) {
        throw new BadRequestException(
          'Co najmniej jedna pozycja nie należy już do tego regału. Odśwież audyt i spróbuj ponownie.',
        );
      }

      await Promise.all(
        dto.items.map((item) =>
          tx.material.update({
            where: { id: item.materialId },
            data: { quantity: item.quantity },
          }),
        ),
      );

      const removed = await tx.material.updateMany({
        where: {
          laneId: { in: laneIds },
          status: MaterialStatus.IN_CHUTE,
          entryTime: { lte: startedAt },
          id: { notIn: materialIds },
        },
        data: { status: MaterialStatus.REMOVED, exitTime: new Date() },
      });

      await tx.rack.update({
        where: { id: rackId },
        data: { auditStartedAt: null },
      });

      return {
        rackId,
        rackCode: rack.code,
        groupId: rack.groupId,
        updated: dto.items.length,
        removed: removed.count,
        auditedAt: new Date().toISOString(),
      };
    });

    this.fifoGateway.notifyAuditStatus({
      active: false,
      rackId,
      rackCode: result.rackCode,
      groupId: result.groupId,
    });

    for (const lane of await this.prisma.chuteLane.findMany({
      where: { rackId },
      select: { code: true },
    })) {
      this.fifoGateway.notifyLaneUpdated(lane.code, 'OUT');
    }

    return result;
  }

  async startRackAudit(rackId: string) {
    const activeAudit = await this.prisma.rack.findUnique({
      where: { id: rackId },
      select: {
        id: true,
        code: true,
        groupId: true,
        auditStartedAt: true,
      },
    });
    if (!activeAudit) {
      throw new NotFoundException('Wybrany regał nie istnieje.');
    }
    if (activeAudit.auditStartedAt) {
      this.fifoGateway.notifyAuditStatus({
        active: true,
        rackId: activeAudit.id,
        rackCode: activeAudit.code,
        groupId: activeAudit.groupId,
        startedAt: activeAudit.auditStartedAt,
      });
      return activeAudit;
    }

    const rack = await this.prisma.rack.update({
      where: { id: rackId },
      data: { auditStartedAt: new Date() },
      select: {
        id: true,
        code: true,
        groupId: true,
        auditStartedAt: true,
      },
    });
    this.fifoGateway.notifyAuditStatus({
      active: true,
      rackId: rack.id,
      rackCode: rack.code,
      groupId: rack.groupId,
      startedAt: rack.auditStartedAt,
    });
    return rack;
  }

  async cancelRackAudit(rackId: string) {
    const rack = await this.prisma.rack.update({
      where: { id: rackId },
      data: { auditStartedAt: null },
      select: { id: true, code: true, groupId: true },
    });
    this.fifoGateway.notifyAuditStatus({
      active: false,
      rackId: rack.id,
      rackCode: rack.code,
      groupId: rack.groupId,
    });
    return { cancelled: true };
  }

  // -------------------------------------------------------------
  // 4. ADMIN: ZARZĄDZANIE REGAŁAMI (CRUD)
  // -------------------------------------------------------------
  async createRack(dto: CreateRackDto) {
    return this.prisma.$transaction(async (tx) => {
      const rack = await tx.rack.create({
        data: {
          code: dto.code.toUpperCase().trim(),
          name: dto.name.trim(),
          groupId: dto.groupId || null,
          position: dto.position !== undefined ? Number(dto.position) : 0,
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
            shelf,
            column: col,
            rackId: rack.id,
          });
        }
      }

      await tx.chuteLane.createMany({ data: lanesData });

      return tx.rack.findUnique({
        where: { id: rack.id },
        include: { lanes: true, group: true },
      });
    });
  }

  async updateRack(id: string, dto: UpdateRackDto) {
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
    if (dto.laneCapacity !== undefined) {
      updateData.laneCapacity = Number(dto.laneCapacity);
    }
    // 🚀 KLUCZOWA POPRAWKA: Zapisywanie pozycji w bazie danych
    if (dto.position !== undefined) {
      updateData.position = Number(dto.position);
    }

    return this.prisma.rack.update({
      where: { id },
      data: updateData,
      include: {
        group: true,
        lanes: true,
      },
    });
  }

  async deleteRack(id: string) {
    return this.prisma.rack.delete({
      where: { id },
    });
  }
}
