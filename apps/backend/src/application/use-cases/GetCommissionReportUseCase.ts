import { prisma } from '../../infrastructure/database/prisma';

export interface CommissionReportItem {
  educatorId: string;
  username: string;
  email: string;
  iban: string | null;
  bankName: string | null;
  accountHolder: string | null;
  saleCount: number;
  totalSalesCents: number;
  commissionPercent: number;
  commissionCents: number;
  payoutCents: number;
}

export interface CommissionReportResult {
  items: CommissionReportItem[];
  commissionPercent: number;
  year: number;
  month: number;
  totalSalesCents: number;
  totalCommissionCents: number;
  totalPayoutCents: number;
}

interface RawRow {
  educatorId: string;
  username: string;
  email: string;
  iban: string | null;
  bankName: string | null;
  accountHolder: string | null;
  saleCount: bigint;
  totalSalesCents: bigint;
}

export class GetCommissionReportUseCase {
  async execute(year: number, month: number): Promise<CommissionReportResult> {
    // validate
    if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error('Invalid year');
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Invalid month');

    const settings = await prisma.adminSettings.findFirst({ where: { id: 1 } });
    const commissionPercent = settings?.commissionPercent ?? 20;

    const rows = await prisma.$queryRawUnsafe<RawRow[]>(`
      SELECT
        u.id               AS "educatorId",
        u.username,
        u.email,
        up.preferences->>'iban'           AS iban,
        up.preferences->>'bankName'       AS "bankName",
        up.preferences->>'accountHolder'  AS "accountHolder",
        COUNT(p.id)::bigint               AS "saleCount",
        COALESCE(SUM(p."amountCents"), 0)::bigint AS "totalSalesCents"
      FROM users u
      JOIN exam_tests et ON et."educatorId" = u.id
      JOIN purchases p   ON p."testId" = et.id
      LEFT JOIN user_preferences up ON up."userId" = u.id
      WHERE
        EXTRACT(YEAR  FROM p."createdAt") = ${year}
        AND EXTRACT(MONTH FROM p."createdAt") = ${month}
        AND p."deletedAt" IS NULL
        AND p.status = 'ACTIVE'
        AND u."deletedAt" IS NULL
      GROUP BY u.id, u.username, u.email, up.preferences
      ORDER BY "totalSalesCents" DESC
    `);

    let sumSales = 0;
    let sumCommission = 0;
    let sumPayout = 0;

    const items: CommissionReportItem[] = rows.map((r) => {
      const totalSalesCents = Number(r.totalSalesCents);
      const commissionCents = Math.round((totalSalesCents * commissionPercent) / 100);
      const payoutCents = totalSalesCents - commissionCents;

      sumSales += totalSalesCents;
      sumCommission += commissionCents;
      sumPayout += payoutCents;

      return {
        educatorId: r.educatorId,
        username: r.username,
        email: r.email,
        iban: r.iban ?? null,
        bankName: r.bankName ?? null,
        accountHolder: r.accountHolder ?? null,
        saleCount: Number(r.saleCount),
        totalSalesCents,
        commissionPercent,
        commissionCents,
        payoutCents,
      };
    });

    return {
      items,
      commissionPercent,
      year,
      month,
      totalSalesCents: sumSales,
      totalCommissionCents: sumCommission,
      totalPayoutCents: sumPayout,
    };
  }

  async exportCsv(year: number, month: number): Promise<string> {
    const report = await this.execute(year, month);
    const monthStr = String(month).padStart(2, '0');
    const period = `${year}-${monthStr}`;

    const headers = [
      'Eğitici',
      'E-posta',
      'IBAN',
      'Hesap Sahibi',
      'Banka',
      'Dönem',
      'Satış Adedi',
      'Toplam Satış (TL)',
      'Komisyon (%)',
      'Komisyon Tutarı (TL)',
      'Ödenecek Tutar (TL)',
    ];

    const escape = (v: string | number | null) =>
      `"${String(v ?? '').replace(/"/g, '""')}"`;

    const dataRows = report.items.map((item) => [
      escape(item.username),
      escape(item.email),
      escape(item.iban),
      escape(item.accountHolder),
      escape(item.bankName),
      escape(period),
      escape(item.saleCount),
      escape((item.totalSalesCents / 100).toFixed(2)),
      escape(report.commissionPercent),
      escape((item.commissionCents / 100).toFixed(2)),
      escape((item.payoutCents / 100).toFixed(2)),
    ]);

    // totals row
    dataRows.push([
      escape('TOPLAM'),
      escape(''),
      escape(''),
      escape(''),
      escape(''),
      escape(period),
      escape(report.items.reduce((s, i) => s + i.saleCount, 0)),
      escape((report.totalSalesCents / 100).toFixed(2)),
      escape(report.commissionPercent),
      escape((report.totalCommissionCents / 100).toFixed(2)),
      escape((report.totalPayoutCents / 100).toFixed(2)),
    ]);

    const lines = [headers.map(escape).join(','), ...dataRows.map((r) => r.join(','))];
    // UTF-8 BOM so Excel opens Turkish characters correctly
    return '\uFEFF' + lines.join('\r\n');
  }
}
