import crypto from 'crypto';

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_LENGTH = 16;

export function generateRequestId(): string {
  return crypto.randomBytes(REQUEST_ID_LENGTH).toString('hex');
}

export function getOrCreateRequestId(headerValue?: string | null): string {
  if (headerValue && isValidRequestId(headerValue)) {
    return headerValue;
  }
  return generateRequestId();
}

function isValidRequestId(id: string): boolean {
  return /^[a-f0-9]{16,32}$/i.test(id) && id.length <= 64;
}

export function requestIdHeader(): string {
  return REQUEST_ID_HEADER;
}
