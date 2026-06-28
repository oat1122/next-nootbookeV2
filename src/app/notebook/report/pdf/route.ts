import { requireUser, ForbiddenError, type SessionUser } from '@/server/auth';
import { getNotebookKpiDetails, getNotebookSelfReport } from '@/server/notebook/kpi';
import { resolvePeriod } from '@/server/notebook/kpi-period';
import { thaiDate } from '@/app/notebook/_lib/notebook-display';
import { renderStandardReport, renderSelfReport } from '@/server/notebook/pdf/report-pdf';
import type { KpiSummaryParams } from '@/server/notebook/validation';

// ขึ้นกับ cookie/auth + DB → เรนเดอร์ตอน request เสมอ (Node runtime, ใช้ @react-pdf)
export const dynamic = 'force-dynamic';

const senderName = (u: SessionUser): string => {
  const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  const nick = u.nickname ? ` (${u.nickname})` : '';
  return (full ? `${full}${nick}` : u.username) || 'ไม่ระบุ';
};

const pdfResponse = (buffer: Buffer, filename: string) =>
  new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const type = sp.get('type') === 'self' ? 'self' : 'standard';
  const period = sp.get('period') || 'month';

  // พิมพ์เมื่อ (เวลา server) — รูปแบบเดียวกับ thaiDateTime
  const now = new Date();
  const printedAt = `${thaiDate(now.toISOString())} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const printedBy = senderName(user);

  try {
    if (type === 'self') {
      const p = resolvePeriod(period, null, null);
      const data = await getNotebookSelfReport({ start_date: p.start_date, end_date: p.end_date }, user);
      const buffer = await renderSelfReport({
        rangeLabel: p.label,
        rangeShort: `${thaiDate(p.start_date)} – ${thaiDate(p.end_date)}`,
        printedAt,
        printedBy,
        leads: data.lead_additions,
        recalls: data.recall_actions,
        activityItems: data.activity_items,
      });
      return pdfResponse(buffer, `notebook-self-report-${p.start_date}.pdf`);
    }

    const details = await getNotebookKpiDetails({ period: period as KpiSummaryParams['period'] }, user);
    const buffer = await renderStandardReport({
      rangeLabel: details.meta.period.label,
      printedAt,
      printedBy,
      details: details.data,
    });
    return pdfResponse(buffer, `notebook-report-${details.meta.period.start_date}.pdf`);
  } catch (e) {
    if (e instanceof ForbiddenError) return new Response('Forbidden', { status: 403 });
    throw e;
  }
}
