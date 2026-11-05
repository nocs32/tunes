import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Spotify tokens are stored encrypted (AES-256-GCM) so a copied database file is useless
// without TOKEN_KEY. Sealed format: iv.tag.ciphertext, each part base64.

const algorithm = 'aes-256-gcm';

export const encrypt = (plain: string, keyBase64: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, Buffer.from(keyBase64, 'base64'), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.');
};

export const decrypt = (sealed: string, keyBase64: string): string => {
  const [iv, tag, data] = sealed.split('.').map((part) => Buffer.from(part, 'base64'));

  if (!iv || !tag || !data) {
    throw new Error('Not an encrypted value');
  }

  const decipher = createDecipheriv(algorithm, Buffer.from(keyBase64, 'base64'), iv);

  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};

// Random, URL-safe: session ids, OAuth state, PKCE verifiers.
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

// PKCE: the verifier stays with us; Spotify gets its SHA-256 (the challenge) when login starts
// and the verifier itself when we swap the code for tokens, proving both came from us.
export const createVerifier = (): string => randomToken(48);

export const challengeFor = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');
