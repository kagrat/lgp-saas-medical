// Liste des specialites - section 4/module 4 du cahier des charges.
// Utilisee comme liste deroulante a la fois cote recherche patient
// et cote creation de medecin par l'admin etablissement, pour garantir
// que les deux cotes utilisent exactement les memes valeurs (sinon la
// recherche par specialite ne trouverait jamais les medecins crees
// avec un libelle different, ex: "Dentiste" vs "dentiste").
export const SPECIALTIES = [
  'Generaliste',
  'Dentiste',
  'Chirurgien',
  'Ophtalmologue',
  'Pediatre',
  'Gynecologue',
  'Cardiologue',
  'Dermatologue',
  'ORL',
  'Kinesitherapeute',
  'Psychiatre',
  'Radiologue',
  'Urologue',
  'Neurologue',
  'Sage-femme',
]

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Lundi' },
  { value: 1, label: 'Mardi' },
  { value: 2, label: 'Mercredi' },
  { value: 3, label: 'Jeudi' },
  { value: 4, label: 'Vendredi' },
  { value: 5, label: 'Samedi' },
  { value: 6, label: 'Dimanche' },
]
