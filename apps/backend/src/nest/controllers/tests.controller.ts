import { Controller, Post, Body, Put, Param, Get } from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { Public } from '../decorators/public.decorator';
import { CreateTestUseCase } from '../../application/use-cases/CreateTestUseCase';
import { CreateQuestionUseCase } from '../../application/use-cases/CreateQuestionUseCase';
import { ListMarketplaceTestsUseCase } from '../../application/use-cases/ListMarketplaceTestsUseCase';
import { GetTestUseCase } from '../../application/use-cases/GetTestUseCase';
import { PublishTestUseCase } from '../../application/use-cases/PublishTestUseCase';
import { UnpublishTestUseCase } from '../../application/use-cases/UnpublishTestUseCase';

@Controller()
export class TestsController {
  constructor(
    private readonly createTestUC: CreateTestUseCase,
    private readonly createQuestionUC: CreateQuestionUseCase,
    private readonly listUC: ListMarketplaceTestsUseCase,
    private readonly getUC: GetTestUseCase,
    private readonly publishUC: PublishTestUseCase,
    private readonly unpublishUC: UnpublishTestUseCase,
  ) {}

  @Post('tests')
  @Roles('EDUCATOR')
  createTest(@Body() body: any) {
    return this.createTestUC.execute(body);
  }

  @Put('tests/:id/publish')
  @Roles('EDUCATOR')
  async publish(@Param('id') id: string) {
    return await this.publishUC.execute(id);
  }

  @Put('tests/:id/unpublish')
  @Roles('EDUCATOR')
  async unpublish(@Param('id') id: string) {
    return await this.unpublishUC.execute(id);
  }

  @Post('tests/:id/questions')
  @Roles('EDUCATOR')
  addQuestion(@Param('id') id: string, @Body() body: any) {
    return this.createQuestionUC.execute(id, body);
  }

  @Public()
  @Get('marketplace/tests')
  list() {
    return this.listUC.execute();
  }

  @Public()
  @Get('tests/:id')
  get(@Param('id') id: string) {
    return this.getUC.execute(id);
  }
}

