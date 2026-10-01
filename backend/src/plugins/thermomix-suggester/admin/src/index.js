import pluginId from './pluginId';
import ThermomixSuggesterPanel from './components/ThermomixSuggesterPanel';

export default {
  register(app) {
    // Pas de menu ni de page de réglages : le plugin n'existe que via son injection ci-dessous.
  },
  bootstrap(app) {
    app.injectContentManagerComponent('editView', 'right-links', {
      name: `${pluginId}-panel`,
      Component: ThermomixSuggesterPanel,
    });
  },
};
