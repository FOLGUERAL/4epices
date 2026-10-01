import * as React from 'react';
import { useCMEditViewDataManager, useFetchClient, useNotification } from '@strapi/helper-plugin';
import { Badge, Box, Button, Flex, Loader, Typography } from '@strapi/design-system';
import { Duplicate, Refresh, CheckCircle } from '@strapi/icons';

const RECETTE_UID = 'api::recette.recette';
const COMPONENT_UID = 'recette.etape-thermomix';

/**
 * Panneau injecté dans la vue d'édition de la recette (même zone editView/right-links que le
 * Kit Chef Simon). Suggère si la recette est adaptée au Thermomix et, si oui, un brouillon
 * d'étapes, avec un bouton « Appliquer » qui écrit directement dans compatibleThermomix et
 * etapesThermomix via les fonctions internes de gestion d'état de l'admin Strapi (pas une API
 * publique documentée — en cas d'échec, le bouton Copier reste disponible en secours). Le
 * résultat reste un brouillon dans le formulaire ouvert : rien n'est publié tant que l'éditeur
 * n'a pas lui-même sauvegardé/publié la recette.
 */
function ThermomixSuggesterPanel() {
  const { slug, initialData, isCreatingEntry, modifiedData, allLayoutData, onChange, addRepeatableComponentToField, removeRepeatableField } =
    useCMEditViewDataManager();
  const { get } = useFetchClient();
  const toggleNotification = useNotification();

  const [loading, setLoading] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState(null);
  const [error, setError] = React.useState(null);

  const recetteId = initialData?.id;

  const fetchSuggestion = React.useCallback(async () => {
    if (!recetteId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await get(`/thermomix-suggester/suggest/${recetteId}`);
      setSuggestion(data);
    } catch (err) {
      setError('Impossible de générer la suggestion Thermomix pour l\'instant.');
    } finally {
      setLoading(false);
    }
  }, [recetteId, get]);

  const [applying, setApplying] = React.useState(false);

  /**
   * Écrit la suggestion dans le formulaire ouvert : vide d'abord etapesThermomix, coche
   * compatibleThermomix, puis ajoute une ligne de composant par étape et remplit ses champs.
   * Repose sur des fonctions internes non documentées de l'admin Strapi : en cas d'échec,
   * on prévient l'utilisateur et il reste le bouton Copier par étape en dessous.
   */
  const applySuggestion = () => {
    if (!suggestion?.compatible || !suggestion.etapes?.length) return;
    setApplying(true);
    try {
      const componentLayoutData = allLayoutData?.components?.[COMPONENT_UID];
      const allComponents = allLayoutData?.components;
      if (!componentLayoutData || !allComponents) {
        throw new Error('Mise en page du composant introuvable');
      }

      // Vider les étapes existantes (l'index 0 se décale à chaque suppression)
      const currentLength = modifiedData?.etapesThermomix?.length || 0;
      for (let i = 0; i < currentLength; i += 1) {
        removeRepeatableField('etapesThermomix.0');
      }

      onChange({ target: { name: 'compatibleThermomix', type: 'boolean', value: true } });

      suggestion.etapes.forEach(() => {
        addRepeatableComponentToField('etapesThermomix', componentLayoutData, allComponents, false);
      });

      suggestion.etapes.forEach((etape, i) => {
        onChange({ target: { name: `etapesThermomix.${i}.description`, type: 'text', value: etape.description } });
        onChange({ target: { name: `etapesThermomix.${i}.vitesse`, type: 'string', value: etape.vitesse } });
        onChange({ target: { name: `etapesThermomix.${i}.duree`, type: 'string', value: etape.duree } });
        onChange({ target: { name: `etapesThermomix.${i}.temperature`, type: 'string', value: etape.temperature } });
        if (etape.sens) {
          onChange({ target: { name: `etapesThermomix.${i}.sens`, type: 'enumeration', value: etape.sens } });
        }
      });

      toggleNotification({
        type: 'success',
        message: `${suggestion.etapes.length} étape(s) appliquée(s) — relis-les puis enregistre/publie la recette.`,
      });
    } catch (err) {
      toggleNotification({
        type: 'warning',
        message: "Le remplissage automatique a échoué, utilise les boutons Copier ci-dessous.",
      });
    } finally {
      setApplying(false);
    }
  };

  const copyRow = async (etape) => {
    const line = [
      etape.description,
      etape.vitesse && `Vitesse ${etape.vitesse}`,
      etape.duree,
      etape.temperature,
      etape.sens && `Sens ${etape.sens}`,
    ]
      .filter(Boolean)
      .join(' | ');
    try {
      await navigator.clipboard.writeText(line);
      toggleNotification({ type: 'success', message: 'Étape copiée' });
    } catch {
      toggleNotification({ type: 'warning', message: 'Copie impossible, sélectionne le texte manuellement' });
    }
  };

  if (slug !== RECETTE_UID || isCreatingEntry) {
    return null;
  }

  return (
    <Box hasRadius borderColor="neutral150" background="neutral0" padding={4} marginTop={4}>
      <Flex direction="column" alignItems="stretch" gap={3}>
        <Flex justifyContent="space-between">
          <Typography variant="sigma" textColor="neutral600">
            Suggestion Thermomix
          </Typography>
          <Button size="S" variant="tertiary" startIcon={<Refresh />} onClick={fetchSuggestion} loading={loading}>
            {suggestion ? 'Régénérer' : 'Suggérer'}
          </Button>
        </Flex>

        {error && (
          <Typography variant="pi" textColor="danger600">
            {error}
          </Typography>
        )}

        {loading && !suggestion && (
          <Flex justifyContent="center" padding={4}>
            <Loader small>Analyse en cours…</Loader>
          </Flex>
        )}

        {suggestion && (
          <Flex direction="column" alignItems="stretch" gap={3}>
            <Flex gap={2} alignItems="center">
              <Badge backgroundColor={suggestion.compatible ? 'success100' : 'neutral150'} textColor={suggestion.compatible ? 'success700' : 'neutral600'}>
                {suggestion.compatible ? 'Adaptée au Thermomix' : 'Pas adaptée'}
              </Badge>
            </Flex>

            {suggestion.raison && (
              <Typography variant="pi" textColor="neutral600">
                {suggestion.raison}
              </Typography>
            )}

            {suggestion.compatible && suggestion.etapes?.length > 0 && (
              <Flex direction="column" alignItems="stretch" gap={2}>
                <Flex justifyContent="space-between" alignItems="center">
                  <Typography variant="pi" fontWeight="bold">
                    Brouillon d'étapes
                  </Typography>
                  <Button size="S" startIcon={<CheckCircle />} onClick={applySuggestion} loading={applying}>
                    Appliquer dans la recette
                  </Button>
                </Flex>
                <Typography variant="pi" textColor="neutral600">
                  Remplace les étapes Thermomix actuelles du formulaire. Relis-les avant d'enregistrer/publier —
                  rien n'est encore sauvegardé.
                </Typography>
                {suggestion.etapes.map((etape, i) => (
                  <Flex key={i} alignItems="flex-start" gap={2} background="neutral100" padding={2} hasRadius>
                    <Box flex="1">
                      <Typography variant="pi" fontWeight="bold">
                        {i + 1}. {etape.description}
                      </Typography>
                      <Typography variant="pi" textColor="neutral600" as="p">
                        {[
                          etape.vitesse && `Vitesse ${etape.vitesse}`,
                          etape.duree,
                          etape.temperature,
                          etape.sens && `Sens ${etape.sens}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                    </Box>
                    <Button size="S" variant="tertiary" startIcon={<Duplicate />} onClick={() => copyRow(etape)}>
                      Copier
                    </Button>
                  </Flex>
                ))}
              </Flex>
            )}
          </Flex>
        )}

        {!suggestion && !loading && !error && (
          <Typography variant="pi" textColor="neutral600">
            Demande à l'IA si cette recette se prête à une préparation au Thermomix, avec un
            brouillon d'étapes si c'est le cas.
          </Typography>
        )}
      </Flex>
    </Box>
  );
}

export default ThermomixSuggesterPanel;
