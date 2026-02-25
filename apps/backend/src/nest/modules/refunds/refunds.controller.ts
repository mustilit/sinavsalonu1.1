import { Controller, Post, Body, Req, HttpException, HttpStatus, UseGuards, Patch, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { ApiErrorResponses } from '../../swagger/decorators';
import { RefundsResponseDto } from './dto/refunds.response.dto';
import { Roles } from '../../decorators/roles.decorator';
import { CreateRefundRequestUseCase } from '../../../application/use-cases/CreateRefundRequestUseCase';
import { ResolveRefundRequestUseCase } from '../../../application/use-cases/ResolveRefundRequestUseCase';
import { PrismaRefundRepository } from '../../../infrastructure/repositories/PrismaRefundRepository';
import { PrismaObjectionRepository } from '../../../infrastructure/repositories/PrismaObjectionRepository';
import { PrismaAuditLogRepository } from '../../../infrastructure/repositories/PrismaAuditLogRepository';
import { Request } from 'express';
import { QueueService } from '../../../infrastructure/queue/queue.service';

@Controller('refunds')
@ApiTags('Refunds')
export class RefundsController {
  private createUc: CreateRefundRequestUseCase;
  private resolveUc: ResolveRefundRequestUseCase;
  constructor() {
    const refundRepo = new PrismaRefundRepository();
    const objectionRepo = new PrismaObjectionRepository();
    const auditRepo = new PrismaAuditLogRepository();
    const queueService = new QueueService();
    this.createUc = new CreateRefundRequestUseCase(refundRepo, objectionRepo, auditRepo);
    this.resolveUc = new ResolveRefundRequestUseCase(refundRepo, auditRepo, queueService);
  }

  @Post()
  @Roles('CANDIDATE')
  @Throttle(3, 300)
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: RefundsResponseDto })
  @ApiErrorResponses()
  async create(@Body() body: { purchaseId: string; reason?: string }, @Req() req: Request) {
    const candidateId = (req as any).user?.id;
    if (!candidateId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    try {
      return await this.createUc.execute(body.purchaseId, candidateId, body.reason);
    } catch (e: any) {
      throw e;
    }
  }

  @Patch('admin/:id')
  @Roles('ADMIN')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: RefundsResponseDto })
  @ApiErrorResponses()
  async resolve(@Param('id') id: string, @Body() body: { decision: 'APPROVED' | 'REJECTED' }, @Req() req: Request) {
    const adminId = (req as any).user?.id;
    if (!adminId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    return await this.resolveUc.execute(id, body.decision, adminId);
  }
}

