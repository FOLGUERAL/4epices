'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CircleHelp, Mic, Radio, Volume2, VolumeX, X } from 'lucide-react';
import { getRecetteBySlug, Recette } from '@/lib/strapi';
import RecettesGridSkeleton from '@/components/RecettesGridSkeleton';
import AnimatedCookingGuide from '@/components/AnimatedCookingGuide';
import RatingForm from '@/components/RatingForm';
import { getKitchenRecipeStorageKey } from '@/components/KitchenModeLink';
import { toast } from '@/components/Toast';
import { useVoiceCooking } from '@/hooks/useVoiceCooking';
import { getCookingGuide } from '@/lib/cookingGuide';

type StepData = {
  id: number;
  text: string;
  temperature?: number;
};

const normalizeFractions = (value: string): string =>
  value
    .replace(/½/g, '1/2')
    .replace(/⅓/g, '1/3')
    .replace(/⅔/g, '2/3')
    .replace(/¼/g, '1/4')
    .replace(/¾/g, '3/4')
    .replace(/⅛/g, '1/8');

const parseAmount = (value: string): number | null => {
  if (!value || typeof value !== 'string') return null;

  const cleaned = normalizeFractions(value.trim());
  const rangeMatch = cleaned.match(/^(\d+\.?\d*)-(\d+\.?\d*)/);
  if (rangeMatch) {
    return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  }

  const fractionMatch = cleaned.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const denominator = parseFloat(fractionMatch[2]);
    return denominator !== 0 ? parseFloat(fractionMatch[1]) / denominator : null;
  }

  const numberMatch = cleaned.match(/^(\d+\.?\d*)/);
  return numberMatch ? parseFloat(numberMatch[1]) : null;
};

const formatAmount = (value: number): string => {
  const commonFractions: Record<number, string> = {
    0.125: '1/8',
    0.25: '1/4',
    0.333: '1/3',
    0.5: '1/2',
    0.667: '2/3',
    0.75: '3/4',
  };

  const rounded = Math.round(value * 100) / 100;
  for (const [decimal, label] of Object.entries(commonFractions)) {
    if (Math.abs(rounded - parseFloat(decimal)) < 0.05) {
      return label;
    }
  }

  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }

  return rounded.toFixed(1).replace(/\.0$/, '');
};

const formatDuration = (minutes: number): string => {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} heure${hours > 1 ? 's' : ''}`;

  return `${hours} heure${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
};

const cleanIngredientText = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(\d+\/\d+)\s*\/\d+/g, '$1');

const adjustIngredients = (
  rawIngredients: unknown[],
  basePortions: number,
  selectedPortions: number
): string[] => {
  if (basePortions <= 0) return [];

  const ratio = selectedPortions / basePortions;

  return rawIngredients
    .map((ingredient) => {
      if (typeof ingredient === 'string') {
        const cleaned = cleanIngredientText(normalizeFractions(ingredient));
        const match = cleaned.match(/^([\d\.\/\-]+)\s*([a-zéèêàùûîôâäëïöüçœæ\.]*?)\s+(.+)$/i);

        if (match) {
          const amount = parseAmount(match[1]);
          if (amount !== null) {
            const unit = match[2] ? ` ${match[2]}` : '';
            return `${formatAmount(amount * ratio)}${unit} ${match[3]}`.trim();
          }
        }

        return cleaned;
      }

      if (ingredient && typeof ingredient === 'object') {
        const entry = ingredient as { quantit?: string; quantite?: string; ingredient?: string };
        const rawQuantity = cleanIngredientText(normalizeFractions(entry.quantite || entry.quantit || ''));
        const name = entry.ingredient || '';
        const amount = parseAmount(rawQuantity);

        if (amount !== null) {
          const unitMatch = rawQuantity.match(/^[\d\.\/]+\s*([a-zéèêàùûîôâäëïöüçœæ]+\.?)$/i);
          const unit = unitMatch ? ` ${unitMatch[1]}` : '';
          return `${formatAmount(amount * ratio)}${unit} ${name}`.trim();
        }

        return rawQuantity ? `${rawQuantity} ${name}`.trim() : name;
      }

      return String(ingredient);
    })
    .filter(Boolean);
};

