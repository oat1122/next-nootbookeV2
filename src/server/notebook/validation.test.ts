import { describe, expect, it } from 'vitest';
import {
  checkDuplicateSchema,
  createCustomerCareSchema,
  createLeadSchema,
  createNotebookSchema,
} from './validation';

describe('createNotebookSchema', () => {
  it('ผ่านเมื่อมี nb_customer_name + email ถูกฟอร์แมต', () => {
    const r = createNotebookSchema.safeParse({ nb_customer_name: 'ACME', nb_email: 'a@b.com' });
    expect(r.success).toBe(true);
  });
  it('fail เมื่อไม่มี nb_customer_name หรือ email ผิด', () => {
    expect(createNotebookSchema.safeParse({}).success).toBe(false);
    expect(
      createNotebookSchema.safeParse({ nb_customer_name: 'X', nb_email: 'bad' }).success,
    ).toBe(false);
  });
});

describe('createLeadSchema', () => {
  it('default cus_channel=1 และ require ชื่อ/เบอร์', () => {
    const r = createLeadSchema.safeParse({
      cus_name: 'ACME',
      cus_firstname: 'a',
      cus_lastname: 'b',
      cus_tel_1: '0812345678',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cus_channel).toBe(1);
  });
  it('fail เมื่อขาด required', () => {
    expect(createLeadSchema.safeParse({ cus_name: 'ACME' }).success).toBe(false);
  });
});

describe('createCustomerCareSchema superRefine', () => {
  it('source_type=customer ต้องมี source_customer_id', () => {
    expect(
      createCustomerCareSchema.safeParse({ nb_date: '2026-01-01', source_type: 'customer' }).success,
    ).toBe(false);
    expect(
      createCustomerCareSchema.safeParse({
        nb_date: '2026-01-01',
        source_type: 'customer',
        source_customer_id: 'uuid',
      }).success,
    ).toBe(true);
  });
  it('source_type=notebook ต้องมี source_notebook_id', () => {
    expect(
      createCustomerCareSchema.safeParse({
        nb_date: '2026-01-01',
        source_type: 'notebook',
        source_notebook_id: 5,
      }).success,
    ).toBe(true);
  });
});

describe('checkDuplicateSchema', () => {
  it('จำกัด type ตาม enum', () => {
    expect(checkDuplicateSchema.safeParse({ type: 'phone', value: '0812345678' }).success).toBe(true);
    expect(checkDuplicateSchema.safeParse({ type: 'xxx', value: 'a' }).success).toBe(false);
  });
});
