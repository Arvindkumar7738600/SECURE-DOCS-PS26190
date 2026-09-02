import { NextResponse } from 'next/server';
import { requestIdHeader } from './request-id';

export function jsonResponseWithRequestId(
  body: unknown,
  status: number,
  requestId: string
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      [requestIdHeader()]: requestId,
    },
  });
}

