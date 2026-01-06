import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route API pour vérifier l'utilisation de Google Speech-to-Text
 * 
 * Note: Cette route nécessite l'API Google Cloud Billing pour récupérer
 * les données réelles. Pour l'instant, elle retourne des informations basiques.
 * 
 * Pour une surveillance complète, utilisez Google Cloud Console directement.
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier la clé API
    const apiKey = process.env.GOOGLE_SPEECH_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'Google Speech API key non configurée' },
        { status: 500 }
      );
    }

    // Note: L'API Google Speech-to-Text ne fournit pas directement
    // les statistiques d'utilisation via l'API REST.
    // Il faut utiliser Google Cloud Console ou l'API Billing.
    
    return NextResponse.json({
      success: true,
      message: 'Pour vérifier l\'utilisation, consultez Google Cloud Console',
      links: {
        dashboard: 'https://console.cloud.google.com/apis/dashboard',
        quotas: 'https://console.cloud.google.com/apis/api/speech.googleapis.com/quotas',
        billing: 'https://console.cloud.google.com/billing',
      },
      instructions: [
        '1. Allez dans Google Cloud Console > APIs & Services > Dashboard',
        '2. Cliquez sur "Cloud Speech-to-Text API"',
        '3. Consultez la section "Usage" pour voir votre consommation',
        '4. Allez dans "Quotas" pour voir les limites',
        '5. Configurez des alertes dans "Billing" > "Budgets & alerts"',
      ],
    });
  } catch (error) {
    console.error('[API /speech/usage] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

