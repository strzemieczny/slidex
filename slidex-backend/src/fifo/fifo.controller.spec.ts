import { Test, TestingModule } from '@nestjs/testing';
import { FifoController } from './fifo.controller';
import { FifoService } from './fifo.service';

describe('FifoController', () => {
  let controller: FifoController;

  beforeEach(async () => {
    const fifoServiceMock = {
      scanIn: jest.fn(),
      scanOut: jest.fn(),
      getRackOverview: jest.fn(),
      createRack: jest.fn(),
      updateRack: jest.fn(),
      deleteRack: jest.fn(),
      getGroups: jest.fn(),
      createGroup: jest.fn(),
      updateGroup: jest.fn(),
      deleteGroup: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FifoController],
      providers: [{ provide: FifoService, useValue: fifoServiceMock }],
    }).compile();

    controller = module.get<FifoController>(FifoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
