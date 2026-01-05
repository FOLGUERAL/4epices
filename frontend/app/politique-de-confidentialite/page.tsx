import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité - 4épices',
  description: 'Politique de confidentialité du site 4épices.fr',
};

export default function PolitiqueConfidentialite() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-4xl font-bold text-gray-900">Politique de Confidentialité</h1>
          <p className="text-gray-600 mt-2">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-8 prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              La présente politique de confidentialité décrit la manière dont 4épices (« nous », « notre » ou « le site ») 
              collecte, utilise et protège vos informations personnelles lorsque vous utilisez notre site web accessible à 
              l'adresse <strong>https://4epices.fr</strong>.
            </p>
            <p className="text-gray-700">
              En utilisant notre site, vous acceptez les pratiques décrites dans cette politique de confidentialité.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Informations que nous collectons</h2>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">2.1. Informations collectées automatiquement</h3>
            <p className="text-gray-700 mb-4">
              Lors de votre visite sur notre site, nous collectons automatiquement certaines informations techniques, notamment :
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Votre adresse IP</li>
              <li>Le type de navigateur et la version</li>
              <li>Le système d'exploitation</li>
              <li>Les pages visitées et la durée de visite</li>
              <li>La date et l'heure de votre visite</li>
              <li>L'URL de référence (site d'origine)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3">2.2. Cookies</h3>
            <p className="text-gray-700 mb-4">
              Notre site utilise des cookies pour améliorer votre expérience de navigation. Les cookies sont de petits fichiers 
              texte stockés sur votre appareil qui nous permettent de reconnaître votre navigateur et de mémoriser certaines 
              informations.
            </p>
            <p className="text-gray-700">
              Vous pouvez désactiver les cookies dans les paramètres de votre navigateur, mais cela peut affecter certaines 
              fonctionnalités du site.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Utilisation des informations</h2>
            <p className="text-gray-700 mb-4">
              Nous utilisons les informations collectées pour :
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Fournir et améliorer nos services</li>
              <li>Analyser l'utilisation du site et comprendre comment les visiteurs interagissent avec notre contenu</li>
              <li>Assurer la sécurité et prévenir les fraudes</li>
              <li>Personnaliser votre expérience de navigation</li>
              <li>Respecter nos obligations légales</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Partage des informations</h2>
            <p className="text-gray-700 mb-4">
              Nous ne vendons, n'échangeons ni ne louons vos informations personnelles à des tiers. Nous pouvons partager 
              vos informations uniquement dans les cas suivants :
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Avec votre consentement explicite</li>
              <li>Pour respecter une obligation légale ou une ordonnance judiciaire</li>
              <li>Avec nos prestataires de services de confiance qui nous aident à exploiter notre site (sous réserve de 
                leur engagement à protéger vos informations)</li>
              <li>En cas de fusion, acquisition ou vente d'actifs (avec notification préalable)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Intégration avec Pinterest</h2>
            <p className="text-gray-700 mb-4">
              Notre site peut partager du contenu sur Pinterest. En utilisant les fonctionnalités Pinterest de notre site, 
              vous acceptez également la politique de confidentialité de Pinterest. Nous vous encourageons à consulter la 
              <a href="https://policy.pinterest.com/fr/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                politique de confidentialité de Pinterest
              </a> pour plus d'informations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Sécurité des données</h2>
            <p className="text-gray-700 mb-4">
              Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos 
              informations personnelles contre l'accès non autorisé, la perte, la destruction ou la modification. Cependant, 
              aucune méthode de transmission sur Internet ou de stockage électronique n'est totalement sécurisée.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Vos droits</h2>
            <p className="text-gray-700 mb-4">
              Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>Droit d'accès</strong> : Vous pouvez demander une copie de vos données personnelles</li>
              <li><strong>Droit de rectification</strong> : Vous pouvez demander la correction de données inexactes</li>
              <li><strong>Droit à l'effacement</strong> : Vous pouvez demander la suppression de vos données</li>
              <li><strong>Droit à la limitation</strong> : Vous pouvez demander la limitation du traitement de vos données</li>
              <li><strong>Droit à la portabilité</strong> : Vous pouvez demander le transfert de vos données</li>
              <li><strong>Droit d'opposition</strong> : Vous pouvez vous opposer au traitement de vos données</li>
            </ul>
            <p className="text-gray-700">
              Pour exercer ces droits, veuillez nous contacter à l'adresse indiquée dans la section « Contact ».
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Conservation des données</h2>
            <p className="text-gray-700 mb-4">
              Nous conservons vos informations personnelles uniquement aussi longtemps que nécessaire pour les finalités 
              décrites dans cette politique, sauf si une période de conservation plus longue est requise ou autorisée par la loi.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Modifications de cette politique</h2>
            <p className="text-gray-700 mb-4">
              Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment. Toute modification 
              sera publiée sur cette page avec une mise à jour de la date de « Dernière mise à jour ». Nous vous encourageons 
              à consulter régulièrement cette page pour rester informé de nos pratiques.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Contact</h2>
            <p className="text-gray-700 mb-4">
              Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits, vous pouvez 
              nous contacter :
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 mb-2">
                <strong>Email</strong> : <a href="mailto:contact@4epices.fr" className="text-blue-600 hover:underline">contact@4epices.fr</a>
              </p>
              <p className="text-gray-700">
                <strong>Site web</strong> : <a href="https://4epices.fr" className="text-blue-600 hover:underline">https://4epices.fr</a>
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Loi applicable</h2>
            <p className="text-gray-700">
              Cette politique de confidentialité est régie par la loi française. Tout litige relatif à cette politique 
              sera soumis à la juridiction exclusive des tribunaux français.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}


