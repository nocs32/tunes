import { describe, expect, it } from 'vitest';
import { challengeFor, decrypt, encrypt } from './crypto.ts';

const key = Buffer.alloc(32, 1).toString('base64');

describe('crypto', () => {
  it('round-trips and uses a new IV each time', () => {
    const a = encrypt('secret-token', key);

    expect(decrypt(a, key)).toBe('secret-token');
    expect(encrypt('secret-token', key)).not.toBe(a);
  });

  it('refuses a tampered value', () => {
    const [iv, tag, data] = encrypt('secret-token', key).split('.');
    const flipped = Buffer.from(data ?? '', 'base64');

    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(() => decrypt([iv, tag, flipped.toString('base64')].join('.'), key)).toThrow();
  });

  it('computes the PKCE challenge from RFC 7636', () => {
    expect(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});
