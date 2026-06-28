import type { ReactNode } from 'react';
import { requireUser } from '@/server/auth';

const ROLE_LABEL: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  manager: 'ผู้จัดการ',
  sale: 'ฝ่ายขาย (Sales)',
  telesale: 'เทเลเซลล์',
  office: 'ออฟฟิศ',
};

/** layout ของโซน notebook — top bar + warm scope (.notebook-scope override token shadcn) */
export default async function NotebookLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const displayName = user.nickname || user.firstName || user.username;
  const roleLabel = user.position || ROLE_LABEL[user.role] || user.role;
  const avatarText = (displayName || '?').slice(0, 1);

  return (
    <div className="notebook-scope bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-border bg-card/85 sticky top-0 z-20 flex items-center gap-3.5 border-b px-7 py-3 backdrop-blur-md">
        <div className="bg-primary text-primary-foreground flex size-[34px] items-center justify-center rounded-[10px] text-[13px] font-bold tracking-wide">
          TNP
        </div>
        <div className="text-[15px] font-semibold">สมุดจดบันทึกการขาย</div>
        <div className="flex-1" />
        <div className="border-border flex items-center gap-2.5 rounded-full border bg-white py-[5px] pr-[6px] pl-3.5">
          <div className="text-right leading-tight">
            <div className="text-[13px] font-semibold">คุณ {displayName}</div>
            <div className="text-ink-3 text-[11px]">{roleLabel}</div>
          </div>
          <div
            className="flex size-[30px] items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ background: '#F4E3DC', color: '#9A5B14' }}
          >
            {avatarText}
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
