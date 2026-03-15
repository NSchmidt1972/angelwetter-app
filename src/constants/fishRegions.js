// src/constants/fishRegions.js
// Central source of truth for region labels and fish lists.

export const REGION_LABELS = {
  ferkensbruch: "Vereinsgewässer",
  inland: "Binnen (Deutschland)",
  holland: "Niederlande (Binnen & Polder)",
  northsea_de: "Nordsee (DE)",
  baltic_de: "Ostsee (DE)",
  med: "Mittelmeer (Kreta)",
  norway: "Norwegen (Salzwasser)",
};

const FERKENSBRUCH_FISH = [
"Aal", "Barsch", "Brasse", "Gründling", "Güster", "Hecht", "Karausche", "Karpfen",
"Rotauge", "Rotfeder", "Schleie", "Wels", "Zander",
];

const INLAND_FISH = [
"Aal", "Barsch", "Brasse", "Forelle", "Güster", "Gründling", "Grundel", "Hecht", "Karausche", "Karpfen",
"Rotauge", "Rotfeder", "Schleie", "Wels", "Zander",
];

const HOLLAND_FISH = [
  "Aal", "Barsch", "Brasse", "Döbel", "Hecht", "Karpfen", "Nase", "Quappe",
  "Rapfen", "Rotauge", "Rotfeder", "Schleie", "Wels", "Zander",
];

const MEDITERRANEAN_FISH = [
  "Amberjack (Bernsteinfisch) (Seriola dumerili – Μαγιάτικο)",
  "Barrakuda (Sphyraena viridensis – Λούτσος)",
  "Bluefish (Blaufisch) (Pomatomus saltatrix – Γαύρος ή Λαυράκι της θάλασσας)",
  "Bonito (Sarda sarda – Πελές ή Παλαμίδα)",
  "Comber (Serranus cabrilla – Σαργομπαλάς)",
  "Dorade (Goldbrasse) (Sparus aurata – Τσιπούρα)",
  "Fagri (Rotbrasse) (Pagrus pagrus – Φαγκρί)",
  "Feuerfisch (Pterois miles – Λεοντόψαρο)",
  "Makrele (Scomber scombrus – Σκουμπρί)",
  "Meeräsche (Mugil cephalus – Κέφαλος)",
  "Meerjunker (Coris julis – Γαϊδουρόψαρο)",
  "Oktopus (Octopus vulgaris – Χταπόδι)",
  "Pandora (Pagellus erythrinus – Λυθρίνι)",
  "Petermännchen (Trachinus draco – Δράκαινα)",
  "Rotbarbe (Mullus surmuletus – Μπαρμπούνι)",
  "Rotzahn-Doktorfisch (Skaros) (Sparisoma cretense – Σκάρος)",
  "Sardine (Sardina pilchardus – Σαρδέλα)",
  "Scharfbrasse (Diplodus puntazzo – Σαργός)",
  "Sepia (Sepia officinalis – Σουπιά)",
  "Skorpionfisch (Scorpaena notata – Σκορπίδι)",
  "Thunfisch (Thunnus thynnus – Τόνος)",
  "Tintenfisch (Kalmar) (Loligo vulgaris – Καλαμάρι)",
  "Weißbrasse (Diplodus sargus – Σπάρος)",
  "Wolfsbarsch (Seebarsch) (Dicentrarchus labrax – Λαβράκι)",
  "Zackenbarsch (Epinephelus costae – Σφυρίδα)"
];

const NORWAY_FISH = [
"Dorsch (Kabeljau)", "Seelachs (Köhler)", "Leng", "Lumb", "Rotbarsch",
"Heilbutt", "Seeteufel", "Makrele", "Scholle", "Steinbeißer", "Seehecht",
];

const NORTH_SEA_DE_FISH = [
"Dorsch (Kabeljau)", "Wittling", "Seelachs (Köhler)", "Makrele",
"Scholle", "Kliesche", "Flunder", "Steinbutt", "Seezunge",
"Hering", "Meeräsche", "Seehecht", "Seeteufel",
];

const BALTIC_SEA_DE_FISH = [
"Dorsch (Kabeljau)", "Hering", "Hornhecht", "Meerforelle",
"Lachs", "Scholle", "Flunder", "Kliesche", "Steinbutt",
"Aal", "Plattfisch (allg.)",
];

export function fishListForRegion(region) {
switch (region) {
case "ferkensbruch": return FERKENSBRUCH_FISH;
case "inland": return INLAND_FISH;
case "holland": return HOLLAND_FISH;
case "northsea_de": return NORTH_SEA_DE_FISH;
case "baltic_de": return BALTIC_SEA_DE_FISH;
case "med": return MEDITERRANEAN_FISH;
case "norway": return NORWAY_FISH;
default: return FERKENSBRUCH_FISH;
}
}
