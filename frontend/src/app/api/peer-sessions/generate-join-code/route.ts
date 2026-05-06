import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/server/db';
import { authenticate } from '@/lib/server/auth';
import crypto from 'crypto';

const randomCode = (len = 8) => {
  // Base32-ish alphabet without confusing chars
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
};

const normalizeCode = (code: string) => code.trim().toLowerCase();
const hashJoinCode = (code: string) => {
  const normalized = normalizeCode(code);
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(hash)}_${normalized.length}`;
};

export async function POST(req: NextRequest) {
  await connectDB();

  const { user, error } = await authenticate(req);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const length = typeof body.length === 'number' ? Math.max(4, Math.min(10, body.length)) : 8;

  const joinCode = randomCode(length);
  const joinCodeHash = hashJoinCode(joinCode);

  return NextResponse.json({ joinCode, joinCodeHash });
}

