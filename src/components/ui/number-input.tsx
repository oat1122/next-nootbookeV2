'use client';

import * as React from 'react';

/** เก็บเฉพาะตัวเลข (+ จุดทศนิยมตัวแรกถ้า decimal) — ตัดอักขระอื่นทิ้งทั้งหมด */
export function stripNumeric(s: string, decimal: boolean): string {
  if (!decimal) return s.replace(/\D/g, '');
  const cleaned = s.replace(/[^\d.]/g, '');
  const i = cleaned.indexOf('.');
  if (i === -1) return cleaned;
  // คงจุดแรกไว้ จุดที่เหลือตัดทิ้ง (กัน "1.2.3")
  return cleaned.slice(0, i + 1) + cleaned.slice(i + 1).replace(/\./g, '');
}

/** คั่นหลักพันด้วย "," เฉพาะส่วนจำนวนเต็ม คงทศนิยม + จุดที่กำลังพิมพ์ ('' → '') */
export function groupThousands(raw: string): string {
  if (!raw) return '';
  const [intPart, ...frac] = raw.split('.');
  const head = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac.length ? `${head}.${frac.join('')}` : head;
}

type Props = Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string | number;
  onValueChange: (raw: string) => void;
  /** อนุญาตทศนิยม (default) — false = จำนวนเต็มล้วน เช่นจำนวนชิ้น */
  decimal?: boolean;
};

/**
 * input ตัวเลขที่แสดงคอมมาคั่นหลักพันแบบสด (1000 → 1,000) ขณะพิมพ์
 * - ส่งค่า raw (ตัวเลขล้วน ไม่มีคอมมา) กลับทาง onValueChange ให้ผู้เรียก parse/เก็บเอง
 * - กู้ตำแหน่ง cursor หลัง re-format โดยนับอักขระสำคัญ (ข้ามคอมมาที่แทรก) → พิมพ์/ลบกลางคำ cursor ไม่กระโดด
 */
export function NumberInput({ value, onValueChange, decimal = true, ...props }: Props) {
  const ref = React.useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    // จำนวนอักขระสำคัญก่อน cursor (ใช้กู้ตำแหน่งหลัง format ใหม่)
    const sig = stripNumeric(el.value.slice(0, caret), decimal).length;
    onValueChange(stripNumeric(el.value, decimal));
    requestAnimationFrame(() => {
      const node = ref.current;
      if (!node) return;
      const formatted = node.value;
      let pos = 0;
      let seen = 0;
      while (pos < formatted.length && seen < sig) {
        if (formatted[pos] !== ',') seen++;
        pos++;
      }
      node.setSelectionRange(pos, pos);
    });
  }

  return (
    <input
      ref={ref}
      value={groupThousands(String(value ?? ''))}
      inputMode={decimal ? 'decimal' : 'numeric'}
      onChange={handleChange}
      {...props}
    />
  );
}
