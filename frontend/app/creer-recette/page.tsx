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
  
  // État pour Google Speech API (alternative)
  const [useGoogleSpeech, setUseGoogleSpeech] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
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
            
            // Normaliser les textes pour comparaison (minuscules, sans ponctuation, sans accents)
            const normalize = (text: string) => 
              text
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
                .replace(/[.,!?;:]/g, '')
                .trim();
            
            const prevNormalized = normalize(prevText);
            const newNormalized = normalize(newText);
            
            // Si le nouveau texte est déjà complètement contenu dans le précédent, ignorer
            if (prevNormalized.includes(newNormalized) && newNormalized.length > 3) {
              return prev;
            }
            
            // Diviser en mots et normaliser
            const prevWords = prevText.split(/\s+/).filter(w => w.length > 0);
            const newWords = newText.split(/\s+/).filter(w => w.length > 0);
            
            if (newWords.length === 0) return prev;
            
            // APPROCHE AGRESSIVE : Comparer chaque nouveau mot avec les derniers mots
            // Ne garder que les mots qui ne sont pas déjà présents dans les 10 derniers mots
            const lastWords = prevWords.slice(-10).map(w => normalize(w));
            const uniqueNewWords: string[] = [];
            
            for (let i = 0; i < newWords.length; i++) {
              const word = newWords[i];
              const normalizedWord = normalize(word);
              
              // Vérifier si ce mot est déjà dans les derniers mots
              const isDuplicate = lastWords.includes(normalizedWord);
              
              // Vérifier aussi si c'est une répétition consécutive du mot précédent
              const isConsecutiveRepeat = i > 0 && normalize(newWords[i - 1]) === normalizedWord;
              
              // Vérifier si c'est identique au dernier mot du texte précédent
              const isLastWordRepeat = prevWords.length > 0 && 
                normalize(prevWords[prevWords.length - 1]) === normalizedWord;
              
              if (!isDuplicate && !isConsecutiveRepeat && !isLastWordRepeat) {
                uniqueNewWords.push(word);
              } else if (i === 0 && isLastWordRepeat) {
                // Si le premier mot est une répétition du dernier, on le saute mais on continue
                continue;
              }
            }
            
            // Si on a trouvé des mots uniques, les ajouter
            if (uniqueNewWords.length > 0) {
              return prev + ' ' + uniqueNewWords.join(' ') + ' ';
            }
            
            // Si aucun mot unique, vérifier s'il y a vraiment du nouveau contenu
            // en comparant des séquences plus longues
            if (newWords.length >= 3) {
              const lastThree = prevWords.slice(-3).map(w => normalize(w)).join(' ');
              const firstThree = newWords.slice(0, 3).map(w => normalize(w)).join(' ');
              
              if (lastThree !== firstThree) {
                // Les 3 premiers mots sont différents, prendre tout
                return prev + ' ' + newText + ' ';
              }
            }
            
            // Aucun nouveau contenu détecté
            return prev;
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

  // Démarrer/arrêter la dictée avec Google Speech API
  const toggleListeningGoogle = async () => {
    if (isListening) {
      // Arrêter l'enregistrement
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      // Demander l'accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Créer un MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Arrêter le stream
        stream.getTracks().forEach(track => track.stop());
        
        // Créer un blob et envoyer à l'API
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          
          const response = await fetch('/api/speech/transcribe', {
            method: 'POST',
            body: formData,
          });
          
          const result = await response.json();
          
          if (result.success && result.transcript) {
            setTranscript((prev) => {
              const newText = result.transcript.trim();
              if (!prev.trim()) {
                return newText + ' ';
              }
              // Ajouter avec un espace si ce n'est pas une répétition
              const prevWords = prev.trim().split(/\s+/);
              const newWords = newText.split(/\s+/);
              
              // Vérifier si les 3 derniers mots sont identiques aux 3 premiers
              if (prevWords.length >= 3 && newWords.length >= 3) {
                const lastThree = prevWords.slice(-3).join(' ').toLowerCase();
                const firstThree = newWords.slice(0, 3).join(' ').toLowerCase();
                if (lastThree === firstThree) {
                  return prev + ' ' + newWords.slice(3).join(' ') + ' ';
                }
              }
              
              return prev + ' ' + newText + ' ';
            });
            toast.success('Transcription ajoutée');
          } else {
            toast.error(result.message || 'Aucune transcription disponible');
          }
        } catch (error) {
          console.error('Erreur lors de la transcription:', error);
          toast.error('Erreur lors de la transcription');
        }
        
        audioChunksRef.current = [];
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
      toast.info('Enregistrement en cours...');
    } catch (error) {
      console.error('Erreur au démarrage:', error);
      toast.error('Impossible d\'accéder au microphone');
      setIsListening(false);
    }
  };

  // Démarrer/arrêter la dictée avec Web Speech API (native)
  const toggleListeningNative = () => {
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

  // Toggle général qui choisit l'API
  const toggleListening = () => {
    if (useGoogleSpeech) {
      toggleListeningGoogle();
    } else {
      toggleListeningNative();
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

        {/* Sélecteur d'API */}
        <div className="mb-4">
          <div className="bg-white rounded-xl p-3 shadow-md">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-gray-700">
                Utiliser Google Speech (plus précis)
              </span>
              <input
                type="checkbox"
                checked={useGoogleSpeech}
                onChange={(e) => setUseGoogleSpeech(e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>
            {useGoogleSpeech && (
              <p className="text-xs text-gray-500 mt-2">
                ⚠️ Nécessite une clé API Google (60 min gratuites/mois)
              </p>
            )}
          </div>
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

