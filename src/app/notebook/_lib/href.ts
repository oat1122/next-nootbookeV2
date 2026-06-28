/** สร้าง href ของ /notebook โดยคงพารามิเตอร์เดิม แล้ว patch ทับ (ค่า null/'' = ลบทิ้ง) */
export function notebookHref(
  current: Record<string, string | undefined>,
  patch: Record<string, string | number | null | undefined>,
  base = '/notebook',
): string {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    if (v !== undefined && v !== '') merged[k] = v;
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === '') delete merged[k];
    else merged[k] = String(v);
  }
  const qs = new URLSearchParams(merged).toString();
  return qs ? `${base}?${qs}` : base;
}
