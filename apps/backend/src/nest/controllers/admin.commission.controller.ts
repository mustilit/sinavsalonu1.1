import { Controller, Get, Query, Res, ParseIntPipe, DefaultValuePipe, Inject } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../decorators/roles.decorator';
import { GetCommissionReportUseCase } from '../../application/use-cases/GetCommissionReportUseCase';

/** Varsayılan rapor dönemi için bir önceki ayı hesaplar — Ocak için Aralık'a döner */
const prevMonthYear = (): { year: number; month: number } => {
  const now = new Date();
  if (now.getMonth() === 0) return { year: now.getFullYear() - 1, month: 12 };
  return { year: now.getFullYear(), month: now.getMonth() };
};

/**
 * Admin komisyon raporlama — aylık komisyon özetini JSON veya CSV formatında döndürür.
 * Sadece ADMIN rolüne açıktır.
 */
@Controller('admin/commission')
@ApiTags('admin/commission')
@ApiBearerAuth('bearer')
export class AdminCommissionController {
  constructor(
    @Inject(GetCommissionReportUseCase)
    private readonly getReport: GetCommissionReportUseCase,
  ) {}

  @Get('report')
  @Roles('ADMIN')
  @ApiOkResponse({ description: 'Monthly commission report grouped by educator' })
  async report(
    @Query('year', new DefaultValuePipe(prevMonthYear().year), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(prevMonthYear().month), ParseIntPipe) month: number,
  ) {
    return this.getReport.execute(year, month);
  }

  @Get('export')
  @Roles('ADMIN')
  @ApiOkResponse({ description: 'CSV export of monthly commission report' })
  async exportCsv(
    @Query('year', new DefaultValuePipe(prevMonthYear().year), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(prevMonthYear().month), ParseIntPipe) month: number,
    @Res() res: Response,
  ) {
    const csv = await this.getReport.exportCsv(year, month);
    const monthStr = String(month).padStart(2, '0');
    const filename = `komisyon-raporu-${year}-${monthStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(csv, 'utf8'));
  }
}
