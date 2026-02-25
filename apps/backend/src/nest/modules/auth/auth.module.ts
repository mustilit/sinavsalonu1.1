import { Module } from '@nestjs/common';
import { AuthController } from '../../controllers/auth.controller';
import { RegisterUseCase } from '../../../application/use-cases/RegisterUseCase';
import { LoginUseCase } from '../../../application/use-cases/LoginUseCase';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository';
import { PasswordService } from '../../../infrastructure/services/PasswordService';
import { JwtService } from '../../../infrastructure/services/JwtService';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: RegisterUseCase,
      useFactory: () => new RegisterUseCase(new PrismaUserRepository(), new PasswordService()),
    },
    {
      provide: LoginUseCase,
      useFactory: () =>
        new LoginUseCase(new PrismaUserRepository(), new PasswordService(), new JwtService()),
    },
  ],
})
export class AuthModule {}

