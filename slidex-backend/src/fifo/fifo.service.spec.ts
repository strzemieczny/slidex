import { Test, TestingModule } from '@nestjs/testing';
import { FifoService } from './fifo.service';
import { FifoGateway } from './fifo.gateway';
import { PrismaService } from '../../prisma/prisma.service';

describe('FifoService', () => {
  let service: FifoService;

  beforeEach(async () => {
    const fifoGatewayMock = {
      notifyFifoViolation: jest.fn(),
      notifyLaneUpdated: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FifoService,
        { provide: PrismaService, useValue: {} },
        { provide: FifoGateway, useValue: fifoGatewayMock },
      ],
    }).compile();

    service = module.get<FifoService>(FifoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
