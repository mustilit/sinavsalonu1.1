import { Controller, Get, Query, UseGuards, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { prisma } from '../../infrastructure/database/prisma';

@Controller('admin/dlq')
export class AdminDlqController {
  @Get('emails')
  @Roles('ADMIN')
  async list(@Query('limit', new ParseIntPipe({ optional: true })) limit = 50) {
    const l = Number(limit) || 50;
    if (l < 1 || l > 200) throw new BadRequestException('limit must be between 1 and 200');
    const rows = await prisma.auditLog.findMany({
      where: { action: 'EMAIL_FAILED' as any },
      orderBy: { createdAt: 'desc' },
      take: l,
    });
    return { items: rows.map((r) => ({ id: r.id, createdAt: r.createdAt, metadata: r.metadata, actorId: r.actorId })) };
  }
}

