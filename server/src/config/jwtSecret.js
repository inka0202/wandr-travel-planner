// Pure check, kept out of env.js so it can be tested without process.exit.

export const MIN_JWT_SECRET_LENGTH = 32;
export const JWT_SECRET_PLACEHOLDER = 'replace_me_with_128_hex_chars'; // from .env.example

/** Returns an error message, or null if the secret is acceptable. Never includes the secret. */
export const checkJwtSecret = (secret) => {
  if (typeof secret !== 'string' || secret.length === 0) {
    return 'JWT_SECRET is missing';
  }
  if (secret.trim() === JWT_SECRET_PLACEHOLDER || secret.trim().startsWith('replace_me')) {
    return 'JWT_SECRET is still the .env.example placeholder';
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    return `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`;
  }
  return null;
};