const extractSteps = (html: string): StepData[] => {
  const parser = typeof window !== 'undefined' ? new DOMParser() : null;
  const documentRef = parser ? parser.parseFromString(html, 'text/html') : null;
  const elements = documentRef?.querySelectorAll('p, li') || [];
  const parsedSteps: StepData[] = [];

  elements.forEach((element, index) => {
    const text = element.textContent?.trim() || '';
    if (!text || text.length < 3) return;

    const cleanedText = text.replace(/^Étape\s+\d+\s*:\s*/i, '').trim();
    const tempMatch = cleanedText.match(/(\d{2,3})\s*°/);

    parsedSteps.push({
      id: index + 1,
      text: cleanedText,
      temperature: tempMatch ? parseInt(tempMatch[1], 10) : undefined,
    });
  });

  if (parsedSteps.length > 0) {
    return parsedSteps;
  }

  const fallbackText = documentRef?.body.textContent || html;
  return fallbackText
    .split('\n')
    .filter((line) => line.trim().length > 3)
    .map((line, index) => ({ id: index + 1, text: line.trim() }));
};

const isRecette = (value: unknown, slug: string): value is Recette => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<Recette>;
  return candidate.attributes?.slug === slug && typeof candidate.attributes?.titre === 'string';
};

const voiceCommandGroups = [
  {
    title: 'Navigation',
    commands: ['suivant', 'précédent', 'répète', 'lecture', 'étape 3'],
  },
  {
    title: 'Infos',
    commands: ['temps total ?', 'ou j\'en suis ?'],
  },
  {
    title: 'Aide',
    commands: ['aide'],
  },
];

