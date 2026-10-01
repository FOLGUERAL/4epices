import * as React from 'react';
import { useCMEditViewDataManager, useFetchClient, useNotification } from '@strapi/helper-plugin';
import { Badge, Box, Button, Flex, Loader, Typography } from '@strapi/design-system';
import { Duplicate, Refresh } from '@strapi/icons';

const RECETTE_UID = 'api::recette.recette';

/**
 * Panneau injecté dans la vue d'édition de la recette (même zone editView/right-links que le
 * Kit Chef Simon). Suggère si la recette est adaptée au Thermomix et, si oui, un brouillon
 * d'étapes. Ne remplit jamais les vrais champs compatibleThermomix/etapesThermomix : l'éditeur
 * relit la suggestion puis la recopie à la main dans les champs natifs Strapi (repeatable
 * component), plus sûr que de manipuler cet état interne depuis un plugin externe.
 */
function ThermomixSuggesterPanel() {
  const { slug, initialData, isCreatingEntry } = useCMEditViewDataManager();
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
                <Typography variant="pi" fontWeight="bold">
                  Brouillon d'étapes — à relire, puis à recopier à la main dans le champ « Étapes Thermomix »
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
