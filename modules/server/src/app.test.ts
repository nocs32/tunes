import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { migrate, openDb } from './db/index.ts';
import { migrations } from './db/migrations.ts';

describe('database', () => {
  it('runs every migration on a new database', () => {
    const db = openDb(':memory:');

    expect(migrate(db)).toBe(migrations.length);
  });

  it('does nothing on a second run', () => {
    const db = openDb(':memory:');
    const before = migrate(db);

    expect(migrate(db)).toBe(before);
  });
});

describe('api', () => {
  it('answers /api/health', async () => {
    const response = await createApp(openDb(':memory:')).request('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, schema: migrations.length });
  });
});
