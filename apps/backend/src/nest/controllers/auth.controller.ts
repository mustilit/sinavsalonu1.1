import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RegisterUseCase } from '../../application/use-cases/RegisterUseCase';
import { LoginUseCase } from '../../application/use-cases/LoginUseCase';
import { Public } from '../decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  @Post('register')
  @Public()
  async register(@Body() body: any) {
    try {
      const user = await this.registerUseCase.execute(body);
      return user;
    } catch (err: any) {
      if (err.message === 'DUPLICATE_EMAIL') {
        throw new HttpException({ error: 'Bu e-posta adresi zaten kayıtlı.' }, HttpStatus.CONFLICT);
      }
      if (err.message === 'DUPLICATE_USERNAME') {
        throw new HttpException({ error: 'Bu kullanıcı adı zaten alınmış.' }, HttpStatus.CONFLICT);
      }
      throw new HttpException({ error: 'Kayıt sırasında hata oluştu' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('login')
  @Public()
  @Throttle(5, 300)
  async login(@Body() body: any) {
    try {
      return await this.loginUseCase.execute(body);
    } catch (err: any) {
      if (err.message === 'INVALID_CREDENTIALS') {
        throw new HttpException({ error: 'E-posta veya şifre hatalı.' }, HttpStatus.UNAUTHORIZED);
      }
      throw new HttpException({ error: 'Giriş sırasında hata oluştu' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

