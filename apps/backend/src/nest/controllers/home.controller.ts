import { Controller, Get, Query, Req } from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { GetRecommendedTestsUseCase } from '../../application/use-cases/GetRecommendedTestsUseCase';
import { PrismaFollowRepository } from '../../infrastructure/repositories/PrismaFollowRepository';
import { PrismaExamRepository } from '../../infrastructure/repositories/PrismaExamRepository';
import { ApiTags, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { ApiErrorResponses } from '../swagger/decorators';
import { HomeRecommendedResponseDto } from './dto/home-recommended.response.dto';

@Controller('home')
@ApiTags('Home')
export class HomeController {
  private uc: GetRecommendedTestsUseCase;
  constructor() {
    this.uc = new GetRecommendedTestsUseCase(new PrismaFollowRepository(), new PrismaExamRepository());
  }

  @Get('recommended-tests')
  @Roles('CANDIDATE')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: HomeRecommendedResponseDto })
  @ApiErrorResponses()
  async recommended(@Query('limit') limitStr: string, @Query('examTypeId') examTypeId: string | undefined, @Req() req: any) {
    const limit = Math.min(50, Math.max(1, Number(limitStr) || 20));
    const candidateId = (req as any).user?.id;
    return this.uc.execute(candidateId, limit, examTypeId);
  }
}

import { Controller, Get, Query, Req } from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { GetRecommendedDto } from './dto/get-recommended.dto';
import { GetRecommendedTestsUseCase } from '../../application/use-cases/GetRecommendedTestsUseCase';
import { PrismaExamRepository } from '../../infrastructure/repositories/PrismaExamRepository';
import { PrismaFollowRepository } from '../../infrastructure/repositories/PrismaFollowRepository';
import { ApiTags, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { ApiErrorResponses } from '../swagger/decorators';
import { HomeRecommendedResponseDto } from './dto/home-recommended.response.dto';

@Controller('home')
@ApiTags('Home')
export class HomeController {
  private uc: GetRecommendedTestsUseCase;
  constructor() {
    this.uc = new GetRecommendedTestsUseCase(new PrismaExamRepository(), new PrismaFollowRepository());
  }

  @Get('recommended-tests')
  @Roles('CANDIDATE')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: HomeRecommendedResponseDto })
  @ApiErrorResponses()
  async recommended(@Query() q: GetRecommendedDto, @Req() req: any) {
    const candidateId = (req as any).user?.id;
    return this.uc.execute(candidateId, q.limit ?? 20, q.examTypeId);
  }
}

