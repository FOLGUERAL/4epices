'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/Toast';

export default function CreerRecettePage() {
  const router = useRouter();
  
  // État pour la dictée vocale
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastProcessedIndexRef = useRef<number>(0);
  const processedResultsRef = useRef<Set<string>>(new Set());
  
  // État pour l'image
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // État pour l'envoi
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialiser la reconnaissance vocale
  useEffect(() => {
    // Vérifier la compatibilité du navigateur
    if (typeof window === 'undefined') return;

    const SpeechRecognition = 
      window.SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API non supportée sur ce navigateur');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      const newFinalParts: string[] = [];

      // Traiter uniquement les nouveaux résultats depuis resultIndex
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        
        if (result.isFinal && transcript) {
          // Créer une clé unique pour ce résultat (index + texte)
          const resultKey = `${i}-${transcript.toLowerCase()}`;
          
          // Ne traiter que si on ne l'a pas déjà vu
          if (!processedResultsRef.current.has(resultKey)) {
            processedResultsRef.current.add(resultKey);
            newFinalParts.push(transcript);
          }
        } else if (transcript) {
          // Pour les résultats intermédiaires, prendre seulement le dernier
          interim = transcript;
        }
      }

      // Ajouter seulement les nouveaux résultats finaux en évitant les répétitions
      if (newFinalParts.length > 0) {
        const newFinal = newFinalParts.join(' ').trim();
        
        if (newFinal) {
          setTranscript((prev) => {
            const prevText = prev.trim();
            const newText = newFinal;
            
            // Si pas de texte précédent, ajouter directement
            if (!prevText) {
              return newText + ' ';
            }
            
            // Normaliser les textes pour comparaison (minuscules, sans ponctuation)
            const normalize = (text: string) => 
              text.toLowerCase().replace(/[.,!?;:]/g, '').trim();
            
            const prevNormalized = normalize(prevText);
            const newNormalized = normalize(newText);
            
            // Si le nouveau texte est déjà complètement contenu dans le précédent, ignorer
            if (prevNormalized.includes(newNormalized) && newNormalized.length > 5) {
              return prev;
            }
            
            // Diviser en mots
            const prevWords = prevText.split(/\s+/).filter(w => w.length > 0);
            const newWords = newText.split(/\s+/).filter(w => w.length > 0);
            
            if (newWords.length === 0) return prev;
            
            // Vérifier les répétitions de séquences de mots
            // Comparer les 2-4 derniers mots du texte précédent avec les 2-4 premiers du nouveau
            for (let seqLen = 4; seqLen >= 2; seqLen--) {
              if (prevWords.length >= seqLen && newWords.length >= seqLen) {
                const lastSeq = prevWords.slice(-seqLen).join(' ').toLowerCase();
                const firstSeq = newWords.slice(0, seqLen).join(' ').toLowerCase();
                
                if (lastSeq === firstSeq) {
                  // Répétition détectée, ne prendre que les mots après la séquence
                  const remaining = newWords.slice(seqLen);
                  if (remaining.length > 0) {
                    return prev + ' ' + remaining.join(' ') + ' ';
                  }
                  return prev;
                }
              }
            }
            
            // Vérifier les répétitions de mots individuels consécutifs
            // Si les 2-3 derniers mots sont identiques aux 2-3 premiers, c'est une répétition
            if (prevWords.length >= 2 && newWords.length >= 2) {
              const lastTwo = prevWords.slice(-2).map(w => w.toLowerCase());
              const firstTwo = newWords.slice(0, 2).map(w => w.toLowerCase());
              
              if (lastTwo[0] === firstTwo[0] && lastTwo[1] === firstTwo[1]) {
                // Les 2 premiers mots sont identiques aux 2 derniers, sauter les 2 premiers
                const remaining = newWords.slice(2);
                if (remaining.length > 0) {
                  return prev + ' ' + remaining.join(' ') + ' ';
                }
                return prev;
              }
              
              // Vérifier si le dernier mot est répété au début
              if (prevWords.length > 0 && newWords.length > 0) {
                const lastWord = prevWords[prevWords.length - 1].toLowerCase();
                const firstWord = newWords[0].toLowerCase();
                
                if (lastWord === firstWord) {
                  // Le premier mot est identique au dernier, le sauter
                  const remaining = newWords.slice(1);
                  if (remaining.length > 0) {
                    return prev + ' ' + remaining.join(' ') + ' ';
                  }
                  return prev;
                }
              }
            }
            
            // Vérifier si le nouveau texte commence par des mots déjà présents à la fin
            // Comparer les 5 derniers mots avec les 5 premiers
            if (prevWords.length >= 5 && newWords.length >= 5) {
              const lastFive = prevWords.slice(-5).map(w => w.toLowerCase());
              const firstFive = newWords.slice(0, 5).map(w => w.toLowerCase());
              
              // Compter les correspondances
              const matches = firstFive.filter((word, idx) => 
                lastFive.includes(word) || word === lastFive[idx]
              );
              
              // Si 4 mots ou plus correspondent, c'est probablement une répétition
              if (matches.length >= 4) {
                // Prendre seulement les mots vraiment nouveaux
                const newUniqueWords = newWords.filter(word => 
                  !lastFive.includes(word.toLowerCase())
                );
                if (newUniqueWords.length > 0) {
                  return prev + ' ' + newUniqueWords.join(' ') + ' ';
                }
                return prev;
              }
            }
            
            // Aucune répétition détectée, ajouter le nouveau texte
            return prev + ' ' + newText + ' ';
          });
        }
      }
      
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Erreur de reconnaissance vocale:', event.error);
      setIsListening(false);
      
      if (event.error === 'no-speech') {
        toast.error('Aucune parole détectée');
      } else if (event.error === 'not-allowed') {
        toast.error('Permission microphone refusée');
      } else {
        toast.error(`Erreur: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Démarrer/arrêter la dictée
  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Reconnaissance vocale non disponible');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Erreur au démarrage:', error);
        toast.error('Impossible de démarrer la dictée');
      }
    }
  };

  // Gérer la sélection d'image
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    // Vérifier la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 10MB)');
      return;
    }

    setSelectedImage(file);

    // Créer un aperçu
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Réinitialiser l'image
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    // Réinitialiser les inputs file
    const inputCamera = document.getElementById('image-input-camera') as HTMLInputElement;
    const inputGallery = document.getElementById('image-input-gallery') as HTMLInputElement;
    if (inputCamera) inputCamera.value = '';
    if (inputGallery) inputGallery.value = '';
  };

  // Réinitialiser la dictée
  const handleClearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
    lastProcessedIndexRef.current = 0;
    processedResultsRef.current.clear();
  };

  // Envoyer la recette
  const handleSubmit = async () => {
    // Vérifications
    if (!transcript.trim() && !selectedImage) {
      toast.error('Veuillez dicter une recette ou ajouter une photo');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('text', transcript.trim());
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      const response = await fetch('/api/recipe/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erreur inconnue' }));
        throw new Error(error.message || `Erreur ${response.status}`);
      }

      const result = await response.json();
      
      toast.success('Recette créée avec succès !');
      
      // Réinitialiser le formulaire
      setTranscript('');
      setInterimTranscript('');
      setSelectedImage(null);
      setImagePreview(null);
      const inputCamera = document.getElementById('image-input-camera') as HTMLInputElement;
      const inputGallery = document.getElementById('image-input-gallery') as HTMLInputElement;
      if (inputCamera) inputCamera.value = '';
      if (inputGallery) inputGallery.value = '';

      // Rediriger vers la recette créée si un slug est retourné
      if (result.slug) {
        setTimeout(() => {
          router.push(`/recettes/${result.slug}`);
        }, 1500);
      }
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la création de la recette');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* En-tête */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Créer une recette
          </h1>
          <p className="text-gray-600 text-sm">
            Dictez votre recette ou prenez une photo
          </p>
        </div>

        {/* Bouton Dictée */}
        <div className="mb-6">
          <button
            onClick={toggleListening}
            disabled={isSubmitting}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
              isListening
                ? 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
                : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
            } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
          >
            {isListening ? (
              <>
                <span className="inline-block w-3 h-3 bg-white rounded-full mr-2 animate-pulse"></span>
                🎙️ Arrêter la dictée
              </>
            ) : (
              '🎙️ Dicter la recette'
            )}
          </button>
        </div>

        {/* Boutons Photo */}
        <div className="mb-6 space-y-3">
          <label
            htmlFor="image-input-camera"
            className={`block w-full py-4 px-6 rounded-xl font-semibold text-lg text-center cursor-pointer transition-all ${
              selectedImage
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            } active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {selectedImage ? '📸 Changer la photo' : '📸 Prendre une photo'}
          </label>
          <input
            id="image-input-camera"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            disabled={isSubmitting}
            className="hidden"
          />
          
          <label
            htmlFor="image-input-gallery"
            className="block w-full py-4 px-6 rounded-xl font-semibold text-lg text-center cursor-pointer transition-all bg-purple-500 text-white hover:bg-purple-600 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🖼️ Choisir depuis la galerie
          </label>
          <input
            id="image-input-gallery"
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            disabled={isSubmitting}
            className="hidden"
          />
        </div>

        {/* Aperçu de l'image */}
        {imagePreview && (
          <div className="mb-6 relative">
            <div className="relative rounded-xl overflow-hidden shadow-lg">
              <img
                src={imagePreview}
                alt="Aperçu"
                className="w-full h-auto max-h-64 object-cover"
              />
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors"
                aria-label="Supprimer l'image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Aperçu recette brute */}
        <div className="mb-6">
          <div className="bg-white rounded-xl p-4 shadow-lg min-h-[200px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Aperçu recette brute
              </h2>
              {transcript && (
                <button
                  onClick={handleClearTranscript}
                  className="text-sm text-red-500 hover:text-red-600 font-medium"
                >
                  Effacer
                </button>
              )}
            </div>
            <div className="text-gray-700 whitespace-pre-wrap break-words">
              {transcript}
              {interimTranscript && (
                <span className="text-gray-400 italic">{interimTranscript}</span>
              )}
              {!transcript && !interimTranscript && (
                <p className="text-gray-400 italic">
                  Le texte dicté apparaîtra ici...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bouton Créer */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || (!transcript.trim() && !selectedImage)}
          className={`w-full py-4 px-6 rounded-xl font-semibold text-lg text-white transition-all shadow-lg ${
            isSubmitting || (!transcript.trim() && !selectedImage)
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 active:scale-95'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Création en cours...
            </span>
          ) : (
            '🚀 Créer la recette'
          )}
        </button>

        {/* Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>💡 Astuce : Vous pouvez dicter et prendre une photo</p>
        </div>
      </div>
    </div>
  );
}

