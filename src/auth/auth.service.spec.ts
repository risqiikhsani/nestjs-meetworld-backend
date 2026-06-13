import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt');

const bcryptHashMock = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const bcryptCompareMock = bcrypt.compare as jest.MockedFunction<
  typeof bcrypt.compare
>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmail: jest.Mock; create: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    jwtService = { signAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('hashes the password, persists the user, and signs a JWT', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      bcryptHashMock.mockResolvedValue(
        '$2b$12$noTWCK/34O0Gy6Ij1AEE..L2ObZ5TO0jnar2.gUlkYXe6ZDSutxri',
      );
      const created = {
        id: 'u1',
        email: 'a@b.com',
        name: 'Ada',
        passwordHash: 'hash',
      } as User;
      usersService.create.mockResolvedValue(created);
      jwtService.signAsync.mockResolvedValue('signed-token');

      const result = await service.register({
        email: 'a@b.com',
        password: 'plain',
        name: 'Ada',
      });

      expect(bcryptHashMock).toHaveBeenCalledWith('plain', 12);
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'a@b.com',
        name: 'Ada',
        passwordHash:
          '$2b$12$noTWCK/34O0Gy6Ij1AEE..L2ObZ5TO0jnar2.gUlkYXe6ZDSutxri',
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'a@b.com',
      });
      expect(result).toEqual({
        access_token: 'signed-token',
        user: { id: 'u1', email: 'a@b.com', name: 'Ada' },
      });
    });

    it('returns no passwordHash in the user payload', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      bcryptHashMock.mockResolvedValue('hash');
      usersService.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'Ada',
        passwordHash: 'hash',
      });
      jwtService.signAsync.mockResolvedValue('t');

      const result = await service.register({
        email: 'a@b.com',
        password: 'plain',
        name: 'Ada',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('throws ConflictException when the email is already registered', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 'u1' });

      await expect(
        service.register({
          email: 'a@b.com',
          password: 'plain',
          name: 'Ada',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('returns the user when the password matches', async () => {
      const user = {
        id: 'u1',
        email: 'a@b.com',
        passwordHash: 'hash',
      } as User;
      usersService.findByEmail.mockResolvedValue(user);
      bcryptCompareMock.mockResolvedValue(true);

      await expect(service.validateUser('a@b.com', 'plain')).resolves.toBe(
        user,
      );
      expect(bcryptCompareMock).toHaveBeenCalledWith('plain', 'hash');
    });

    it('returns null when the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.validateUser('a@b.com', 'x')).resolves.toBeNull();
      expect(bcryptCompareMock).not.toHaveBeenCalled();
    });

    it('returns null when the password is wrong', async () => {
      const user = { id: 'u1', passwordHash: 'hash' } as User;
      usersService.findByEmail.mockResolvedValue(user);
      bcryptCompareMock.mockResolvedValue(false);

      await expect(
        service.validateUser('a@b.com', 'wrong'),
      ).resolves.toBeNull();
    });

    it('returns null when the user has no passwordHash (passwordless user)', async () => {
      const user = { id: 'u1', passwordHash: null } as User;
      usersService.findByEmail.mockResolvedValue(user);

      await expect(service.validateUser('a@b.com', 'x')).resolves.toBeNull();
      expect(bcryptCompareMock).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a signed token and safe user for a valid user', async () => {
      const user = { id: 'u1', email: 'a@b.com', name: 'Ada' } as User;
      jwtService.signAsync.mockResolvedValue('signed-token');

      const result = await service.login(user);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'a@b.com',
      });
      expect(result).toEqual({
        access_token: 'signed-token',
        user: { id: 'u1', email: 'a@b.com', name: 'Ada' },
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });
});
