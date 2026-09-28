import * as React from 'react';
import { useCMEditViewDataManager, useFetchClient, useNotification } from '@strapi/helper-plugin';
import { Box, Button, Flex, Loader, TextInput, Textarea, Typography } from '@strapi/design-system';
import { Duplicate, Download, Refresh } from '@strapi/icons';

const RECETTE_UID = 'api::recette.recette';

/**
 * Panneau injecté dans la vue d'édition de la recette (zone editView/right-links, aux côtés
 * des infos "Informations du document"). Génère à la demande titre / intro / ingrédients / lien
 * pour Chef Simon, chaque champ avec un bouton Copier ; l'intro reste éditable avant copie.
 */
function ChefSimonKitPanel() {
  const { slug, initialData, isCreatingEntry } = useCMEditViewDataManager();
  const { get } = useFetchClient();
  const toggleNotification = useNotification();

  const [loading, setLoading] = React.useState(false);
  const [kit, setKit] = React.useState(null);
  const [intro, setIntro] = React.useState('');
  const [ingredients, setIngredients] = React.useState('');
  const [error, setError] = React.useState(null);

  const recetteId = initialData?.id;

  const fetchKit = React.useCallback(async () => {
    if (!recetteId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await get(`/chef-simon-kit/generate/${recetteId}`);
      setKit(data);
      setIntro(data.intro || '');
      setIngredients(data.ingredients || '');
      if (data.introError) {
        toggleNotification({ type: 'warning', message: data.introError });
      }
    } catch (err) {
      setError("Impossible de générer le Kit Chef Simon pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [recetteId, get, toggleNotification]);

  const copy = async (label, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toggleNotification({ type: 'success', message: `${label} copié` });
    } catch {
      toggleNotification({ type: 'warning', message: 'Copie impossible, sélectionne le texte manuellement' });
    }
  };

  // Slug ≠ nom du content-type ici : `slug` (retourné par le hook) est l'UID Strapi
  // ("api::recette.recette"), à ne pas confondre avec initialData.slug (le slug de la recette).
  if (slug !== RECETTE_UID || isCreatingEntry) {
    return null;
  }

  return (
    <Box hasRadius borderColor="neutral150" background="neutral0" padding={4} marginTop={4}>
      <Flex direction="column" alignItems="stretch" gap={3}>
        <Flex justifyContent="space-between">
          <Typography variant="sigma" textColor="neutral600">
            Kit Chef Simon
          </Typography>
          <Button
            size="S"
            variant="tertiary"
            startIcon={<Refresh />}
            onClick={fetchKit}
            loading={loading}
          >
            {kit ? 'Régénérer' : 'Générer'}
          </Button>
        </Flex>

        {error && (
          <Typography variant="pi" textColor="danger600">
            {error}
          </Typography>
        )}

        {loading && !kit && (
          <Flex justifyContent="center" padding={4}>
            <Loader small>Génération en cours…</Loader>
          </Flex>
        )}

        {kit && (
          <Flex direction="column" alignItems="stretch" gap={3}>
            <FieldWithCopy label="Titre" value={kit.titre} onCopy={copy}>
              <TextInput label="Titre" name="chef-simon-titre" value={kit.titre} disabled />
            </FieldWithCopy>

            <FieldWithCopy label="Intro" value={intro} onCopy={copy}>
              <Textarea
                label="Intro (3-4 phrases, à relire avant de copier)"
                name="chef-simon-intro"
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
              />
            </FieldWithCopy>

            <FieldWithCopy label="Ingrédients" value={ingredients} onCopy={copy}>
              <Textarea
                label="Ingrédients"
                name="chef-simon-ingredients"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
              />
            </FieldWithCopy>

            <FieldWithCopy label="Lien" value={kit.link} onCopy={copy}>
              <TextInput label="Lien (avec suivi utm_source=chefsimon)" name="chef-simon-lien" value={kit.link} disabled />
            </FieldWithCopy>

            {kit.image?.url && (
              <Button
                variant="secondary"
                startIcon={<Download />}
                as="a"
                href={kit.image.url}
                download
                target="_blank"
                rel="noreferrer"
              >
                Télécharger la photo{kit.image.width ? ` (${kit.image.width}×${kit.image.height})` : ''}
              </Button>
            )}
          </Flex>
        )}

        {!kit && !loading && !error && (
          <Typography variant="pi" textColor="neutral600">
            Génère le titre, l'intro, les ingrédients, le lien et la photo à envoyer sur Chef Simon.
          </Typography>
        )}
      </Flex>
    </Box>
  );
}

function FieldWithCopy({ label, value, onCopy, children }) {
  return (
    <Flex alignItems="flex-end" gap={2}>
      <Box flex="1">{children}</Box>
      <Button
        size="S"
        variant="tertiary"
        startIcon={<Duplicate />}
        onClick={() => onCopy(label, value)}
        disabled={!value}
      >
        Copier
      </Button>
    </Flex>
  );
}

export default ChefSimonKitPanel;
