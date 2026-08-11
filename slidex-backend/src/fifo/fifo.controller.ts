import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Put,
  Patch,
  Delete,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { FifoService } from './fifo.service';
import { ScanInDto, ScanOutDto } from './dto/scan.dto';
import { CreateRackDto, UpdateRackDto } from './dto/rack.dto';

@Controller('fifo')
export class FifoController {
  constructor(private readonly fifoService: FifoService) {}

  // -------------------------------------------------------------
  // 📱 AUTO-UPDATE APK (SKANERY ANDROID)
  // -------------------------------------------------------------

  // 1. Sprawdzanie dostępności nowej wersji APK
  @Get('app-version')
  getAppVersion() {
    return {
      latestVersion: '1.0.0', // 👈 Zmieniaj ten numer przy wypuszczaniu nowej wersji
      required: false, // true = brak możliwości pominięcia, false = opcjonalna
      notes:
        'Poprawki stabilności skanera, zoptymalizowany widok oraz szybka synchronizacja FIFO.',
      apkFileName: 'slidex-latest.apk',
    };
  }

  // 2. Pobieranie pliku APK
  @Get('download-apk')
  downloadApk(@Res() res: Response) {
    // Plik APK serwowany jest z folderu 'uploads' w katalogu głównym backendu
    const apkPath = join(process.cwd(), 'uploads', 'slidex-latest.apk');

    if (!existsSync(apkPath)) {
      throw new NotFoundException(
        'Plik APK nie został znaleziony na serwerze.',
      );
    }

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="slidex-latest.apk"',
    );

    const fileStream = createReadStream(apkPath);
    fileStream.pipe(res);
  }

  // -------------------------------------------------------------
  // 🎯 OPERACJE MAGAZYNOWE (SCAN IN / OUT / OVERVIEW)
  // -------------------------------------------------------------

  @Post('scan-in')
  async scanIn(@Body() dto: ScanInDto) {
    return await this.fifoService.scanIn(dto);
  }

  @Post('scan-out')
  async scanOut(@Body() dto: ScanOutDto) {
    return await this.fifoService.scanOut(dto);
  }

  @Get('overview')
  async getOverview(@Query('rackCode') rackCode?: string) {
    return await this.fifoService.getRackOverview(rackCode);
  }

  // -------------------------------------------------------------
  // 🏗️ REGAŁY (RACKS)
  // -------------------------------------------------------------

  @Post('racks')
  async createRack(@Body() dto: CreateRackDto & { groupId?: string }) {
    return await this.fifoService.createRack(dto);
  }

  @Patch('racks/:id')
  async updateRackPatch(
    @Param('id') id: string,
    @Body() dto: UpdateRackDto & { groupId?: string | null },
  ) {
    return await this.fifoService.updateRack(id, dto);
  }

  @Put('racks/:id')
  async updateRackPut(
    @Param('id') id: string,
    @Body() dto: UpdateRackDto & { groupId?: string | null },
  ) {
    return await this.fifoService.updateRack(id, dto);
  }

  @Delete('racks/:id')
  async deleteRack(@Param('id') id: string) {
    return await this.fifoService.deleteRack(id);
  }

  // -------------------------------------------------------------
  // 🏷️ STREFY / GRUPY (GROUPS)
  // -------------------------------------------------------------

  @Get('groups')
  async getGroups() {
    return await this.fifoService.getGroups();
  }

  @Post('groups')
  async createGroup(@Body() body: { code: string; name: string }) {
    return await this.fifoService.createGroup(body);
  }

  @Patch('groups/:id')
  async updateGroupPatch(
    @Param('id') id: string,
    @Body() body: { code?: string; name?: string },
  ) {
    return await this.fifoService.updateGroup(id, body);
  }

  @Put('groups/:id')
  async updateGroupPut(
    @Param('id') id: string,
    @Body() body: { code?: string; name?: string },
  ) {
    return await this.fifoService.updateGroup(id, body);
  }

  @Delete('groups/:id')
  async deleteGroup(@Param('id') id: string) {
    return await this.fifoService.deleteGroup(id);
  }
}
