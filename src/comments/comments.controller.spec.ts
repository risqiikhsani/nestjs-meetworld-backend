import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

type ServiceStub = Pick<
  CommentsService,
  'findAllForPost' | 'findOne' | 'create' | 'update' | 'remove'
>;

const buildStub = (): ServiceStub => {
  return {
    findAllForPost: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
};

describe('CommentsController', () => {
  let controller: CommentsController;
  let stub: ServiceStub;

  beforeEach(async () => {
    stub = buildStub();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [{ provide: CommentsService, useValue: stub }],
    }).compile();
    controller = module.get(CommentsController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates findAll to the service', async () => {
    await controller.findAll('p1');
    expect(stub.findAllForPost).toHaveBeenCalledWith('p1');
  });

  it('delegates findOne to the service', async () => {
    await controller.findOne('c1');
    expect(stub.findOne).toHaveBeenCalledWith('c1');
  });

  it('delegates create to the service with the JWT user id', async () => {
    const user = { id: 'u1', email: 'a@b.c' };
    const dto = { text: 'hi' };
    await controller.create('p1', user, dto);
    expect(stub.create).toHaveBeenCalledWith('p1', 'u1', dto);
  });

  it('delegates update to the service with the JWT user id', async () => {
    const user = { id: 'u1', email: 'a@b.c' };
    const dto = { text: 'new' };
    await controller.update('c1', user, dto);
    expect(stub.update).toHaveBeenCalledWith('c1', 'u1', dto);
  });

  it('delegates remove to the service with the JWT user id', async () => {
    const user = { id: 'u1', email: 'a@b.c' };
    await controller.remove('c1', user);
    expect(stub.remove).toHaveBeenCalledWith('c1', 'u1');
  });
});
