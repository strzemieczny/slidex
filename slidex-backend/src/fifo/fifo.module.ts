// src/fifo/fifo.module.ts
import { Module } from '@nestjs/common';
import { FifoService } from './fifo.service';
import { FifoController } from './fifo.controller';
import { FifoGateway } from './fifo.gateway';

@Module({
  controllers: [FifoController],
  providers: [FifoService, FifoGateway],
})
export class FifoModule {}
