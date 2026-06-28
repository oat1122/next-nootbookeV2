import 'server-only';
import path from 'node:path';
import { Font } from '@react-pdf/renderer';

/**
 * react-pdf ต้องใช้ฟอนต์ .ttf จริง — next/font ให้มาเป็น woff2 ซึ่ง fontkit เปิดไม่ได้
 * จึง bundle IBM Plex Sans Thai (ตรงกับ UI) + IBM Plex Mono (เวลา/ตัวเลข) ไว้ข้างโมดูลนี้
 * ลงทะเบียนครั้งเดียวต่อ process (idempotent). น้ำหนัก 500 จะ map ไป 400/600 ที่ใกล้สุดเอง
 */
let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  registered = true;

  const dir = path.join(process.cwd(), 'src/server/notebook/pdf/fonts');
  Font.register({
    family: 'IBM Plex Sans Thai',
    fonts: [
      { src: path.join(dir, 'IBMPlexSansThai-Regular.ttf'), fontWeight: 400 },
      { src: path.join(dir, 'IBMPlexSansThai-SemiBold.ttf'), fontWeight: 600 },
      { src: path.join(dir, 'IBMPlexSansThai-Bold.ttf'), fontWeight: 700 },
    ],
  });
  Font.register({
    family: 'IBM Plex Mono',
    fonts: [{ src: path.join(dir, 'IBMPlexMono-Regular.ttf'), fontWeight: 400 }],
  });

  // ปิด hyphenation — กัน react-pdf ตัดคำไทย/อังกฤษกลางคำผิด
  Font.registerHyphenationCallback((word) => [word]);
}
