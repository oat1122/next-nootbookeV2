# patches/

แพตช์ของ dependency ที่ใช้ผ่าน [`patch-package`](https://github.com/ds300/patch-package)
ถูก apply อัตโนมัติด้วย `postinstall` script ใน `package.json` ทุกครั้งที่ `npm install`.

## `@react-pdf+textkit+6.3.0.patch`

แพตช์นี้แก้บั๊กการ shape ภาษาไทย 2 อาการที่มีรากเดียวกัน — ทั้งคู่อยู่ใน `slice$1()`
(เกิดเฉพาะตอน @react-pdf ต้อง **slice** run เช่นในกล่องแคบ/หัวตาราง ไม่ใช่ทุกข้อความ).

**รากร่วม:** ฟอนต์ Sarabun shape `ำ` (SARA AM, U+0E33) โดย decompose เป็น `◌ํ` (U+0E4D) + `า`
(U+0E32) ผ่าน GSUB → fontkit คืน glyph **เกินมา 1 ตัว** ต่อ `ำ` หนึ่งตัว. `resolve()` ใน textkit
จึงสร้าง `glyphIndices` ผิด และ `slice$1()` หั่น glyph ผิดขอบเขต. (`SCRIPTS_NEEDING_DECOMPOSITION`
ใน textkit **ไม่มี** Thai และ NFD ของ react-pdf ก็ **ไม่** decompose `ำ` — มีแต่ NFKD ที่ decompose
ซึ่ง library ไม่ได้ใช้ จึงกันเคสนี้ที่ชั้น decompose ไม่ได้ ต้องแก้ที่ `slice$1()`).

### อาการ 1 — พยัญชนะ **ตัวแรก** หาย (ขอบเขต _เริ่มต้น_ ของ slice)

`รายการ` → `ายการ`, `ราคา` → `าคา`. เกิดเมื่อ glyph `า` มี `codePoints` **ว่าง** → `glyphIndices`
มีค่า **ซ้ำ** (เช่น `[0,0,1,2,2,3]`) → `glyphIndexAt(0)` คืน `1` แทน `0` → หั่น glyph ตัวแรกทิ้ง.

**แก้:** ที่ขอบเขต **เริ่มต้น** ถ้าหลาย glyph แมป string index เดียวกัน ให้ถอยไปใช้ glyph
**ตัวแรก** ของ index นั้น (ไม่ใช่ตัวสุดท้าย).

### อาการ 2 — พยัญชนะ **สะกดตัวท้าย** หาย (ขอบเขต _สิ้นสุด_ ของ slice)

`จำนวน` → `จำนว`, `จำนวนเงิน` → `จำนวนเงิ` (เห็นชัดในหัวตาราง width คงที่ที่บังคับ slice).
เกิดเมื่อ glyph `า` มี `codePoints` **ครบ** (`[0E32]`) → `glyphIndices` ถูก **เลื่อน** เป็น identity
(`[0,1,2,3,4,5]`) ทำให้ค่าสูงสุดเกิน string index ตัวสุดท้าย → `glyphIndexAt(end-1)` คืน index
**น้อยเกินไป** → slice ตัด glyph ตัวท้าย (พยัญชนะสะกด) ทิ้ง.

**แก้ (mirror ของอาการ 1):** ที่ขอบเขต **สิ้นสุด** เมื่อ slice ถึงท้าย run และจำนวน glyph
**มากกว่า** จำนวนตัวอักษรของ run (มี decomposition) ให้ดึง `endIndex` ไปที่ glyph ตัวสุดท้าย
เพื่อไม่ให้ glyph ท้ายหาย.

**กันการถดถอย:** `src/server/pdf/thai-shaping.test.ts` — 2 เคส (นับ glyph ที่วาดจริงในไฟล์ PDF):
อาการ 1 = `รายการ/ราคา` ต้องคง `ร` (รวม 28 glyph), อาการ 2 = หัวตาราง `จำนวน/จำนวนเงิน` ต้องคง
`น` ท้าย (รวม 33 glyph). จะ fail ถ้าแพตช์ส่วนใดหลุด.

> เมื่ออัป `@react-pdf/textkit` ให้เช็คก่อนว่า upstream แก้บั๊กนี้แล้วหรือยัง
> (diegomura/react-pdf — Thai/complex-script dropped consonant) ถ้าแก้แล้วลบแพตช์ได้
