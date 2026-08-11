// src/fifo/dto/scan.dto.ts
export class ScanInDto {
  laneCode: string; // np. "RACK-01-S1-C1"
  barcode: string; // np. "BOX-999"
  partNumber: string; // np. "PN-99281-A"
  quantity?: number; // 👈 NOWE POLE: opcjonalna ilość (domyślnie 1)
}

export class ScanOutDto {
  laneCode: string;
  barcode: string;
}
