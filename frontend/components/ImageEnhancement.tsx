'use client';

import { useState, useRef } from 'react';
import { toast } from './Toast';

export default function ImageEnhancement() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{
    analysis?: string;
    enhancement_prompt?: string;
    suggestions?: string[];
    enhanced_image_url?: string;
    enhanced?: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner un fichier image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux (max 10MB)');
      return;
    }

    setSelectedImage(file);
    setResults(null);

    // Créer un aperçu
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleEnhanceWithOptions = async (formData: FormData) => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setResults(null);

    try {
      const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
      
      console.log('[ImageEnhancement] Envoi de la requête:', {
        url: `${strapiUrl}/api/image-enhancement/enhance`,
        fileName: selectedImage.name,
        fileSize: selectedImage.size,
        fileType: selectedImage.type,
      });

      const response = await fetch(`${strapiUrl}/api/image-enhancement/enhance`, {
        method: 'POST',
        body: formData,
        // Ne pas définir Content-Type manuellement, le navigateur le fera automatiquement avec le boundary
      });

      if (!response.ok) {
        let errorMessage = `Erreur ${response.status}`;
        try {
          const error = await response.json();
          errorMessage = error.message || error.error?.message || errorMessage;
          console.error('[ImageEnhancement] Erreur détaillée:', error);
        } catch (e) {
          const errorText = await response.text().catch(() => 'Erreur inconnue');
          errorMessage = errorText || errorMessage;
          console.error('[ImageEnhancement] Erreur (texte):', errorText);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        setResults({
          analysis: data.analysis,
          enhancement_prompt: data.enhancement_prompt,
          suggestions: data.suggestions,
          enhanced_image_url: data.enhanced_image_url,
          enhanced: data.enhanced,
        });
        if (data.enhanced) {
          toast.success('Image améliorée générée avec succès !');
        } else {
          toast.success('Image analysée avec succès !');
        }
      } else {
        throw new Error(data.message || 'Erreur lors du traitement');
      }
    } catch (error) {
      console.error('Erreur retouche image:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la retouche de l\'image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnhance = async () => {
    if (!selectedImage) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedImage as File);
    formData.append('generateEnhanced', 'true');
    
    await handleEnhanceWithOptions(formData);
  };

  const handleReset = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Zone d'upload */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedImage && fileInputRef.current?.click()}
        className={`border-3 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          selectedImage
            ? 'border-gray-300 bg-gray-50'
            : isDragging
            ? 'border-purple-500 bg-purple-200 scale-105'
            : 'border-purple-400 bg-purple-50 hover:border-purple-500 hover:bg-purple-100'
        }`}
      >
        {!imagePreview ? (
          <>
            <div className="text-6xl mb-4">📸</div>
            <div className="text-xl font-semibold text-purple-600 mb-2">
              Cliquez ou glissez-déposez une image
            </div>
            <div className="text-sm text-gray-500">
              Formats supportés: JPG, PNG, WebP (max 10MB)
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </>
        ) : (
          <div className="space-y-4">
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Aperçu"
                className="max-w-full max-h-64 rounded-lg shadow-lg"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors"
                aria-label="Supprimer l'image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex gap-3 justify-center">
              <div className="flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!selectedImage) return;
                    const formData = new FormData();
                    formData.append('file', selectedImage as File);
                    formData.append('generateEnhanced', 'false');
                    handleEnhanceWithOptions(formData);
                  }}
                  disabled={isProcessing || !selectedImage}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyse...
                    </span>
                  ) : (
                    '📊 Analyser seulement'
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEnhance();
                  }}
                  disabled={isProcessing || !selectedImage}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Génération...
                    </span>
                  ) : (
                    '✨ Générer Image Améliorée'
                  )}
                </button>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
              >
                🔄 Changer l'image
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Résultats */}
      {results && (
        <div className="space-y-4">
          {/* Analyse */}
          {results.analysis && (
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                📊 Analyse de l'Image
              </h3>
              <p className="text-gray-700 leading-relaxed">{results.analysis}</p>
            </div>
          )}

          {/* Suggestions */}
          {results.suggestions && results.suggestions.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                💡 Suggestions d'Amélioration
              </h3>
              <ul className="space-y-2">
                {results.suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded text-gray-700"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prompt d'amélioration */}
          {results.enhancement_prompt && (
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                🎯 Prompt d'Amélioration
              </h3>
              <p className="text-gray-700 italic leading-relaxed">{results.enhancement_prompt}</p>
            </div>
          )}

          {/* Image améliorée */}
          {results.enhanced_image_url && (
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                ✨ Image Améliorée
              </h3>
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border-2 border-purple-200">
                  <img
                    src={results.enhanced_image_url}
                    alt="Image améliorée"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>
                <div className="flex gap-3">
                  <a
                    href={results.enhanced_image_url}
                    download="image-amelioree.png"
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors inline-block"
                  >
                    💾 Télécharger l'image améliorée
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">💡 Comment ça fonctionne ?</p>
        <p className="mb-2">
          Groq Vision analyse votre image culinaire et génère des suggestions pour la rendre plus attrayante.
          Les suggestions incluent des améliorations d'éclairage, de couleurs, de composition et d'optimisation pour les réseaux sociaux.
        </p>
        <p className="font-semibold mt-3 mb-1">💰 Coûts :</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>📊 Analyser seulement</strong> : ✅ 100% gratuit (Groq Vision)</li>
          <li><strong>✨ Générer Image Améliorée</strong> : 
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>✅ Gratuit avec Hugging Face (recommandé)</li>
              <li>⚠️ Payant avec Replicate (~$0.002-0.01/image)</li>
            </ul>
          </li>
        </ul>
        <p className="mt-2 text-xs italic">
          💡 Astuce : Configurez HUGGINGFACE_API_TOKEN pour générer des images améliorées gratuitement !
        </p>
      </div>
    </div>
  );
}
