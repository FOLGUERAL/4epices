'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CircleHelp, Mic, Play, Pointer, Share2, Volume2, VolumeX, X } from 'lucide-react';
import { getRecetteBySlug, Recette } from '@/lib/strapi';
import RecettesGridSkeleton from '@/components/RecettesGridSkeleton';
import AnimatedCookingGuide from '@/components/AnimatedCookingGuide';
import OptimizedImage from '@/components/OptimizedImage';
import RatingForm from '@/components/RatingForm';
import FavoriteButton from '@/components/FavoriteButton';
import PublishPinterestButton from '@/components/PublishPinterestButton';
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

const addCompletionStep = (steps: StepData[], recipeTitle: string): StepData[] => {
  if (steps.length === 0) return steps;

  const title = recipeTitle.trim() || 'cette recette';

  return [
    ...steps,
    {
      id: steps.length + 1,
      text: `Vous avez terminé la recette de ${title}. Belle cuisine !`,
    },
  ];
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

const playCookingStartSound = (): number => {
  if (typeof window === 'undefined') return 0;

  try {
    const audio = new Audio('/launch_music.m4a');
    audio.volume = 0.85;
    void audio.play().catch(() => {
      // Le navigateur peut refuser la lecture audio selon le contexte.
    });
    return 5000;
  } catch {
    return 0;
  }
};

const playCookingSuccessSound = (): number => {
  if (typeof window === 'undefined') return 0;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return 0;

    const audioContext = new AudioContextClass();
    const now = audioContext.currentTime;
    const notes = [
      { frequency: 523.25, start: 0, duration: 0.12 },
      { frequency: 659.25, start: 0.12, duration: 0.12 },
      { frequency: 783.99, start: 0.24, duration: 0.22 },
    ];

    notes.forEach(({ frequency, start, duration }) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.12, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now + start);
      oscillator.stop(now + start + duration + 0.02);
    });

    window.setTimeout(() => {
      void audioContext.close().catch(() => {});
    }, 800);

    return 650;
  } catch {
    return 0;
  }
};

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
  const [hasStartedCooking, setHasStartedCooking] = useState(false);
  const [isVoiceCommandEnabled, setIsVoiceCommandEnabled] = useState(false);
  const [hasUsedStepSwipe, setHasUsedStepSwipe] = useState(false);
  const [isSwipeCoachVisible, setIsSwipeCoachVisible] = useState(false);
  const stepBlockRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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
      const recipeSteps = extractSteps(typeof data.attributes.etapes === 'string' ? data.attributes.etapes : '');
      setSteps(addCompletionStep(recipeSteps, data.attributes.titre));
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

  const handleStepTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleStepTouchEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;

    if (deltaX < 0) {
      handleNextStep();
    } else {
      handlePreviousStep();
    }

    setHasUsedStepSwipe(true);
    setIsSwipeCoachVisible(false);
  }, [handleNextStep, handlePreviousStep]);

  const handleGoToStep = useCallback((index: number) => {
    const boundedIndex = Math.max(0, Math.min(index, steps.length - 1));
    setCurrentStep(boundedIndex);
  }, [steps.length]);

  const currentStepData = useMemo(() => steps[currentStep], [currentStep, steps]);
  const cookingStepCount = Math.max(steps.length - 1, 0);
  const guideStepIndex = Math.min(currentStep, Math.max(cookingStepCount - 1, 0));
  const cookingGuide = useMemo(
    () =>
      getCookingGuide(
        recette?.attributes.titre || 'la recette',
        ingredients,
        currentStepData?.text || '',
        guideStepIndex,
        cookingStepCount
      ),
    [cookingStepCount, currentStepData?.text, guideStepIndex, ingredients, recette?.attributes.titre]
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

  const handleFinishCooking = useCallback(() => {
    if (!recette) return;

    router.push(`/recettes/${recette.attributes.slug}/classique`);
  }, [recette, router]);

  const handleShareSuccess = useCallback(async () => {
    if (!recette || typeof window === 'undefined') return;

    const recipeUrl = `${window.location.origin}/recettes/${recette.attributes.slug}/classique`;
    const shareData = {
      title: recette.attributes.titre,
      text: `J'ai terminé la recette de ${recette.attributes.titre} sur 4 Epices.`,
      url: recipeUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(recipeUrl);
      toast.success('Lien de la recette copié');
    } catch {
      toast.info('Partage annulé');
    }
  }, [recette]);

  const { voiceState, speak, startListening, stopListening, isSpeechEnabled, setSpeechEnabled } = useVoiceCooking(
    steps,
    currentStep,
    handleNextStep,
    handlePreviousStep,
    handleGoToStep,
    getCoachLine,
    getRecipeTimeLine,
    handleFinishCooking
  );
  const lastAutoReadStepRef = useRef(currentStep);
  const isCompletionStep = hasStartedCooking && steps.length > 0 && currentStep === steps.length - 1;

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [slug, stopListening]);

  useEffect(() => {
    if (!hasStartedCooking) return;
    if (lastAutoReadStepRef.current === currentStep) return;

    lastAutoReadStepRef.current = currentStep;

    if (isSpeechEnabled && currentStepData?.text) {
      const successSoundDelay = isCompletionStep ? playCookingSuccessSound() : 0;
      const speakTimeoutId = window.setTimeout(() => {
        speak(currentStepData.text, true);
      }, successSoundDelay);

      return () => window.clearTimeout(speakTimeoutId);
    }
  }, [currentStep, currentStepData?.text, hasStartedCooking, isCompletionStep, isSpeechEnabled, speak]);

  const handleStartCooking = useCallback(() => {
    const firstStepIndex = 0;

    lastAutoReadStepRef.current = firstStepIndex;
    setCurrentStep(firstStepIndex);
    setIsIngredientsOpen(false);
    setHasStartedCooking(true);
    setIsSwipeCoachVisible(true);
    setIsVoiceHelpOpen(false);

    if (isVoiceCommandEnabled && voiceState.isSupported && !voiceState.isListening) {
      startListening();
    }

    if (isSpeechEnabled && steps[firstStepIndex]?.text) {
      const startSoundDelay = playCookingStartSound();

      window.setTimeout(() => {
        speak(steps[firstStepIndex].text, true);
      }, startSoundDelay);
    }
  }, [isSpeechEnabled, isVoiceCommandEnabled, speak, startListening, steps, voiceState.isListening, voiceState.isSupported]);

  useEffect(() => {
    if (!hasStartedCooking || typeof window === 'undefined') return;
    if (!window.matchMedia('(max-width: 639px)').matches) return;

    window.setTimeout(() => {
      stepBlockRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  }, [hasStartedCooking]);

  useEffect(() => {
    if (!isSwipeCoachVisible) return;

    const timeoutId = window.setTimeout(() => {
      setIsSwipeCoachVisible(false);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [isSwipeCoachVisible]);

  const handleSpeakGuide = useCallback(() => {
    if (currentStepData?.text) {
      speak(currentStepData.text, true);
    }
  }, [currentStepData?.text, speak]);

  const handleToggleVoice = useCallback(() => {
    if (!hasStartedCooking) {
      setIsVoiceCommandEnabled((isEnabled) => !isEnabled);
      setIsVoiceHelpOpen(false);
      return;
    }

    if (voiceState.isListening) {
      setIsVoiceCommandEnabled(false);
      stopListening();
      return;
    }

    setIsVoiceCommandEnabled(true);
    startListening();
    setIsVoiceHelpOpen(false);

    if (!hasShownVoiceHint) {
      toast.info('Commandes vocales : dites "suivant", "repete" ou "aide".');
      setHasShownVoiceHint(true);
    }
  }, [hasShownVoiceHint, hasStartedCooking, startListening, stopListening, voiceState.isListening]);

  const progress =
    hasStartedCooking && cookingStepCount > 0
      ? ((Math.min(currentStep, cookingStepCount - 1) + 1) / cookingStepCount) * 100
      : 0;
  const recipeImageUrl = recette?.attributes.imagePrincipale?.data?.attributes?.url || null;
  const recipeImageAlt =
    recette?.attributes.imagePrincipale?.data?.attributes?.alternativeText ||
    recette?.attributes.titre ||
    'Photo de la recette';

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
            onClick={() => router.push(`/recettes/${recette.attributes.slug}/classique`)}
            className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium"
          >
            Voir la recette détaillée
          </button>
        </div>
      </div>
    );
  }

  const tempsPrep = recette.attributes.tempsPreparation || 0;
  const tempsCuisson = recette.attributes.tempsCuisson || 0;
  const tempsTotal = tempsPrep + tempsCuisson;
  const renderVoiceControls = (showLabels: boolean) => {
    const isVoiceToggleActive = hasStartedCooking ? voiceState.isListening : isVoiceCommandEnabled;

    return (
    <div className="relative flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setSpeechEnabled(!isSpeechEnabled)}
        role="switch"
        aria-checked={isSpeechEnabled}
        className={`inline-flex h-10 items-center justify-center rounded-lg border transition-colors ${
          showLabels ? 'gap-3 px-3 text-sm font-medium' : 'w-14 px-1'
        } ${
          isSpeechEnabled
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
        }`}
        aria-label={isSpeechEnabled ? 'Désactiver le son' : 'Activer le son'}
        title={isSpeechEnabled ? 'Désactiver le son' : 'Activer le son'}
      >
        <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          isSpeechEnabled ? 'bg-emerald-600' : 'bg-red-500'
        }`}>
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
            isSpeechEnabled ? 'translate-x-5' : 'translate-x-1'
          }`}>
            {isSpeechEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-red-700" />
            )}
          </span>
        </span>
        {showLabels && (
          <span>{isSpeechEnabled ? 'Désactiver le son' : 'Activer le son'}</span>
        )}
      </button>
      <button
        type="button"
        onClick={handleToggleVoice}
        role="switch"
        aria-checked={isVoiceToggleActive}
        className={`inline-flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
          showLabels ? 'gap-3 px-3' : 'w-14 px-1'
        } ${
          isVoiceToggleActive
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
        }`}
        disabled={!voiceState.isSupported}
        aria-label={isVoiceToggleActive ? 'Désactiver la commande vocale' : 'Activer la commande vocale'}
        title={isVoiceToggleActive ? 'Désactiver la commande vocale' : 'Activer la commande vocale'}
      >
        <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          isVoiceToggleActive ? 'bg-emerald-600' : 'bg-red-500'
        }`}>
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
            isVoiceToggleActive ? 'translate-x-5' : 'translate-x-1'
          }`}>
            <Mic className={`h-3.5 w-3.5 ${
              isVoiceToggleActive ? 'text-emerald-700' : 'text-red-700'
            }`} />
          </span>
        </span>
        {showLabels && (
          <span>{isVoiceToggleActive ? 'Désactiver la commande vocale' : 'Activer la commande vocale'}</span>
        )}
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
    );
  };

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
              {isIngredientsOpen ? 'Masquer les ingrédients' : 'Afficher les ingrédients'}
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

              <h2 className="mb-3 text-xl font-bold text-gray-900">Ingrédients</h2>
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
        <div ref={stepBlockRef} className="bg-white rounded-2xl shadow-lg p-6 scroll-mt-20">
          {!hasStartedCooking ? (
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="w-full overflow-hidden rounded-xl bg-gray-100 shadow-sm">
                <OptimizedImage
                  src={recipeImageUrl}
                  alt={recipeImageAlt}
                  fill
                  priority
                  aspectRatio="16/9"
                  sizes="(max-width: 896px) 100vw, 896px"
                  className="w-full"
                />
              </div>

              <div className="max-w-2xl">
                <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase text-orange-700">
                  Prêt à cuisiner
                </span>
                <h2 className="mt-3 text-2xl font-bold text-gray-900">
                  Configurez le guidage avant de lancer la recette
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Vérifiez vos ingrédients, choisissez le son et activez la commande vocale si vous voulez garder les mains libres en utilisant votre voix pour passer d'une étape à l'autre.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:justify-center">
                {renderVoiceControls(true)}
              </div>

              <div className="flex flex-wrap justify-center gap-2 text-xs font-medium">
                <span className={`rounded-full px-3 py-1 ${
                  isSpeechEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {isSpeechEnabled ? 'Lecture orale active' : 'Lecture orale inactive'}
                </span>
                <span className={`rounded-full px-3 py-1 ${
                  isVoiceCommandEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {isVoiceCommandEnabled ? 'Commande vocale active au lancement' : 'Commande vocale inactive'}
                </span>
              </div>

              <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={handleStartCooking}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-orange-700 focus-ring"
                >
                  <Play className="h-5 w-5" aria-hidden="true" />
                  Lancer la recette en mode cuisine
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/recettes/${recette.attributes.slug}/classique`)}
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-200 bg-white px-5 py-3 text-base font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-ring"
                >
                  Voir la recette détaillée
                </button>
              </div>
            </div>
          ) : (
            <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-sm text-gray-500">
              {currentStepData?.temperature && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                  🔥 {currentStepData.temperature}°C
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">{renderVoiceControls(false)}</div>
          </div>

          <div
            className="relative"
            onTouchStart={handleStepTouchStart}
            onTouchEnd={handleStepTouchEnd}
          >
            {!isCompletionStep && (
              <button
                type="button"
                onClick={handlePreviousStep}
                disabled={currentStep === 0}
                className="absolute left-1 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-gray-700 shadow-sm backdrop-blur transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-30 sm:-left-3 sm:h-11 sm:w-11"
                aria-label="Étape précédente"
                title="Étape précédente"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            {!isCompletionStep && (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={currentStep === steps.length - 1}
                className="absolute right-1 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-gray-700 shadow-sm backdrop-blur transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-30 sm:-right-3 sm:h-11 sm:w-11"
                aria-label="Étape suivante"
                title="Étape suivante"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            {isCompletionStep ? (
              <div className="rounded-xl border border-orange-100 bg-orange-50/50 px-5 py-6 text-center shadow-sm sm:px-7">
                <h2 className="text-2xl font-bold text-gray-900">Bravo</h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-gray-700">
                  {currentStepData?.text || 'Vous avez terminé la recette. Belle cuisine !'}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <FavoriteButton
                    recette={{
                      id: recette.id,
                      slug: recette.attributes.slug,
                      titre: recette.attributes.titre,
                      imageUrl: recipeImageUrl || undefined,
                    }}
                    className="w-full text-sm font-bold"
                    showTextOnMobile
                    label="Ajouter aux favoris"
                    activeLabel="Dans vos favoris"
                  />

                  <button
                    type="button"
                    onClick={handleShareSuccess}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-ring"
                  >
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                    Partager cette réussite
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push('/recettes')}
                    className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-ring"
                  >
                    Voir d'autres recettes
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                  <PublishPinterestButton
                    recetteId={recette.id}
                    pinterestPinId={recette.attributes.pinterestPinId}
                  />
                </div>

                <div className="mt-6 text-left">
                  <RatingForm
                    recetteId={recette.id}
                    recetteTitle={recette.attributes.titre}
                  />
                </div>
              </div>
            ) : (
              <AnimatedCookingGuide
                guide={cookingGuide}
                stepText={currentStepData?.text || ''}
                isSpeaking={voiceState.isSpeaking}
                speakingText={voiceState.speakingText}
                speakingCharIndex={voiceState.speakingCharIndex}
                isSpeechEnabled={isSpeechEnabled}
                onSpeak={handleSpeakGuide}
              />
            )}
            {!isCompletionStep && isSwipeCoachVisible && (
              <div className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-gray-900/30 px-6 backdrop-blur-[2px] ${
                isVoiceCommandEnabled ? '' : 'sm:hidden'
              }`}>
                <div className="flex max-w-[18rem] flex-col items-center gap-3 rounded-2xl bg-white px-5 py-4 text-gray-800 shadow-xl">
                  {isVoiceCommandEnabled ? (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="flex flex-col items-center gap-2 sm:hidden">
                        <Pointer className="h-12 w-12 motion-safe:animate-[swipe-hand_2.5s_ease-in-out_2]" aria-hidden="true" />
                        <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                          Glissez
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500 sm:hidden">
                        OU
                      </span>
                      <div className="flex flex-col items-center gap-2">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                          <Mic className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            Dites "suivant"
                          </p>
                          <p className="mt-1 text-xs font-medium text-gray-500">
                            ou "précédent"
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Pointer className="h-12 w-12 motion-safe:animate-[swipe-hand_2.5s_ease-in-out_2]" aria-hidden="true" />
                      <p className="flex items-center gap-2 text-center text-sm font-semibold text-gray-800">
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        Glissez pour changer d'étape
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {!isCompletionStep && (
            <div className="mt-5 flex gap-1">
              {steps.slice(0, cookingStepCount).map((step, index) => (
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
          )}

            </>
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
