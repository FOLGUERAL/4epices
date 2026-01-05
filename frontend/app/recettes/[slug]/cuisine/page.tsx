'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRecetteBySlug, Recette, getStrapiMediaUrl } from '@/lib/strapi';
import OptimizedImage from '@/components/OptimizedImage';
import CookingTimer from '@/components/CookingTimer';
import RecettesGridSkeleton from '@/components/RecettesGridSkeleton';

export default function CuisineModePage() {
  const params = useParams();
  const router = useRouter();
  const [recette, setRecette] = useState<Recette | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [ingredients, setIngredients] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    
    const loadRecette = async () => {
      const slug = params.slug as string;
      
      try {
        if (!slug) {
          if (isMounted) {
            setLoading(false);
          }
          return;
        }
        
        const response = await getRecetteBySlug(slug);
        
        if (!isMounted) return;
        
        if (response && response.data) {
          setRecette(response.data);
          
          // Normaliser les ingrédients
          const rawIngredients = Array.isArray(response.data.attributes.ingredients)
            ? response.data.attributes.ingredients
            : [];
          
          const normalized = rawIngredients.map((ing: any) => {
            if (typeof ing === 'string') return ing;
            if (typeof ing === 'object' && ing !== null) {
              const quantite = ing.quantite || '';
              const ingredient = ing.ingredient || '';
              return quantite ? `${quantite} ${ingredient}`.trim() : ingredient;
            }
            return String(ing);
          });
          
          setIngredients(normalized);
          setLoading(false);
        } else {
          // Ne pas rediriger immédiatement, laisser l'utilisateur voir l'erreur
          console.warn('Recette non trouvée pour le slug:', slug);
          if (isMounted) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la recette:', error);
        console.error('Slug:', slug);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRecette();
    
    return () => {
      isMounted = false;
    };
  }, [params.slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <RecettesGridSkeleton count={1} />
        </div>
      </div>
    );
  }

  if (!recette) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Recette non trouvée</h2>
            <p className="text-gray-600 mb-6">
              La recette demandée n'existe pas ou n'est plus disponible.
            </p>
            <button
              onClick={() => router.push('/')}
              className="inline-block bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Extraire les étapes du HTML
  const extractSteps = (html: string): string[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const steps: string[] = [];
    
    // Chercher les paragraphes ou listes
    const paragraphs = doc.querySelectorAll('p, li');
    paragraphs.forEach((p) => {
      const text = p.textContent?.trim();
      if (text && text.length > 0) {
        steps.push(text);
      }
    });
    
    // Si pas de paragraphes, diviser par les sauts de ligne
    if (steps.length === 0) {
      const text = doc.body.textContent || '';
      steps.push(...text.split('\n').filter(s => s.trim().length > 0));
    }
    
    return steps.length > 0 ? steps : [html];
  };

  const steps = extractSteps(recette.attributes.etapes);
  const imageUrl = recette.attributes.imagePrincipale?.data?.attributes?.url || null;
  const tempsPrep = recette.attributes.tempsPreparation || 0;
  const tempsCuisson = recette.attributes.tempsCuisson || 0;

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header pour impression */}
      <div className="hidden print:block mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{recette.attributes.titre}</h1>
        <div className="flex gap-4 text-sm text-gray-600">
          {tempsPrep > 0 && <span>Préparation: {tempsPrep} min</span>}
          {tempsCuisson > 0 && <span>Cuisson: {tempsCuisson} min</span>}
          {recette.attributes.nombrePersonnes && <span>{recette.attributes.nombrePersonnes} personnes</span>}
        </div>
      </div>

      {/* Mode cuisine (non-impression) */}
      <div className="print:hidden max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Imprimer
            </button>
            <button
              onClick={() => router.push(`/recettes/${recette.attributes.slug}`)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
            >
              Vue complète
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          {imageUrl && (
            <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <OptimizedImage
                src={imageUrl}
                alt={recette.attributes.titre}
                fill
                className="object-cover"
                sizes="100vw"
                aspectRatio="16/9"
              />
            </div>
          )}
          
          <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{recette.attributes.titre}</h1>
            
            {/* Timers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {tempsPrep > 0 && (
                <CookingTimer
                  duration={tempsPrep}
                  label="Préparation"
                />
              )}
              {tempsCuisson > 0 && (
                <CookingTimer
                  duration={tempsCuisson}
                  label="Cuisson"
                />
              )}
            </div>

            {/* Ingrédients */}
            <div className="mb-8 print:mb-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Ingrédients</h2>
              <ul className="space-y-2">
                {ingredients.map((ing, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-gray-700">{ing}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Étapes pas-à-pas */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Étape {currentStep + 1} sur {steps.length}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handlePreviousStep}
                disabled={currentStep === 0}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <button
                onClick={handleNextStep}
                disabled={currentStep === steps.length - 1}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          </div>

          <div className="prose max-w-none">
            <div className="text-lg text-gray-700 leading-relaxed">
              {steps[currentStep]}
            </div>
          </div>

          {/* Indicateur de progression */}
          <div className="mt-6">
            <div className="flex gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 flex-1 rounded ${
                    index <= currentStep ? 'bg-orange-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Vue imprimable */}
      <div className="hidden print:block max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Ingrédients</h2>
          <ul className="space-y-2">
            {ingredients.map((ing, index) => (
              <li key={index} className="text-gray-700">
                {ing}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Préparation</h2>
          <div className="prose max-w-none">
            <div
              dangerouslySetInnerHTML={{ __html: recette.attributes.etapes }}
              className="text-gray-700"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

