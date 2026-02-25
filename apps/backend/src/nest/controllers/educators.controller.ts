import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { ApiErrorResponses } from '../swagger/decorators';
import { EducatorPageResponseDto } from './dto/educator-page.response.dto';
import { Public } from '../decorators/public.decorator';
import { EducatorPageQueryDto } from './dto/educator-page-query.dto';
import { GetEducatorPageUseCase } from '../../application/use-cases/GetEducatorPageUseCase';
import { PrismaUserRepository } from '../../infrastructure/repositories/PrismaUserRepository';
import { PrismaExamRepository } from '../../infrastructure/repositories/PrismaExamRepository';
import { PrismaTestStatsRepository } from '../../infrastructure/repositories/PrismaTestStatsRepository';
import { ReviewAggregationService } from '../../application/services/ReviewAggregationService';

@Controller('educators')
@ApiTags('Educators')
export class EducatorsController {
  private uc: GetEducatorPageUseCase;

  constructor() {
    this.uc = new GetEducatorPageUseCase(new PrismaUserRepository(), new PrismaExamRepository(), new PrismaTestStatsRepository(), new ReviewAggregationService());
  }

  @Public()
  @Get(':id')
  @ApiOkResponse({ type: EducatorPageResponseDto })
  @ApiErrorResponses()
  async page(@Param('id') id: string, @Query() q: EducatorPageQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const examTypeId = q.examTypeId;
    const sortBy = q.sortBy;
    const sortDir = q.sortDir as any;
    return this.uc.execute(id, { page, limit, examTypeId, sortBy, sortDir });
  }
}

