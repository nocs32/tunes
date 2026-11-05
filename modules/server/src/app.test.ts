import { describe, expect, it } from 'vitest';
import { migrate, openDb } from './db/index.ts';
import { migrations } from './db/migrations.ts';
import { testApp } from './testing.ts';

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
    const response = await testApp().request('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, schema: migrations.length });
  });

  it('refuses the profile without a login', async () => {
    const response = await testApp().request('/api/taste');

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'logged_out' });
  });
});
