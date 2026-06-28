import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Notebook v2</CardTitle>
          <CardDescription>
            โครงเริ่มต้น (foundation) พร้อมแล้ว — Next.js 16 · TypeScript · Tailwind v4 · shadcn/ui
            · Drizzle ORM · shared-token auth (TNP)
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-4 text-sm">
          <p>
            ก็อปโครงพื้นฐานมาจาก <code className="text-foreground">next-accountV2</code> โดยตัดโดเมนบัญชีออก
            ทั้งหมด — ต่อ DB/ล็อกอินชุดเดียวกับ TNP เริ่มสร้างฟีเจอร์ notebook ได้เลย
          </p>
          <Button>เริ่มต้น</Button>
        </CardContent>
      </Card>
    </main>
  );
}
