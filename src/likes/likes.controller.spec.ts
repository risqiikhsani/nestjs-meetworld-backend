import { Test, TestingModule } from '@nestjs/testing';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';

type ServiceStub = Pick<
  LikesService,
  'findAllForPost' | 'findOne' | 'create' | 'remove'
>;

const buildStub = (): ServiceStub => {
  return {
    findAllForPost: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };
};

describe('LikesController', () => {
  let controller: LikesController;
  let stub: ServiceStub;

  beforeEach(async () => {
    stub = buildStub();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LikesController],
      providers: [{ provide: LikesService, useValue: stub }],
    }).compile();
    controller = module.get(LikesController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates findAll to the service with the path postId', async () => {
    await controller.findAll('p1');
    expect(stub.findAllForPost).toHaveBeenCalledWith('p1');
  });

  it('delegates findOne to the service', async () => {
    await controller.findOne('l1');
    expect(stub.findOne).toHaveBeenCalledWith('l1');
  });

  it('delegates create to the service with the JWT user id and path postId', async () => {
    const user = { id: 'u1', email: 'a@b.c' };
    await controller.create('p1', user);
    expect(stub.create).toHaveBeenCalledWith('u1', 'p1');
  });

  it('delegates remove to the service with the JWT user id', async () => {
    const user = { id: 'u1', email: 'a@b.c' };
    await controller.remove('l1', user);
    expect(stub.remove).toHaveBeenCalledWith('l1', 'u1');
  });
});
