#!/usr/bin/env node
/**
 * Injecte des recettes "Bases de cuisine" en brouillon, sans image principale.
 *
 * Usage depuis backend/ :
 *   node scripts/seed-bases-recettes-strapi.js --dry-run
 *   node scripts/seed-bases-recettes-strapi.js
 *
 * Les recettes sont volontairement creees en brouillon afin d'ajouter les photos
 * dans l'admin Strapi avant publication.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..');
const RECETTE_UID = 'api::recette.recette';
const CATEGORIE_UID = 'api::categorie.categorie';
const TAG_UID = 'api::tag.tag';

const CATEGORY = {
  nom: 'Bases de cuisine',
  slug: 'bases-de-cuisine',
  description:
    'Les preparations indispensables a connaitre : sauces, pates, pains, accompagnements et bases maison pour cuisiner plus facilement.',
};

const TAGS = [
  { nom: 'base de cuisine', slug: 'base-de-cuisine' },
  { nom: 'fait maison', slug: 'fait-maison' },
  { nom: 'recette facile', slug: 'recette-facile' },
  { nom: 'sauce', slug: 'sauce' },
  { nom: 'pate maison', slug: 'pate-maison' },
  { nom: 'pain maison', slug: 'pain-maison' },
];

const RECIPES = [
  {
    titre: 'Bechamel maison',
    slug: 'bechamel-maison',
    description: 'Une sauce bechamel simple, lisse et onctueuse pour gratins, lasagnes, croque-monsieur et legumes au four.',
    tempsPreparation: 5,
    tempsCuisson: 10,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'recette facile', 'sauce'],
    ingredients: [
      { quantite: '50 g', ingredient: 'beurre' },
      { quantite: '50 g', ingredient: 'farine' },
      { quantite: '50 cl', ingredient: 'lait' },
      { quantite: '1 pincee', ingredient: 'noix de muscade' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Faites fondre le beurre dans une casserole a feu moyen sans le laisser colorer.',
      'Ajoutez la farine en une fois et melangez pendant 1 minute pour former un roux.',
      'Versez le lait progressivement en fouettant pour eviter les grumeaux.',
      'Laissez epaissir 5 a 8 minutes en remuant regulierement.',
      'Assaisonnez avec le sel, le poivre et la noix de muscade.',
    ],
  },
  {
    titre: 'Pate a pizza maison',
    slug: 'pate-a-pizza-maison',
    description: 'Une pate a pizza moelleuse et facile a etaler, parfaite pour une pizza maison croustillante sur les bords.',
    tempsPreparation: 20,
    tempsCuisson: 0,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'pate maison'],
    ingredients: [
      { quantite: '500 g', ingredient: 'farine' },
      { quantite: '30 cl', ingredient: 'eau tiede' },
      { quantite: '7 g', ingredient: 'levure boulangere seche' },
      { quantite: '2 c. a soupe', ingredient: 'huile d olive' },
      { quantite: '1 c. a cafe', ingredient: 'sel' },
    ],
    etapes: [
      'Melangez la levure avec l eau tiede et laissez reposer 5 minutes.',
      'Versez la farine et le sel dans un saladier, puis ajoutez l eau avec la levure.',
      'Ajoutez l huile d olive et petrissez 8 a 10 minutes jusqu a obtenir une pate souple.',
      'Couvrez et laissez lever environ 1 heure dans un endroit tiede.',
      'Degazez la pate, divisez-la si besoin et etalez-la avant de garnir.',
    ],
  },
  {
    titre: 'Pain pita maison',
    slug: 'pain-pita-maison',
    description: 'Des pains pita moelleux qui gonflent a la cuisson, parfaits pour sandwichs, mezzes et assiettes composees.',
    tempsPreparation: 20,
    tempsCuisson: 10,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison', 'pain maison'],
    ingredients: [
      { quantite: '400 g', ingredient: 'farine' },
      { quantite: '24 cl', ingredient: 'eau tiede' },
      { quantite: '7 g', ingredient: 'levure boulangere seche' },
      { quantite: '1 c. a soupe', ingredient: 'huile d olive' },
      { quantite: '1 c. a cafe', ingredient: 'sel' },
    ],
    etapes: [
      'Melangez l eau tiede avec la levure et laissez reposer 5 minutes.',
      'Ajoutez la farine, le sel et l huile puis petrissez jusqu a obtenir une pate lisse.',
      'Couvrez et laissez lever 1 heure.',
      'Divisez la pate en 6 boules, puis etalez chaque boule en disque.',
      'Cuisez les pains dans une poele bien chaude 1 a 2 minutes par face.',
    ],
  },
  {
    titre: 'Mayonnaise maison',
    slug: 'mayonnaise-maison',
    description: 'Une mayonnaise maison ferme et savoureuse, prete en quelques minutes avec des ingredients simples.',
    tempsPreparation: 10,
    tempsCuisson: 0,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'recette facile', 'sauce'],
    ingredients: [
      { quantite: '1', ingredient: 'jaune d oeuf' },
      { quantite: '1 c. a cafe', ingredient: 'moutarde' },
      { quantite: '20 cl', ingredient: 'huile neutre' },
      { quantite: '1 c. a cafe', ingredient: 'vinaigre ou jus de citron' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Placez le jaune d oeuf, la moutarde, le sel et le poivre dans un bol.',
      'Fouettez en versant l huile en filet tres progressivement.',
      'Continuez jusqu a obtenir une texture ferme et brillante.',
      'Ajoutez le vinaigre ou le jus de citron puis melangez.',
      'Rectifiez l assaisonnement avant de servir.',
    ],
  },
  {
    titre: 'Pate brisee maison',
    slug: 'pate-brisee-maison',
    description: 'Une pate brisee facile pour tartes salees, quiches et tourtes maison.',
    tempsPreparation: 15,
    tempsCuisson: 0,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison', 'pate maison'],
    ingredients: [
      { quantite: '250 g', ingredient: 'farine' },
      { quantite: '125 g', ingredient: 'beurre froid' },
      { quantite: '5 cl', ingredient: 'eau froide' },
      { quantite: '1 pincee', ingredient: 'sel' },
    ],
    etapes: [
      'Melangez la farine et le sel dans un saladier.',
      'Ajoutez le beurre froid en morceaux et sablez du bout des doigts.',
      'Versez l eau froide progressivement jusqu a former une boule.',
      'Aplatissez legerement la pate, filmez-la et laissez reposer 30 minutes au frais.',
      'Etalez la pate sur un plan farine avant utilisation.',
    ],
  },
  {
    titre: 'Pate sablee maison',
    slug: 'pate-sablee-maison',
    description: 'Une pate sablee fondante et croustillante pour tartes aux fruits, biscuits et desserts maison.',
    tempsPreparation: 15,
    tempsCuisson: 0,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison', 'pate maison'],
    ingredients: [
      { quantite: '250 g', ingredient: 'farine' },
      { quantite: '125 g', ingredient: 'beurre mou' },
      { quantite: '90 g', ingredient: 'sucre glace' },
      { quantite: '1', ingredient: 'oeuf' },
      { quantite: '1 pincee', ingredient: 'sel' },
    ],
    etapes: [
      'Melangez le beurre mou avec le sucre glace et le sel.',
      'Ajoutez l oeuf puis incorporez la farine sans trop travailler la pate.',
      'Formez une boule, aplatissez-la legerement et filmez-la.',
      'Laissez reposer 1 heure au frais.',
      'Etalez la pate et foncez votre moule avant cuisson.',
    ],
  },
  {
    titre: 'Pate a crepes facile',
    slug: 'pate-a-crepes-facile',
    description: 'Une pate a crepes simple, fluide et sans grumeaux pour des crepes legeres et regulieres.',
    tempsPreparation: 10,
    tempsCuisson: 20,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'recette facile', 'pate maison'],
    ingredients: [
      { quantite: '250 g', ingredient: 'farine' },
      { quantite: '3', ingredient: 'oeufs' },
      { quantite: '50 cl', ingredient: 'lait' },
      { quantite: '2 c. a soupe', ingredient: 'sucre' },
      { quantite: '1 pincee', ingredient: 'sel' },
      { quantite: '30 g', ingredient: 'beurre fondu' },
    ],
    etapes: [
      'Versez la farine, le sucre et le sel dans un saladier.',
      'Ajoutez les oeufs et commencez a fouetter.',
      'Versez le lait progressivement en fouettant pour eviter les grumeaux.',
      'Ajoutez le beurre fondu et melangez.',
      'Laissez reposer 30 minutes si possible avant cuisson.',
    ],
  },
  {
    titre: 'Sauce tomate maison',
    slug: 'sauce-tomate-maison',
    description: 'Une sauce tomate maison simple et parfumee pour pates, pizzas, gratins et plats mijotes.',
    tempsPreparation: 10,
    tempsCuisson: 25,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'sauce'],
    ingredients: [
      { quantite: '800 g', ingredient: 'tomates concassees' },
      { quantite: '1', ingredient: 'oignon' },
      { quantite: '2', ingredient: 'gousses d ail' },
      { quantite: '2 c. a soupe', ingredient: 'huile d olive' },
      { quantite: '1 c. a cafe', ingredient: 'sucre' },
      { quantite: '', ingredient: 'sel, poivre et basilic' },
    ],
    etapes: [
      'Emincez l oignon et hachez l ail.',
      'Faites revenir l oignon dans l huile d olive jusqu a ce qu il soit translucide.',
      'Ajoutez l ail, les tomates concassees, le sucre, le sel et le poivre.',
      'Laissez mijoter 20 a 25 minutes a feu doux.',
      'Ajoutez le basilic en fin de cuisson et mixez si vous souhaitez une sauce lisse.',
    ],
  },
  {
    titre: 'Vinaigrette classique',
    slug: 'vinaigrette-classique',
    description: 'La vinaigrette de base, rapide et equilibree, a adapter selon vos salades et crudites.',
    tempsPreparation: 5,
    tempsCuisson: 0,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'recette facile', 'sauce'],
    ingredients: [
      { quantite: '1 c. a soupe', ingredient: 'vinaigre' },
      { quantite: '1 c. a cafe', ingredient: 'moutarde' },
      { quantite: '3 c. a soupe', ingredient: 'huile' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Melangez le vinaigre avec la moutarde, le sel et le poivre.',
      'Versez l huile progressivement en fouettant.',
      'Goutez et ajustez l assaisonnement.',
      'Utilisez aussitot ou conservez au frais dans un petit pot ferme.',
    ],
  },
  {
    titre: 'Sauce au yaourt',
    slug: 'sauce-au-yaourt',
    description: 'Une sauce fraiche au yaourt pour crudites, grillades, bowls, pitas et salades composees.',
    tempsPreparation: 10,
    tempsCuisson: 0,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'recette facile', 'sauce'],
    ingredients: [
      { quantite: '1', ingredient: 'yaourt nature' },
      { quantite: '1 c. a soupe', ingredient: 'jus de citron' },
      { quantite: '1 c. a soupe', ingredient: 'huile d olive' },
      { quantite: '1 c. a soupe', ingredient: 'herbes fraiches ciselees' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Versez le yaourt dans un bol.',
      'Ajoutez le jus de citron, l huile d olive, les herbes, le sel et le poivre.',
      'Melangez jusqu a obtenir une sauce homogene.',
      'Reservez au frais au moins 10 minutes avant de servir.',
    ],
  },
  {
    titre: 'Creme patissiere',
    slug: 'creme-patissiere',
    description: 'Une creme patissiere onctueuse pour garnir choux, tartes, mille-feuilles et desserts maison.',
    tempsPreparation: 10,
    tempsCuisson: 10,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison', 'recette facile'],
    ingredients: [
      { quantite: '50 cl', ingredient: 'lait' },
      { quantite: '4', ingredient: 'jaunes d oeufs' },
      { quantite: '100 g', ingredient: 'sucre' },
      { quantite: '40 g', ingredient: 'maizena' },
      { quantite: '1', ingredient: 'gousse de vanille ou extrait de vanille' },
    ],
    etapes: [
      'Faites chauffer le lait avec la vanille.',
      'Fouettez les jaunes d oeufs avec le sucre jusqu a ce que le melange blanchisse.',
      'Ajoutez la maizena puis versez le lait chaud progressivement.',
      'Reversez dans la casserole et faites epaissir en fouettant.',
      'Filmez au contact et laissez refroidir.',
    ],
  },
  {
    titre: 'Caramel beurre sale',
    slug: 'caramel-beurre-sale',
    description: 'Un caramel beurre sale gourmand pour crepes, glaces, gateaux, yaourts et desserts maison.',
    tempsPreparation: 5,
    tempsCuisson: 10,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison', 'sauce'],
    ingredients: [
      { quantite: '160 g', ingredient: 'sucre' },
      { quantite: '80 g', ingredient: 'beurre demi-sel' },
      { quantite: '20 cl', ingredient: 'creme liquide entiere' },
      { quantite: '1 pincee', ingredient: 'fleur de sel' },
    ],
    etapes: [
      'Faites fondre le sucre a sec dans une casserole jusqu a obtenir un caramel ambre.',
      'Chauffez la creme liquide a part.',
      'Ajoutez le beurre en morceaux dans le caramel en melangeant.',
      'Versez la creme chaude progressivement en faisant attention aux projections.',
      'Laissez cuire 2 minutes, ajoutez la fleur de sel puis versez en pot.',
    ],
  },
  {
    titre: 'Croutons maison',
    slug: 'croutons-maison',
    description: 'Des croutons maison dores et croustillants pour salades, soupes, veloutes et gratins.',
    tempsPreparation: 5,
    tempsCuisson: 10,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'recette facile'],
    ingredients: [
      { quantite: '150 g', ingredient: 'pain rassis' },
      { quantite: '2 c. a soupe', ingredient: 'huile d olive' },
      { quantite: '1', ingredient: 'gousse d ail' },
      { quantite: '1 c. a cafe', ingredient: 'herbes de Provence' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Coupez le pain rassis en petits cubes reguliers.',
      'Melangez l huile d olive avec l ail rape, les herbes, le sel et le poivre.',
      'Enrobez les cubes de pain avec cette huile parfumee.',
      'Faites dorer les croutons a la poele ou au four jusqu a ce qu ils soient croustillants.',
      'Laissez refroidir avant de conserver dans une boite hermetique.',
    ],
  },
  {
    titre: 'Guacamole simple',
    slug: 'guacamole-simple',
    description: 'Un guacamole simple, frais et rapide pour aperitif, tacos, bowls et tartines salees.',
    tempsPreparation: 10,
    tempsCuisson: 0,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'recette facile', 'fait maison'],
    ingredients: [
      { quantite: '2', ingredient: 'avocats murs' },
      { quantite: '1/2', ingredient: 'citron vert' },
      { quantite: '1/2', ingredient: 'oignon rouge' },
      { quantite: '1', ingredient: 'petite tomate' },
      { quantite: '', ingredient: 'coriandre, sel et poivre' },
    ],
    etapes: [
      'Ecrasez la chair des avocats a la fourchette.',
      'Ajoutez le jus de citron vert pour eviter l oxydation.',
      'Incorporez l oignon rouge et la tomate finement coupes.',
      'Ajoutez la coriandre, le sel et le poivre.',
      'Melangez et servez frais.',
    ],
  },
  {
    titre: 'Chapelure maison',
    slug: 'chapelure-maison',
    description: 'Une chapelure maison anti-gaspi pour panures, gratins croustillants et farces.',
    tempsPreparation: 5,
    tempsCuisson: 10,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison', 'recette facile'],
    ingredients: [
      { quantite: '200 g', ingredient: 'pain rassis' },
      { quantite: '1 pincee', ingredient: 'sel' },
      { quantite: '', ingredient: 'herbes seches ou epices facultatives' },
    ],
    etapes: [
      'Coupez le pain rassis en morceaux.',
      'Faites-le secher au four a 150 degres pendant environ 10 minutes si besoin.',
      'Mixez le pain jusqu a obtenir une chapelure fine ou grossiere selon l usage.',
      'Ajoutez une pincee de sel et des herbes si vous le souhaitez.',
      'Conservez dans un bocal sec et ferme.',
    ],
  },
  {
    titre: 'Bouillon de legumes maison',
    slug: 'bouillon-de-legumes-maison',
    description: 'Un bouillon de legumes maison parfume pour risottos, soupes, sauces et cuissons du quotidien.',
    tempsPreparation: 10,
    tempsCuisson: 45,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison'],
    ingredients: [
      { quantite: '2', ingredient: 'carottes' },
      { quantite: '1', ingredient: 'oignon' },
      { quantite: '1', ingredient: 'poireau' },
      { quantite: '1', ingredient: 'branche de celeri' },
      { quantite: '1,5 l', ingredient: 'eau' },
      { quantite: '', ingredient: 'laurier, thym, sel et poivre' },
    ],
    etapes: [
      'Lavez et coupez les legumes en gros morceaux.',
      'Placez-les dans une grande casserole avec les aromates.',
      'Ajoutez l eau froide et portez a fremissement.',
      'Laissez cuire 45 minutes a feu doux.',
      'Filtrez le bouillon et utilisez-le ou conservez-le au frais.',
    ],
  },
  {
    titre: 'Pesto basilic maison',
    slug: 'pesto-basilic-maison',
    description: 'Un pesto basilic maison intense et parfume pour pates, tartines, salades et legumes grilles.',
    tempsPreparation: 10,
    tempsCuisson: 0,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'sauce'],
    ingredients: [
      { quantite: '1 bouquet', ingredient: 'basilic frais' },
      { quantite: '40 g', ingredient: 'pignons de pin' },
      { quantite: '50 g', ingredient: 'parmesan rape' },
      { quantite: '1', ingredient: 'gousse d ail' },
      { quantite: '8 cl', ingredient: 'huile d olive' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Lavez et sechez les feuilles de basilic.',
      'Mixez le basilic avec les pignons, l ail et le parmesan.',
      'Versez l huile d olive progressivement en mixant.',
      'Assaisonnez avec le sel et le poivre.',
      'Conservez au frais avec une fine couche d huile sur le dessus.',
    ],
  },
  {
    titre: 'Sauce curry rapide',
    slug: 'sauce-curry-rapide',
    description: 'Une sauce curry rapide et cremeuse pour accompagner riz, legumes, poulet, poisson ou tofu.',
    tempsPreparation: 5,
    tempsCuisson: 10,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'recette facile', 'sauce'],
    ingredients: [
      { quantite: '20 cl', ingredient: 'creme liquide ou lait de coco' },
      { quantite: '1', ingredient: 'echalote' },
      { quantite: '1 c. a soupe', ingredient: 'curry en poudre' },
      { quantite: '1 c. a soupe', ingredient: 'huile' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Emincez l echalote finement.',
      'Faites-la revenir dans l huile pendant 2 minutes.',
      'Ajoutez le curry et melangez quelques secondes pour le torréfier legerement.',
      'Versez la creme ou le lait de coco et laissez mijoter 5 minutes.',
      'Salez, poivrez et servez chaud.',
    ],
  },
  {
    titre: 'Sauce fromage blanc aux herbes',
    slug: 'sauce-fromage-blanc-aux-herbes',
    description: 'Une sauce legere au fromage blanc et aux herbes pour pommes de terre, crudites, wraps et grillades.',
    tempsPreparation: 10,
    tempsCuisson: 0,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'recette facile', 'sauce'],
    ingredients: [
      { quantite: '200 g', ingredient: 'fromage blanc' },
      { quantite: '1 c. a soupe', ingredient: 'jus de citron' },
      { quantite: '1 c. a soupe', ingredient: 'ciboulette ciselee' },
      { quantite: '1 c. a soupe', ingredient: 'persil cisele' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Versez le fromage blanc dans un bol.',
      'Ajoutez le jus de citron, les herbes, le sel et le poivre.',
      'Melangez jusqu a obtenir une sauce homogene.',
      'Goutez et ajustez l assaisonnement.',
      'Reservez au frais jusqu au service.',
    ],
  },
  {
    titre: 'Marinade poulet citron herbes',
    slug: 'marinade-poulet-citron-herbes',
    description: 'Une marinade citron et herbes simple pour rendre le poulet plus tendre et parfume.',
    tempsPreparation: 10,
    tempsCuisson: 0,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'recette facile'],
    ingredients: [
      { quantite: '1', ingredient: 'citron' },
      { quantite: '3 c. a soupe', ingredient: 'huile d olive' },
      { quantite: '2', ingredient: 'gousses d ail' },
      { quantite: '1 c. a soupe', ingredient: 'herbes de Provence' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Pressez le citron et versez le jus dans un bol.',
      'Ajoutez l huile d olive, l ail hache, les herbes, le sel et le poivre.',
      'Melangez la marinade.',
      'Enrobez le poulet et laissez mariner au moins 30 minutes au frais.',
      'Egouttez legerement avant cuisson.',
    ],
  },
  {
    titre: 'Marinade barbecue maison',
    slug: 'marinade-barbecue-maison',
    description: 'Une marinade barbecue maison sucree salee pour viandes, tofu, brochettes et grillades.',
    tempsPreparation: 10,
    tempsCuisson: 0,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'sauce'],
    ingredients: [
      { quantite: '3 c. a soupe', ingredient: 'ketchup' },
      { quantite: '1 c. a soupe', ingredient: 'miel' },
      { quantite: '1 c. a soupe', ingredient: 'sauce soja' },
      { quantite: '1 c. a soupe', ingredient: 'huile' },
      { quantite: '1 c. a cafe', ingredient: 'paprika fume' },
      { quantite: '', ingredient: 'poivre' },
    ],
    etapes: [
      'Melangez le ketchup, le miel, la sauce soja et l huile.',
      'Ajoutez le paprika fume et le poivre.',
      'Badigeonnez la viande, le tofu ou les legumes avec la marinade.',
      'Laissez reposer au moins 30 minutes au frais.',
      'Cuisez au barbecue, a la poele ou au four.',
    ],
  },
  {
    titre: 'Pate a pancakes',
    slug: 'pate-a-pancakes',
    description: 'Une pate a pancakes epaisse et moelleuse pour un petit-dejeuner ou un brunch maison.',
    tempsPreparation: 10,
    tempsCuisson: 15,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'pate maison'],
    ingredients: [
      { quantite: '200 g', ingredient: 'farine' },
      { quantite: '2', ingredient: 'oeufs' },
      { quantite: '25 cl', ingredient: 'lait' },
      { quantite: '30 g', ingredient: 'sucre' },
      { quantite: '1 sachet', ingredient: 'levure chimique' },
      { quantite: '30 g', ingredient: 'beurre fondu' },
    ],
    etapes: [
      'Melangez la farine, le sucre et la levure dans un saladier.',
      'Ajoutez les oeufs puis versez le lait progressivement.',
      'Incorporez le beurre fondu.',
      'Laissez reposer la pate 10 minutes.',
      'Cuisez les pancakes dans une poele chaude legerement graissee.',
    ],
  },
  {
    titre: 'Gaufres simples',
    slug: 'gaufres-simples',
    description: 'Une pate a gaufres simple pour des gaufres dorees, legerement croustillantes et moelleuses.',
    tempsPreparation: 10,
    tempsCuisson: 20,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'pate maison'],
    ingredients: [
      { quantite: '250 g', ingredient: 'farine' },
      { quantite: '2', ingredient: 'oeufs' },
      { quantite: '40 cl', ingredient: 'lait' },
      { quantite: '60 g', ingredient: 'beurre fondu' },
      { quantite: '40 g', ingredient: 'sucre' },
      { quantite: '1 sachet', ingredient: 'levure chimique' },
    ],
    etapes: [
      'Melangez la farine, le sucre et la levure.',
      'Ajoutez les oeufs puis le lait progressivement.',
      'Incorporez le beurre fondu.',
      'Laissez reposer 15 minutes si possible.',
      'Cuisez la pate dans un gaufrier bien chaud.',
    ],
  },
  {
    titre: 'Pain naan maison',
    slug: 'pain-naan-maison',
    description: 'Des pains naan moelleux a cuire a la poele pour accompagner currys, plats en sauce et dips.',
    tempsPreparation: 20,
    tempsCuisson: 10,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison', 'pain maison'],
    ingredients: [
      { quantite: '300 g', ingredient: 'farine' },
      { quantite: '1', ingredient: 'yaourt nature' },
      { quantite: '8 cl', ingredient: 'eau tiede' },
      { quantite: '1 c. a cafe', ingredient: 'levure chimique' },
      { quantite: '1 c. a soupe', ingredient: 'huile' },
      { quantite: '1 c. a cafe', ingredient: 'sel' },
    ],
    etapes: [
      'Melangez la farine, la levure et le sel.',
      'Ajoutez le yaourt, l eau tiede et l huile.',
      'Petrissez jusqu a obtenir une pate souple.',
      'Laissez reposer 30 minutes puis divisez en 6 boules.',
      'Etalez et cuisez chaque naan dans une poele chaude 1 a 2 minutes par face.',
    ],
  },
  {
    titre: 'Tortillas de ble maison',
    slug: 'tortillas-de-ble-maison',
    description: 'Des tortillas de ble souples et faciles pour wraps, fajitas, tacos et quesadillas.',
    tempsPreparation: 20,
    tempsCuisson: 10,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison', 'pain maison'],
    ingredients: [
      { quantite: '300 g', ingredient: 'farine' },
      { quantite: '16 cl', ingredient: 'eau tiede' },
      { quantite: '4 c. a soupe', ingredient: 'huile' },
      { quantite: '1 c. a cafe', ingredient: 'sel' },
    ],
    etapes: [
      'Melangez la farine et le sel.',
      'Ajoutez l huile puis l eau tiede progressivement.',
      'Petrissez jusqu a obtenir une pate souple.',
      'Divisez en 6 boules et laissez reposer 15 minutes.',
      'Etalez finement puis cuisez dans une poele chaude 30 a 45 secondes par face.',
    ],
  },
  {
    titre: 'Pickles d oignons rouges',
    slug: 'pickles-oignons-rouges',
    description: 'Des pickles d oignons rouges croquants et acidules pour tacos, burgers, salades et bowls.',
    tempsPreparation: 10,
    tempsCuisson: 5,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison', 'recette facile'],
    ingredients: [
      { quantite: '2', ingredient: 'oignons rouges' },
      { quantite: '10 cl', ingredient: 'vinaigre' },
      { quantite: '10 cl', ingredient: 'eau' },
      { quantite: '1 c. a soupe', ingredient: 'sucre' },
      { quantite: '1 c. a cafe', ingredient: 'sel' },
    ],
    etapes: [
      'Emincez finement les oignons rouges.',
      'Portez a fremissement le vinaigre, l eau, le sucre et le sel.',
      'Placez les oignons dans un bocal propre.',
      'Versez le liquide chaud sur les oignons.',
      'Laissez refroidir puis conservez au frais.',
    ],
  },
  {
    titre: 'Oignons caramelises',
    slug: 'oignons-caramelises',
    description: 'Des oignons caramelises fondants pour burgers, tartes, viandes, fromages et sandwichs.',
    tempsPreparation: 10,
    tempsCuisson: 30,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison'],
    ingredients: [
      { quantite: '4', ingredient: 'oignons' },
      { quantite: '2 c. a soupe', ingredient: 'huile ou beurre' },
      { quantite: '1 c. a cafe', ingredient: 'sucre' },
      { quantite: '1 pincee', ingredient: 'sel' },
      { quantite: '1 c. a soupe', ingredient: 'vinaigre balsamique facultatif' },
    ],
    etapes: [
      'Emincez finement les oignons.',
      'Faites chauffer l huile ou le beurre dans une poele.',
      'Ajoutez les oignons et le sel puis cuisez a feu doux.',
      'Remuez regulierement pendant 25 a 30 minutes.',
      'Ajoutez le sucre et le vinaigre en fin de cuisson si souhaite.',
    ],
  },
  {
    titre: 'Riz pilaf',
    slug: 'riz-pilaf',
    description: 'Un riz pilaf simple, parfume et bien detache pour accompagner viandes, poissons, legumes et plats en sauce.',
    tempsPreparation: 5,
    tempsCuisson: 18,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'recette facile'],
    ingredients: [
      { quantite: '250 g', ingredient: 'riz long' },
      { quantite: '1', ingredient: 'oignon' },
      { quantite: '2 c. a soupe', ingredient: 'huile ou beurre' },
      { quantite: '50 cl', ingredient: 'bouillon chaud' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Emincez l oignon finement.',
      'Faites-le revenir dans l huile ou le beurre.',
      'Ajoutez le riz et nacrez-le 1 a 2 minutes en remuant.',
      'Versez le bouillon chaud, couvrez et laissez cuire a feu doux.',
      'Laissez reposer 5 minutes hors du feu avant d egrainer.',
    ],
  },
  {
    titre: 'Semoule couscous parfaite',
    slug: 'semoule-couscous-parfaite',
    description: 'Une semoule de couscous bien grainee, rapide et sans paquet compact.',
    tempsPreparation: 5,
    tempsCuisson: 5,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'recette facile'],
    ingredients: [
      { quantite: '250 g', ingredient: 'semoule moyenne' },
      { quantite: '25 cl', ingredient: 'eau chaude' },
      { quantite: '2 c. a soupe', ingredient: 'huile d olive' },
      { quantite: '1 noix', ingredient: 'beurre' },
      { quantite: '1 pincee', ingredient: 'sel' },
    ],
    etapes: [
      'Versez la semoule dans un saladier avec le sel et l huile.',
      'Ajoutez l eau chaude, couvrez et laissez gonfler 5 minutes.',
      'Egrainez a la fourchette.',
      'Ajoutez le beurre et melangez.',
      'Servez chaud en accompagnement.',
    ],
  },
  {
    titre: 'Pommes de terre roties croustillantes',
    slug: 'pommes-de-terre-roties-croustillantes',
    description: 'Des pommes de terre roties croustillantes dehors et fondantes dedans, faciles a reussir au four.',
    tempsPreparation: 10,
    tempsCuisson: 40,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'recette facile'],
    ingredients: [
      { quantite: '800 g', ingredient: 'pommes de terre' },
      { quantite: '3 c. a soupe', ingredient: 'huile d olive' },
      { quantite: '1 c. a cafe', ingredient: 'paprika' },
      { quantite: '1 c. a cafe', ingredient: 'herbes de Provence' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Prechauffez le four a 200 degres.',
      'Coupez les pommes de terre en morceaux reguliers.',
      'Melangez-les avec l huile, les epices, le sel et le poivre.',
      'Etalez sur une plaque en une seule couche.',
      'Faites rotir 35 a 40 minutes en retournant a mi-cuisson.',
    ],
  },
  {
    titre: 'Puree maison',
    slug: 'puree-maison',
    description: 'Une puree maison onctueuse et simple, parfaite pour accompagner plats mijotes, viandes et poissons.',
    tempsPreparation: 10,
    tempsCuisson: 25,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'recette facile'],
    ingredients: [
      { quantite: '1 kg', ingredient: 'pommes de terre' },
      { quantite: '20 cl', ingredient: 'lait chaud' },
      { quantite: '50 g', ingredient: 'beurre' },
      { quantite: '', ingredient: 'sel, poivre et muscade' },
    ],
    etapes: [
      'Epluchez et coupez les pommes de terre en morceaux.',
      'Faites-les cuire dans l eau salee jusqu a ce qu elles soient tendres.',
      'Egouttez puis ecrasez les pommes de terre.',
      'Ajoutez le beurre puis le lait chaud progressivement.',
      'Assaisonnez avec le sel, le poivre et la muscade.',
    ],
  },
  {
    titre: 'Compote de pommes maison',
    slug: 'compote-de-pommes-maison',
    description: 'Une compote de pommes maison douce et simple, a servir nature, avec du yaourt ou dans un dessert.',
    tempsPreparation: 10,
    tempsCuisson: 20,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'fait maison', 'recette facile'],
    ingredients: [
      { quantite: '1 kg', ingredient: 'pommes' },
      { quantite: '5 cl', ingredient: 'eau' },
      { quantite: '1 c. a soupe', ingredient: 'sucre facultatif' },
      { quantite: '1 pincee', ingredient: 'cannelle facultative' },
    ],
    etapes: [
      'Epluchez les pommes et coupez-les en morceaux.',
      'Placez-les dans une casserole avec l eau.',
      'Couvrez et laissez cuire a feu doux environ 20 minutes.',
      'Ajoutez le sucre ou la cannelle si souhaite.',
      'Ecrasez ou mixez selon la texture voulue.',
    ],
  },
  {
    titre: 'Coulis de fruits rouges',
    slug: 'coulis-de-fruits-rouges',
    description: 'Un coulis de fruits rouges rapide pour cheesecake, panna cotta, glace, yaourt ou gateau au chocolat.',
    tempsPreparation: 5,
    tempsCuisson: 8,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison', 'sauce'],
    ingredients: [
      { quantite: '300 g', ingredient: 'fruits rouges' },
      { quantite: '50 g', ingredient: 'sucre' },
      { quantite: '1 c. a soupe', ingredient: 'jus de citron' },
    ],
    etapes: [
      'Placez les fruits rouges, le sucre et le citron dans une casserole.',
      'Faites cuire 5 a 8 minutes a feu moyen.',
      'Mixez le tout finement.',
      'Filtrez si vous souhaitez un coulis tres lisse.',
      'Laissez refroidir avant utilisation.',
    ],
  },
  {
    titre: 'Ganache chocolat',
    slug: 'ganache-chocolat',
    description: 'Une ganache chocolat lisse et brillante pour tartes, gateaux, choux, macarons et glacages.',
    tempsPreparation: 10,
    tempsCuisson: 5,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison'],
    ingredients: [
      { quantite: '200 g', ingredient: 'chocolat noir' },
      { quantite: '20 cl', ingredient: 'creme liquide entiere' },
      { quantite: '20 g', ingredient: 'beurre facultatif' },
    ],
    etapes: [
      'Hachez le chocolat et placez-le dans un bol.',
      'Faites chauffer la creme jusqu a fremissement.',
      'Versez la creme chaude sur le chocolat et laissez reposer 1 minute.',
      'Melangez doucement jusqu a obtenir une ganache lisse.',
      'Ajoutez le beurre si souhaite pour plus de brillance.',
    ],
  },
  {
    titre: 'Creme anglaise',
    slug: 'creme-anglaise',
    description: 'Une creme anglaise vanillee, lisse et nappante pour accompagner gateaux, iles flottantes et desserts au chocolat.',
    tempsPreparation: 10,
    tempsCuisson: 10,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison'],
    ingredients: [
      { quantite: '50 cl', ingredient: 'lait' },
      { quantite: '4', ingredient: 'jaunes d oeufs' },
      { quantite: '80 g', ingredient: 'sucre' },
      { quantite: '1', ingredient: 'gousse de vanille' },
    ],
    etapes: [
      'Faites chauffer le lait avec la vanille.',
      'Fouettez les jaunes d oeufs avec le sucre.',
      'Versez le lait chaud progressivement sur les jaunes en fouettant.',
      'Reversez dans la casserole et cuisez a feu doux sans bouillir.',
      'La creme est prete lorsqu elle nappe la cuillere.',
    ],
  },
  {
    titre: 'Sauce hollandaise simplifiee',
    slug: 'sauce-hollandaise-simplifiee',
    description: 'Une sauce hollandaise simplifiee pour asperges, oeufs benedicte, poissons et legumes vapeur.',
    tempsPreparation: 10,
    tempsCuisson: 5,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'sauce'],
    ingredients: [
      { quantite: '2', ingredient: 'jaunes d oeufs' },
      { quantite: '100 g', ingredient: 'beurre fondu' },
      { quantite: '1 c. a soupe', ingredient: 'jus de citron' },
      { quantite: '1 c. a soupe', ingredient: 'eau' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Fouettez les jaunes avec l eau dans un bol au bain-marie doux.',
      'Lorsque le melange epaissit, versez le beurre fondu en filet.',
      'Fouettez constamment pour obtenir une sauce lisse.',
      'Ajoutez le jus de citron, le sel et le poivre.',
      'Servez aussitot.',
    ],
  },
  {
    titre: 'Sauce bearnaise simplifiee',
    slug: 'sauce-bearnaise-simplifiee',
    description: 'Une sauce bearnaise simplifiee pour accompagner steak, grillades, pommes de terre et poissons.',
    tempsPreparation: 10,
    tempsCuisson: 8,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'sauce'],
    ingredients: [
      { quantite: '2', ingredient: 'jaunes d oeufs' },
      { quantite: '100 g', ingredient: 'beurre fondu' },
      { quantite: '2 c. a soupe', ingredient: 'vinaigre' },
      { quantite: '1', ingredient: 'echalote' },
      { quantite: '1 c. a soupe', ingredient: 'estragon' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Faites reduire le vinaigre avec l echalote hachee et l estragon.',
      'Filtrez ou gardez l echalote selon votre gout.',
      'Fouettez les jaunes avec la reduction au bain-marie doux.',
      'Ajoutez le beurre fondu en filet en fouettant.',
      'Assaisonnez et servez rapidement.',
    ],
  },
  {
    titre: 'Sauce blanche kebab',
    slug: 'sauce-blanche-kebab',
    description: 'Une sauce blanche maison fraiche et cremeuse pour kebab, wraps, sandwichs, crudites et grillades.',
    tempsPreparation: 10,
    tempsCuisson: 0,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'recette facile', 'sauce'],
    ingredients: [
      { quantite: '1', ingredient: 'yaourt grec' },
      { quantite: '1 c. a soupe', ingredient: 'mayonnaise' },
      { quantite: '1 c. a soupe', ingredient: 'jus de citron' },
      { quantite: '1', ingredient: 'gousse d ail' },
      { quantite: '1 c. a soupe', ingredient: 'ciboulette' },
      { quantite: '', ingredient: 'sel et poivre' },
    ],
    etapes: [
      'Melangez le yaourt grec et la mayonnaise.',
      'Ajoutez le jus de citron et l ail finement rape.',
      'Incorporez la ciboulette, le sel et le poivre.',
      'Goutez et ajustez l assaisonnement.',
      'Reservez au frais avant de servir.',
    ],
  },
  {
    titre: 'Tzatziki maison',
    slug: 'tzatziki-maison',
    description: 'Un tzatziki maison frais et cremeux pour pitas, grillades, mezzes, crudites et assiettes d ete.',
    tempsPreparation: 15,
    tempsCuisson: 0,
    nombrePersonnes: 4,
    tags: ['base de cuisine', 'recette facile', 'sauce'],
    ingredients: [
      { quantite: '1/2', ingredient: 'concombre' },
      { quantite: '1', ingredient: 'yaourt grec' },
      { quantite: '1', ingredient: 'gousse d ail' },
      { quantite: '1 c. a soupe', ingredient: 'huile d olive' },
      { quantite: '1 c. a soupe', ingredient: 'jus de citron' },
      { quantite: '', ingredient: 'menthe ou aneth, sel et poivre' },
    ],
    etapes: [
      'Rapez le concombre puis pressez-le pour retirer l eau.',
      'Melangez le yaourt grec avec l ail rape, le citron et l huile d olive.',
      'Ajoutez le concombre egoutte et les herbes.',
      'Salez, poivrez et melangez.',
      'Reservez au frais avant de servir.',
    ],
  },
  {
    titre: 'Ail confit',
    slug: 'ail-confit',
    description: 'De l ail confit doux et fondant pour parfumer sauces, purees, viandes, legumes et tartines.',
    tempsPreparation: 10,
    tempsCuisson: 45,
    nombrePersonnes: 6,
    tags: ['base de cuisine', 'fait maison'],
    ingredients: [
      { quantite: '3', ingredient: 'tetes d ail' },
      { quantite: '25 cl', ingredient: 'huile d olive' },
      { quantite: '2', ingredient: 'branches de thym' },
      { quantite: '1', ingredient: 'feuille de laurier' },
      { quantite: '1 pincee', ingredient: 'sel' },
    ],
    etapes: [
      'Separez les gousses d ail sans forcement les eplucher.',
      'Placez-les dans une petite casserole avec l huile, le thym, le laurier et le sel.',
      'Faites chauffer a feu tres doux sans faire frire.',
      'Laissez confire 40 a 45 minutes jusqu a ce que l ail soit tendre.',
      'Conservez au frais dans un bocal propre avec l huile de cuisson.',
    ],
  },
];

function loadDotenv() {
  const envPath = path.join(BACKEND_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    verbose: argv.includes('--verbose'),
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stepsToHtml(steps) {
  return steps
    .map((step, index) => `<p><strong>Etape ${index + 1} :</strong> ${escapeHtml(step)}</p>`)
    .join('\n');
}

function metaDescription(recipe) {
  const total = (recipe.tempsPreparation || 0) + (recipe.tempsCuisson || 0);
  const time = total > 0 ? ` en ${total} minutes` : '';
  return `${recipe.titre} : recette de base facile${time}, ideale pour cuisiner maison au quotidien.`;
}

function valueForColumn(colInfo, camelName, snakeName, value) {
  if (Object.prototype.hasOwnProperty.call(colInfo, camelName)) return [camelName, value];
  if (Object.prototype.hasOwnProperty.call(colInfo, snakeName)) return [snakeName, value];
  return null;
}

function addIfColumn(row, colInfo, camelName, snakeName, value) {
  const entry = valueForColumn(colInfo, camelName, snakeName, value);
  if (entry) row[entry[0]] = entry[1];
}

function serializeJsonForDb(strapi, value) {
  const client = strapi.config.get('database.connection.client');
  const payload = JSON.stringify(value);
  if (client === 'postgres' || client === 'postgresql') {
    return strapi.db.connection.raw('?::jsonb', [payload]);
  }
  return payload;
}

async function findBySlug(app, uid, slug) {
  const results = await app.entityService.findMany(uid, {
    filters: { slug },
    publicationState: 'preview',
    limit: 1,
  });
  return Array.isArray(results) ? results[0] : null;
}

async function ensureCategory(app, dryRun) {
  const existing = await findBySlug(app, CATEGORIE_UID, CATEGORY.slug);
  if (existing) return existing;

  if (dryRun) return { id: '[dry-run-category]', ...CATEGORY };

  return app.entityService.create(CATEGORIE_UID, {
    data: {
      ...CATEGORY,
      publishedAt: new Date().toISOString(),
    },
  });
}

async function ensureTags(app, dryRun) {
  const out = new Map();
  for (const tag of TAGS) {
    const existing = await findBySlug(app, TAG_UID, tag.slug);
    if (existing) {
      out.set(tag.nom, existing);
      continue;
    }

    if (dryRun) {
      out.set(tag.nom, { id: `[dry-run-tag-${tag.slug}]`, ...tag });
      continue;
    }

    const created = await app.entityService.create(TAG_UID, {
      data: {
        ...tag,
        description: `Recettes ${tag.nom} faciles et utiles pour cuisiner maison avec 4epices.`,
        publishedAt: new Date().toISOString(),
      },
    });
    out.set(tag.nom, created);
  }
  return out;
}

async function insertRecipeRow(app, recipe) {
  const model = app.getModel(RECETTE_UID);
  const table = model.collectionName;
  const knex = app.db.connection;
  const colInfo = await knex(table).columnInfo();
  const now = new Date().toISOString();
  const row = {};

  addIfColumn(row, colInfo, 'titre', 'titre', recipe.titre);
  addIfColumn(row, colInfo, 'slug', 'slug', recipe.slug);
  addIfColumn(row, colInfo, 'description', 'description', recipe.description);
  addIfColumn(row, colInfo, 'tempsPreparation', 'temps_preparation', recipe.tempsPreparation);
  addIfColumn(row, colInfo, 'tempsCuisson', 'temps_cuisson', recipe.tempsCuisson);
  addIfColumn(row, colInfo, 'nombrePersonnes', 'nombre_personnes', recipe.nombrePersonnes);
  addIfColumn(row, colInfo, 'difficulte', 'difficulte', 'facile');
  addIfColumn(row, colInfo, 'ingredients', 'ingredients', serializeJsonForDb(app, recipe.ingredients));
  addIfColumn(row, colInfo, 'etapes', 'etapes', stepsToHtml(recipe.etapes));
  addIfColumn(row, colInfo, 'datePublication', 'date_publication', now);
  addIfColumn(row, colInfo, 'pinterestAutoPublish', 'pinterest_auto_publish', false);
  addIfColumn(row, colInfo, 'metaTitle', 'meta_title', recipe.titre);
  addIfColumn(row, colInfo, 'metaDescription', 'meta_description', metaDescription(recipe));
  addIfColumn(row, colInfo, 'createdAt', 'created_at', now);
  addIfColumn(row, colInfo, 'updatedAt', 'updated_at', now);
  addIfColumn(row, colInfo, 'publishedAt', 'published_at', null);

  const inserted = await knex(table).insert(row).returning('id');
  if (Array.isArray(inserted)) {
    const first = inserted[0];
    return typeof first === 'object' ? first.id : first;
  }
  return inserted;
}

function relationCandidates(model, attrName, inverseModel, inverseAttrName, fallbackTable) {
  const ownJoin = model.attributes[attrName]?.joinTable;
  if (ownJoin) {
    return [{
      table: ownJoin.name,
      ownerColumn: ownJoin.joinColumn?.name,
      inverseColumn: ownJoin.inverseJoinColumn?.name,
    }];
  }

  const inverseJoin = inverseModel.attributes[inverseAttrName]?.joinTable;
  if (inverseJoin) {
    return [{
      table: inverseJoin.name,
      ownerColumn: inverseJoin.inverseJoinColumn?.name,
      inverseColumn: inverseJoin.joinColumn?.name,
    }];
  }

  return [{
    table: fallbackTable,
    ownerColumn: 'recette_id',
    inverseColumn: attrName === 'categories' ? 'categorie_id' : 'tag_id',
  }];
}

async function linkRelation(app, recipeId, targetId, attrName, inverseAttrName, fallbackTable) {
  const knex = app.db.connection;
  const recipeModel = app.getModel(RECETTE_UID);
  const targetModel = app.getModel(attrName === 'categories' ? CATEGORIE_UID : TAG_UID);
  const candidates = relationCandidates(recipeModel, attrName, targetModel, inverseAttrName, fallbackTable);

  for (const candidate of candidates) {
    if (!candidate.table || !candidate.ownerColumn || !candidate.inverseColumn) continue;
    const exists = await knex.schema.hasTable(candidate.table);
    if (!exists) continue;
    const colInfo = await knex(candidate.table).columnInfo();
    if (!colInfo[candidate.ownerColumn] || !colInfo[candidate.inverseColumn]) continue;

    const where = {
      [candidate.ownerColumn]: recipeId,
      [candidate.inverseColumn]: targetId,
    };
    const alreadyLinked = await knex(candidate.table).where(where).first();
    if (alreadyLinked) return;

    const row = { ...where };
    if (colInfo.recette_order) row.recette_order = 1;
    if (colInfo.categorie_order) row.categorie_order = 1;
    if (colInfo.tag_order) row.tag_order = 1;
    await knex(candidate.table).insert(row);
    return;
  }

  throw new Error(`Impossible de trouver la table de relation pour ${attrName}`);
}

async function main() {
  loadDotenv();
  process.chdir(BACKEND_ROOT);

  const { dryRun, verbose } = parseArgs(process.argv.slice(2));
  const Strapi = require('@strapi/strapi');
  const app = await Strapi().load();

  try {
    console.log(`${RECIPES.length} recettes "Bases de cuisine" a injecter.`);
    if (dryRun) console.log('Mode --dry-run : aucune ecriture.\n');

    const category = await ensureCategory(app, dryRun);
    const tagsByName = await ensureTags(app, dryRun);

    let created = 0;
    let skipped = 0;

    for (const recipe of RECIPES) {
      const existing = await findBySlug(app, RECETTE_UID, recipe.slug);
      if (existing) {
        console.log(`- skip ${recipe.titre} (${recipe.slug}) : existe deja`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] creer ${recipe.titre} (${recipe.ingredients.length} ingredients, ${recipe.etapes.length} etapes)`);
        if (verbose) {
          console.log(`  tags: ${recipe.tags.join(', ')}`);
          console.log(`  meta: ${metaDescription(recipe)}`);
        }
        created++;
        continue;
      }

      const recipeId = await insertRecipeRow(app, recipe);
      await linkRelation(app, recipeId, category.id, 'categories', 'recettes', 'recettes_categories_links');

      for (const tagName of recipe.tags) {
        const tag = tagsByName.get(tagName);
        if (tag?.id) {
          await linkRelation(app, recipeId, tag.id, 'tags', 'recettes', 'recettes_tags_links');
        }
      }

      console.log(`✓ cree ${recipe.titre} (#${recipeId})`);
      created++;
    }

    console.log(
      `\nTermine. ${dryRun ? 'Simulation' : 'Creees'} : ${created}, ignorees : ${skipped}.`
    );
    if (!dryRun) {
      console.log('Les recettes sont en brouillon et sans image principale : ajoute les photos avant publication.');
    }
  } finally {
    await app.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
