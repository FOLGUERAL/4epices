import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TEXT_LENGTH = 1200;
const DEFAULT_VOICE = 'ff_siwis';
const DEFAULT_FORMAT = 'mp3';

const getCacheDir = () =>
  process.env.TTS_CACHE_DIR || path.join(os.tmpdir(), '4epices-tts');

const getCacheKey = (text: string, voice: string) =>
  createHash('sha256')
    .update(JSON.stringify({ text, voice, format: DEFAULT_FORMAT, engine: 'kokoro-fastapi-v1' }))
    .digest('hex');

export async function POST(request: NextRequest) {
  try {
    const kokoroUrl = process.env.KOKORO_TTS_URL?.replace(/\/$/, '');
    if (!kokoroUrl) {
      return NextResponse.json(
        { error: 'KOKORO_TTS_URL non configure' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const voice = typeof body?.voice === 'string' && body.voice.trim() ? body.voice.trim() : DEFAULT_VOICE;

    if (!text) {
      return NextResponse.json({ error: 'Texte manquant' }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: 'Texte trop long' }, { status: 413 });
    }

    const cacheDir = getCacheDir();
    const cacheKey = getCacheKey(text, voice);
    const audioPath = path.join(cacheDir, `${cacheKey}.${DEFAULT_FORMAT}`);

    try {
      const cachedAudio = await readFile(audioPath);
      return new NextResponse(cachedAudio, {
        status: 200,
        headers: {
          'content-type': 'audio/mpeg',
          'cache-control': 'public, max-age=31536000, immutable',
          'x-tts-cache': 'hit',
        },
      });
    } catch {
      // Cache miss.
    }

    const response = await fetch(`${kokoroUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice,
        response_format: DEFAULT_FORMAT,
        speed: 0.88,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[TTS Kokoro] Erreur API', {
        status: response.status,
        error: errorText,
        kokoroUrl,
      });
      return NextResponse.json(
        { error: errorText || `Erreur TTS (${response.status})` },
        { status: 502 }
      );
    }

    const audio = Buffer.from(await response.arrayBuffer());
    let cacheState = 'miss';

    try {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(audioPath, audio);
    } catch (error) {
      cacheState = 'skip';
      console.warn('[TTS Kokoro] Cache non ecrit', {
        cacheDir,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return new NextResponse(audio, {
      status: 200,
      headers: {
        'content-type': response.headers.get('content-type') || 'audio/mpeg',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-tts-cache': cacheState,
      },
    });
  } catch (error) {
    console.error('[TTS Kokoro] Erreur route', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur TTS inconnue' },
      { status: 500 }
    );
  }
}
