import crypto from 'crypto';

export function calculateSha256(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function calculateSha256FromStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}