export default function CuisineModePage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === 'string' ? params.slug : '';

  const [recette, setRecette] = useState<Recette | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [selectedPortions, setSelectedPortions] = useState(4);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [steps, setSteps] = useState<StepData[]>([]);
  const [isVoiceHelpOpen, setIsVoiceHelpOpen] = useState(false);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(false);
  const [hasShownVoiceHint, setHasShownVoiceHint] = useState(false);

  const getSavedPortions = useCallback((recipeSlug: string, basePortions: number): number => {
    if (typeof window === 'undefined') return basePortions;

    try {
      const saved = window.localStorage.getItem(`recipe_portions_${recipeSlug}`);
      if (!saved) return basePortions;

      const parsed = parseInt(saved, 10);
      return !Number.isNaN(parsed) && parsed > 0 && parsed <= 20 ? parsed : basePortions;
    } catch {
      return basePortions;
    }
  }, []);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const applyRecette = (data: Recette) => {
      setRecette(data);

      const rawIngredients = Array.isArray(data.attributes.ingredients) ? data.attributes.ingredients : [];
      const basePortions = data.attributes.nombrePersonnes || 4;
      const savedPortions = getSavedPortions(slug, basePortions);

      setSelectedPortions(savedPortions);
      setIngredients(adjustIngredients(rawIngredients, basePortions, savedPortions));
      setSteps(
        extractSteps(typeof data.attributes.etapes === 'string' ? data.attributes.etapes : '')
      );
    };

    const loadRecette = async () => {
      try {
        setError(null);

        try {
          const cachedRecipe = window.sessionStorage.getItem(getKitchenRecipeStorageKey(slug));
          if (cachedRecipe) {
            const parsedRecipe = JSON.parse(cachedRecipe);
            if (isRecette(parsedRecipe, slug)) {
              applyRecette(parsedRecipe);
              return;
            }
          }
        } catch {
          window.sessionStorage.removeItem(getKitchenRecipeStorageKey(slug));
        }

        const response = await getRecetteBySlug(slug);
        if (controller.signal.aborted) return;

        if (response?.data) {
          applyRecette(response.data);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la recette:', error);
        if (!controller.signal.aborted) {
          setError('Impossible de charger cette recette pour le moment.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadRecette();
    return () => controller.abort();
  }, [getSavedPortions, slug]);

  useEffect(() => {
    if (!slug) return;

    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(`recipe_portions_${slug}`, String(selectedPortions));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [selectedPortions, slug]);

  const toggleIngredient = useCallback((index: number) => {
    setCheckedIngredients((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const changePortions = useCallback(
    (nextValue: number) => {
      if (!recette) return;

      const basePortions = recette.attributes.nombrePersonnes || 4;
      const rawIngredients = Array.isArray(recette.attributes.ingredients)
        ? recette.attributes.ingredients
        : [];

      setSelectedPortions(nextValue);
      setIngredients(adjustIngredients(rawIngredients, basePortions, nextValue));
      setCheckedIngredients(new Set());
    },
    [recette]
  );

  const handleNextStep = useCallback(() => {
    setCurrentStep((previous) => Math.min(previous + 1, steps.length - 1));
  }, [steps.length]);

  const handlePreviousStep = useCallback(() => {
    setCurrentStep((previous) => Math.max(previous - 1, 0));
  }, []);

  const handleGoToStep = useCallback((index: number) => {
    const boundedIndex = Math.max(0, Math.min(index, steps.length - 1));
    setCurrentStep(boundedIndex);
  }, [steps.length]);

  const currentStepData = useMemo(() => steps[currentStep], [currentStep, steps]);
  const cookingGuide = useMemo(
    () =>
      getCookingGuide(
        recette?.attributes.titre || 'la recette',
        ingredients,
        currentStepData?.text || '',
        currentStep,
        steps.length
      ),
    [currentStep, currentStepData?.text, ingredients, recette?.attributes.titre, steps.length]
  );
  const getCoachLine = useCallback(
    () => currentStepData?.text || cookingGuide.line,
    [cookingGuide.line, currentStepData?.text]
  );
  const getRecipeTimeLine = useCallback(() => {
    const prep = recette?.attributes.tempsPreparation || 0;
    const cooking = recette?.attributes.tempsCuisson || 0;
    const total = prep + cooking;

    if (total <= 0) {
      return 'Je n ai pas de temps total precise pour cette recette.';
    }

    const details = [
      prep > 0 ? `preparation ${formatDuration(prep)}` : '',
      cooking > 0 ? `cuisson ${formatDuration(cooking)}` : '',
    ].filter(Boolean);

    return details.length > 0
      ? `Le temps total est de ${formatDuration(total)} : ${details.join(', ')}.`
      : `Le temps total est de ${formatDuration(total)}.`;
  }, [recette?.attributes.tempsCuisson, recette?.attributes.tempsPreparation]);

  const { voiceState, speak, startListening, stopListening, isSpeechEnabled, setSpeechEnabled } = useVoiceCooking(
    steps,
    currentStep,
    handleNextStep,
    handlePreviousStep,
    handleGoToStep,
    getCoachLine,
    getRecipeTimeLine
  );
  const lastAutoReadStepRef = useRef(currentStep);

  useEffect(() => {
    if (lastAutoReadStepRef.current === currentStep) return;

    lastAutoReadStepRef.current = currentStep;

    if (isSpeechEnabled && currentStepData?.text) {
      speak(currentStepData.text, true);
    }
  }, [currentStep, currentStepData?.text, isSpeechEnabled, speak]);

  const handleSpeakGuide = useCallback(() => {
    if (currentStepData?.text) {
      speak(currentStepData.text, true);
    }
  }, [currentStepData?.text, speak]);

  const handleToggleVoice = useCallback(() => {
    if (voiceState.isListening) {
      stopListening();
      return;
    }

    startListening();
    setIsVoiceHelpOpen(false);

    if (!hasShownVoiceHint) {
      toast.info('Commandes vocales : dites "suivant", "repete" ou "aide".');
      setHasShownVoiceHint(true);
    }
  }, [hasShownVoiceHint, startListening, stopListening, voiceState.isListening]);

  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0;
  const isLastStep = currentStep === steps.length - 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <RecettesGridSkeleton count={1} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-12 text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Chargement impossible</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium"
            >
              Accueil
            </button>
            <button
              onClick={() => router.push('/recettes')}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
            >
              Recettes
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!recette) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-12 text-center max-w-md">
          <div className="text-5xl mb-4">🍳</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Recette introuvable</h2>
          <p className="text-gray-600 mb-6">
            Cette recette n’existe pas ou a été supprimée.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium"
            >
              Accueil
            </button>
            <button
              onClick={() => router.push('/recettes')}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
            >
              Recettes
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-12 text-center max-w-md">
          <div className="text-5xl mb-4">📝</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucune étape disponible</h2>
          <p className="text-gray-600 mb-6">
            Cette recette ne contient pas d’étapes de préparation détaillées.
          </p>
          <button
            onClick={() => router.push(`/recettes/${recette.attributes.slug}`)}
            className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium"
          >
            Voir la recette complète
          </button>
        </div>
      </div>
    );
  }

  const tempsPrep = recette.attributes.tempsPreparation || 0;
  const tempsCuisson = recette.attributes.tempsCuisson || 0;
  const tempsTotal = tempsPrep + tempsCuisson;

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <div className="print:hidden fixed inset-x-0 top-16 z-30 h-1 bg-gray-200">
        <div
          className="h-1 bg-orange-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{recette.attributes.titre}</h1>
        <div className="flex gap-4 text-sm text-gray-600">
          {tempsPrep > 0 && <span>Préparation : {tempsPrep} min</span>}
          {tempsCuisson > 0 && <span>Cuisson : {tempsCuisson} min</span>}
          {recette.attributes.nombrePersonnes && (
            <span>{recette.attributes.nombrePersonnes} personnes</span>
          )}
        </div>
      </div>

      <div className="print:hidden max-w-4xl mx-auto px-4 py-8 pt-10">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              🖨️ Imprimer
            </button>
            <button
              onClick={() => router.push(`/recettes/${recette.attributes.slug}`)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
            >
              Vue complète
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-5 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-gray-900">
                {recette.attributes.titre}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-600">
                {tempsTotal > 0 && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-medium">
                    Temps total : {formatDuration(tempsTotal)}
                  </span>
                )}
                <span className="rounded-full bg-orange-50 px-3 py-1 font-medium text-orange-700">
                  {selectedPortions} {selectedPortions === 1 ? 'personne' : 'personnes'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsIngredientsOpen((isOpen) => !isOpen)}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700 focus-ring"
            >
              {isIngredientsOpen ? 'Masquer les ingredients' : 'Ingredients'}
            </button>
          </div>

          {isIngredientsOpen && (
            <div className="mt-5 border-t border-gray-100 pt-5">
              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-orange-50 p-4">
                <span className="text-sm font-medium text-gray-700">Portions :</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changePortions(Math.max(1, selectedPortions - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-gray-700 shadow-sm hover:bg-gray-50"
                    aria-label="Reduire les portions"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-lg font-bold text-orange-600">
                    {selectedPortions}
                  </span>
                  <button
                    onClick={() => changePortions(Math.min(20, selectedPortions + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-gray-700 shadow-sm hover:bg-gray-50"
                    aria-label="Augmenter les portions"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm text-gray-500">
                  {selectedPortions === 1 ? 'personne' : 'personnes'}
                </span>
              </div>

              <h2 className="mb-3 text-xl font-bold text-gray-900">Ingredients</h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {ingredients.map((ingredient, index) => {
                  const isChecked = checkedIngredients.has(index);
                  return (
                    <li
                      key={`${ingredient}-${index}`}
                      className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
                    >
                      <input
                        id={`ingredient-${index}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleIngredient(index)}
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <label htmlFor={`ingredient-${index}`} className="flex-1 cursor-pointer">
                        <span
                          className={`text-gray-700 ${
                            isChecked ? 'text-gray-400 line-through' : ''
                          }`}
                        >
                          {ingredient}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Étape {currentStep + 1} sur {steps.length}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
                {currentStepData?.temperature && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                    🔥 {currentStepData.temperature}°C
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex gap-2">
                <button
                  type="button"
                  onClick={() => setSpeechEnabled(!isSpeechEnabled)}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    isSpeechEnabled
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  aria-label={isSpeechEnabled ? 'Désactiver la lecture orale' : 'Activer la lecture orale'}
                  title={isSpeechEnabled ? 'Désactiver la lecture orale' : 'Activer la lecture orale'}
                >
                  {isSpeechEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </button>
                <button
                  onClick={handleToggleVoice}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    voiceState.isListening
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                  disabled={!voiceState.isSupported}
                >
                  {voiceState.isListening ? (
                    <span className="relative flex h-4 w-4 items-center justify-center">
                      <span className="absolute h-4 w-4 animate-ping rounded-full bg-white/80" />
                      <span className="absolute h-3 w-3 rounded-full bg-red-200" />
                      <Radio className="relative h-4 w-4" />
                    </span>
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {voiceState.isListening ? 'Arrêter la commande vocale' : 'Activer la commande vocale'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsVoiceHelpOpen((isOpen) => !isOpen)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200 focus-ring"
                  aria-label="Afficher les commandes vocales"
                  title="Commandes vocales"
                >
                  <CircleHelp className="h-5 w-5" aria-hidden="true" />
                </button>

                {isVoiceHelpOpen && (
                  <div className="absolute right-0 top-12 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-4 text-left shadow-xl">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-gray-900">Commandes vocales</h3>
                      <button
                        type="button"
                        onClick={() => setIsVoiceHelpOpen(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                        aria-label="Fermer l'aide vocale"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {voiceCommandGroups.map((group) => (
                        <div key={group.title}>
                          <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
                            {group.title}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.commands.map((command) => (
                              <span
                                key={command}
                                className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                              >
                                "{command}"
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <AnimatedCookingGuide
            guide={cookingGuide}
            stepText={currentStepData?.text || ''}
            isSpeaking={voiceState.isSpeaking}
            speakingText={voiceState.speakingText}
            speakingCharIndex={voiceState.speakingCharIndex}
            isSpeechEnabled={isSpeechEnabled}
            onSpeak={handleSpeakGuide}
          />

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={handlePreviousStep}
              disabled={currentStep === 0}
              className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Précédent
            </button>
            <button
              onClick={handleNextStep}
              disabled={currentStep === steps.length - 1}
              className="rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant
            </button>
          </div>

          <div className="mt-4 flex gap-1">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => handleGoToStep(index)}
                title={`Aller à l'étape ${index + 1}`}
                className={`h-2 flex-1 rounded transition-all hover:scale-y-150 ${
                  index < currentStep
                    ? 'bg-orange-400'
                    : index === currentStep
                      ? 'bg-orange-600'
                      : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {isLastStep && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">Vous avez termine ?</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Partagez votre note ou un commentaire pour aider les prochains cuisiniers.
                </p>
              </div>
              <RatingForm
                recetteId={recette.id}
                recetteTitle={recette.attributes.titre}
              />
            </div>
          )}
        </div>
      </div>

      <div className="hidden print:block max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">Ingrédients</h2>
          <ul className="space-y-2">
            {ingredients.map((ingredient, index) => (
              <li key={`${ingredient}-${index}`} className="text-gray-700 break-words">
                {ingredient}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">Préparation</h2>
          <div className="prose max-w-none">
            <div
              dangerouslySetInnerHTML={{
                __html: typeof recette.attributes.etapes === 'string' ? recette.attributes.etapes : '',
              }}
              className="text-gray-700"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
