import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route API pour transcrire un audio avec Google Speech-to-Text
 * 
 * Reçoit un fichier audio (blob) et retourne la transcription
 * 
 * Nécessite NEXT_PUBLIC_GOOGLE_SPEECH_API_KEY dans les variables d'environnement
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier la clé API
    const apiKey = process.env.GOOGLE_SPEECH_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'Google Speech API key non configurée' },
        { status: 500 }
      );
    }

    // Récupérer le fichier audio
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { success: false, message: 'Aucun fichier audio fourni' },
        { status: 400 }
      );
    }

    // Convertir le fichier en base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    // Appeler Google Speech-to-Text API
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            encoding: 'WEBM_OPUS', // Format par défaut de MediaRecorder
            sampleRateHertz: 48000,
            languageCode: 'fr-FR',
            enableAutomaticPunctuation: true,
            model: 'latest_long', // Meilleur pour les dictées longues
          },
          audio: {
            content: base64Audio,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Erreur inconnue' } }));
      console.error('Erreur Google Speech API:', error);
      return NextResponse.json(
        { success: false, message: error.error?.message || 'Erreur lors de la transcription' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extraire la transcription
    if (data.results && data.results.length > 0) {
      const transcript = data.results
        .map((result: any) => result.alternatives[0]?.transcript || '')
        .filter((t: string) => t.length > 0)
        .join(' ');

      return NextResponse.json({
        success: true,
        transcript: transcript.trim(),
      });
    }

    return NextResponse.json({
      success: true,
      transcript: '',
      message: 'Aucune transcription trouvée',
    });
  } catch (error) {
    console.error('[API /speech/transcribe] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

