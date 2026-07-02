/* ============================================================================
   PracticeOS — POS VehDB (base de données véhicules + décodage VIN)
   ----------------------------------------------------------------------------
   Module d'identification du véhicule à partir du VIN (17 caractères) :
     • Table WMI (World Manufacturer Identifier, caractères 1-3) ≈ 90 entrées
       couvrant les constructeurs courants EU / US / JP / KR.
     • Décodage de l'année-modèle (caractère 10, cycle 1980/2010).
     • Dataset embarqué ≈ 170 véhicules populaires et iconiques (marché EU en
       priorité) avec le schéma véhicule complet du contrat.
     • Estimation par segment (fallback) : TOUT VIN valide produit une fiche,
       marquée estimated:true si le modèle exact n'est pas connu.

   API publique (POS.registry.get('vehdb')) :
     identify(vin)   → {vin, make, year, exact, vehicle?, candidates?} | {error}
                       Décode WMI + année. Si des modèles de la marque sont en
                       base → candidates triés par popularité et vehicle = le
                       plus probable. Émet 'vehicle:identified' si un mapping
                       vin→vehicleId a déjà été confirmé (exact:true).
     confirm(vin,id) → l'utilisateur choisit le bon modèle ; persiste le
                       mapping (gset 'vehdb:vinMap') et émet 'vehicle:identified'.
     makes()         → liste des marques présentes en base.
     models(make)    → modèles d'une marque, triés par popularité décroissante.
     byId(id)        → véhicule par identifiant interne (ou null).
     estimate(seg)   → fiche moyenne plausible d'un segment (estimated:true).
     all()/count()   → dataset complet / taille.
     destroy()       → retire les listeners du bus (nettoyage).

   Événements bus :
     écoute 'obd:vin' {vin}            → identify(vin) automatique (spec n°2)
     émet   'vehicle:identified' {vehicle}

   Schéma véhicule (contrat) :
     {vin,make,model,year,segment,
      dims:{lengthMM,widthMM,heightMM,wheelbaseMM,trackMM},
      weightKG,turningRadiusM,wheels:{diamIN,widthMM},
      drivetrain:'FWD'|'RWD'|'AWD',
      engine:{type:'essence'|'diesel'|'hybride'|'électrique',
              displacementL,cylinders,powerHP,torqueNM},
      transmission:{type:'manuelle'|'auto'|'CVT'|'direct',gears},
      perf:{topSpeedKMH,accel0100S},fuel:{tankL,battKWH},estimated:boolean}

   Dépend uniquement de pos-core.js (chargé avant). IIFE ES2017, aucun build.
   ============================================================================ */
(function () {
  'use strict';

  var MAP_KEY = 'vehdb:vinMap'; // stockage global : {vin → vehicleId confirmé}

  /* ---------- dictionnaires de codes compacts ------------------------------ */
  var SEG = { c: 'citadine', k: 'compacte', b: 'berline', w: 'break',
              s: 'SUV', p: 'sportive', h: 'hypercar', u: 'utilitaire' };
  var DT  = { F: 'FWD', R: 'RWD', A: 'AWD' };
  var ENG = { e: 'essence', d: 'diesel', h: 'hybride', z: 'électrique' };
  var TR  = { m: 'manuelle', a: 'auto', c: 'CVT', d: 'direct' };

  /* ---------- table WMI (caractères 1-3 du VIN) ----------------------------
     Correspondance exacte sur 3 caractères, puis repli sur 2 caractères.    */
  var WMI3 = {
    /* France / Roumanie */
    VF1: 'Renault', VF3: 'Peugeot', VF6: 'Renault Trucks', VF7: 'Citroën',
    VF9: 'Bugatti', VFA: 'Alpine', VNK: 'Toyota', VR1: 'DS', VR3: 'Peugeot',
    VR7: 'Citroën', UU1: 'Dacia',
    /* Allemagne */
    WVW: 'Volkswagen', WV1: 'Volkswagen', WV2: 'Volkswagen',
    WAU: 'Audi', WA1: 'Audi', WBA: 'BMW', WBS: 'BMW', WBY: 'BMW',
    WMW: 'Mini', WDB: 'Mercedes-Benz', WDD: 'Mercedes-Benz',
    WDC: 'Mercedes-Benz', W1K: 'Mercedes-Benz', W1N: 'Mercedes-Benz',
    WME: 'Smart', WP0: 'Porsche', WP1: 'Porsche', W0L: 'Opel', W0V: 'Opel',
    WF0: 'Ford',
    /* Italie */
    ZFA: 'Fiat', ZFF: 'Ferrari', ZAR: 'Alfa Romeo', ZHW: 'Lamborghini',
    ZAM: 'Maserati', ZLA: 'Lancia',
    /* Espagne */
    VSS: 'SEAT', VSX: 'Opel', VSK: 'Nissan',
    /* Tchéquie / Hongrie */
    TMB: 'Škoda', TRU: 'Audi', TMA: 'Hyundai', TSM: 'Suzuki',
    /* Royaume-Uni */
    SAL: 'Land Rover', SAJ: 'Jaguar', SB1: 'Toyota', SCC: 'Lotus',
    SBM: 'McLaren', SCF: 'Aston Martin', SCB: 'Bentley', SCA: 'Rolls-Royce',
    SHS: 'Honda', SJN: 'Nissan',
    /* Suède */
    YV1: 'Volvo', YV4: 'Volvo', YS3: 'Saab',
    /* Japon */
    JHM: 'Honda', JHG: 'Honda', JHL: 'Honda', JN1: 'Nissan', JN8: 'Nissan',
    JF1: 'Subaru', JMB: 'Mitsubishi', JMZ: 'Mazda', JM1: 'Mazda',
    JSA: 'Suzuki', JTD: 'Toyota', JTE: 'Toyota', JTM: 'Toyota',
    JTN: 'Toyota', JTH: 'Lexus', JTJ: 'Lexus',
    /* Corée */
    KMH: 'Hyundai', KM8: 'Hyundai', KNA: 'Kia', KNB: 'Kia', KND: 'Kia',
    KNE: 'Kia', KPT: 'SsangYong',
    /* USA / Canada / Mexique */
    '1FA': 'Ford', '1FT': 'Ford', '1FM': 'Ford', '1FD': 'Ford',
    '1G1': 'Chevrolet', '1GC': 'Chevrolet', '1G6': 'Cadillac',
    '1HG': 'Honda', '1N4': 'Nissan', '1N6': 'Nissan',
    '1J4': 'Jeep', '1C4': 'Jeep', '1C3': 'Chrysler',
    '4T1': 'Toyota', '4S3': 'Subaru', '4JG': 'Mercedes-Benz',
    '5YJ': 'Tesla', '7SA': 'Tesla', XP7: 'Tesla', '5UX': 'BMW',
    '2HG': 'Honda', '2T1': 'Toyota', '3VW': 'Volkswagen', '3FA': 'Ford'
  };
  /* repli sur les 2 premiers caractères (familles de WMI) */
  var WMI2 = {
    JT: 'Toyota', JM: 'Mazda', JS: 'Suzuki', JH: 'Honda', JN: 'Nissan',
    JF: 'Subaru', KN: 'Kia', KM: 'Hyundai',
    '1G': 'General Motors', '2G': 'General Motors', KL: 'Chevrolet'
  };

  /* ---------- année-modèle : caractère 10 ----------------------------------
     Table standard : A=2010 … Y=2030 (I,O,Q,U,Z et 0 interdits),
     chiffres 1-9 = 2001-2009. Le code se répète tous les 30 ans (cycle
     1980/2010) : si l'année décodée dépasse l'année courante + 1, on
     retranche 30 (ex. 'A' en 2026 → 2010, pas 1980 ; 'S' → 2025).          */
  var YEARC = { A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015,
                G: 2016, H: 2017, J: 2018, K: 2019, L: 2020, M: 2021,
                N: 2022, P: 2023, R: 2024, S: 2025, T: 2026, V: 2027,
                W: 2028, X: 2029, Y: 2030 };

  /* segment le plus courant par marque SANS modèle en base (fallback) */
  var MAKE_SEG = {
    Maserati: 'sportive', Bentley: 'berline', 'Rolls-Royce': 'berline',
    Smart: 'citadine', Chevrolet: 'berline', Cadillac: 'berline',
    'General Motors': 'berline', Jeep: 'SUV', Chrysler: 'berline',
    Subaru: 'SUV', Mitsubishi: 'SUV', SsangYong: 'SUV', Saab: 'berline',
    Lancia: 'citadine', Lexus: 'berline', DS: 'SUV',
    'Renault Trucks': 'utilitaire'
  };

  /* ---------- dataset embarqué ---------------------------------------------
     Format compact (1 ligne = 1 véhicule) pour rester < 150 Ko :
     [model, année, seg, longMM, largMM, hautMM, empatMM, voieMM, poidsKG,
      rayonM, roueIN, pneuMM, transmission(F/R/A), moteur(e/d/h/z), cylL,
      nbCyl, chHP, coupleNM, boîte(m/a/c/d), rapports, vmaxKMH, 0-100s,
      réservoirL, battKWH, popularité]
     Valeurs plausibles constructeur (fiches presse / homologation UE).     */
  var DATA = {
    'Renault': [
      ['Clio V', 2023, 'c', 4053, 1798, 1440, 2583, 1533, 1178, 10.6, 16, 195, 'F', 'e', 1.0, 3, 90, 160, 'm', 6, 187, 12.2, 42, 0, 100],
      ['Captur', 2023, 's', 4227, 1797, 1576, 2639, 1560, 1234, 11.1, 17, 205, 'F', 'e', 1.3, 4, 140, 260, 'a', 7, 196, 9.6, 48, 0, 90],
      ['Mégane IV', 2020, 'k', 4359, 1814, 1447, 2669, 1591, 1280, 11.2, 16, 205, 'F', 'e', 1.3, 4, 140, 260, 'm', 6, 205, 9.2, 50, 0, 70],
      ['Mégane E-Tech', 2023, 'k', 4199, 1768, 1505, 2685, 1560, 1636, 10.4, 18, 215, 'F', 'z', 0, 0, 220, 300, 'd', 1, 160, 7.4, 0, 60, 65],
      ['Arkana', 2023, 's', 4568, 1821, 1571, 2720, 1580, 1336, 11.4, 17, 215, 'F', 'h', 1.6, 4, 145, 250, 'a', 6, 172, 10.8, 50, 1.2, 55],
      ['Austral', 2023, 's', 4510, 1825, 1618, 2667, 1585, 1517, 10.1, 19, 235, 'F', 'h', 1.2, 3, 200, 205, 'a', 6, 175, 8.4, 55, 2, 50],
      ['Zoe', 2021, 'c', 4087, 1787, 1562, 2588, 1511, 1502, 10.6, 16, 195, 'F', 'z', 0, 0, 135, 245, 'd', 1, 140, 9.5, 0, 52, 55],
      ['Twingo III', 2020, 'c', 3615, 1646, 1541, 2492, 1425, 940, 8.6, 15, 185, 'R', 'e', 1.0, 3, 71, 91, 'm', 5, 151, 15.1, 35, 0, 45],
      ['Scénic E-Tech', 2024, 's', 4470, 1864, 1571, 2785, 1600, 1842, 11.0, 19, 215, 'F', 'z', 0, 0, 218, 300, 'd', 1, 170, 8.4, 0, 87, 40],
      ['Kangoo', 2022, 'u', 4486, 1860, 1838, 2716, 1560, 1428, 11.4, 16, 205, 'F', 'd', 1.5, 4, 95, 260, 'm', 6, 164, 14.0, 54, 0, 40],
      ['Master', 2022, 'u', 5548, 2070, 2499, 3682, 1750, 1950, 13.7, 16, 225, 'F', 'd', 2.3, 4, 135, 360, 'm', 6, 157, 13.5, 80, 0, 35],
      ['Espace', 2024, 's', 4722, 1843, 1645, 2738, 1590, 1587, 11.6, 19, 235, 'F', 'h', 1.2, 3, 200, 205, 'a', 6, 175, 8.8, 55, 2, 25]
    ],
    'Peugeot': [
      ['208', 2023, 'c', 4055, 1745, 1430, 2540, 1530, 1090, 10.4, 16, 195, 'F', 'e', 1.2, 3, 100, 205, 'm', 6, 188, 9.9, 44, 0, 100],
      ['e-208', 2023, 'c', 4055, 1745, 1430, 2540, 1530, 1455, 10.4, 16, 195, 'F', 'z', 0, 0, 136, 260, 'd', 1, 150, 8.1, 0, 50, 60],
      ['2008', 2023, 's', 4300, 1770, 1550, 2605, 1550, 1205, 10.4, 17, 215, 'F', 'e', 1.2, 3, 130, 230, 'a', 8, 196, 9.1, 44, 0, 85],
      ['308', 2023, 'k', 4367, 1852, 1441, 2675, 1580, 1264, 10.6, 17, 225, 'F', 'e', 1.2, 3, 130, 230, 'a', 8, 210, 9.7, 52, 0, 75],
      ['3008', 2023, 's', 4447, 1841, 1624, 2675, 1601, 1320, 10.7, 18, 225, 'F', 'e', 1.2, 3, 130, 230, 'a', 8, 188, 10.8, 53, 0, 90],
      ['5008', 2023, 's', 4641, 1844, 1646, 2840, 1601, 1430, 11.2, 18, 225, 'F', 'e', 1.2, 3, 130, 230, 'a', 8, 188, 11.5, 56, 0, 55],
      ['508', 2023, 'b', 4750, 1859, 1403, 2793, 1601, 1420, 10.8, 18, 225, 'F', 'e', 1.6, 4, 180, 250, 'a', 8, 235, 8.3, 62, 0, 40],
      ['Partner', 2022, 'u', 4403, 1848, 1796, 2785, 1553, 1430, 11.0, 16, 205, 'F', 'd', 1.5, 4, 100, 250, 'm', 6, 172, 12.9, 61, 0, 45],
      ['Rifter', 2022, 'u', 4403, 1848, 1878, 2785, 1553, 1467, 10.8, 16, 205, 'F', 'd', 1.5, 4, 130, 300, 'a', 8, 184, 11.0, 61, 0, 30]
    ],
    'Citroën': [
      ['C3', 2022, 'c', 3996, 1749, 1474, 2540, 1530, 1090, 10.7, 16, 195, 'F', 'e', 1.2, 3, 83, 118, 'm', 5, 173, 12.8, 45, 0, 85],
      ['C3 Aircross', 2022, 's', 4155, 1765, 1637, 2604, 1550, 1213, 10.8, 16, 205, 'F', 'e', 1.2, 3, 110, 205, 'm', 6, 183, 10.9, 45, 0, 50],
      ['C4', 2022, 'k', 4360, 1800, 1525, 2670, 1580, 1264, 10.9, 18, 195, 'F', 'e', 1.2, 3, 130, 230, 'a', 8, 208, 9.4, 50, 0, 55],
      ['C5 Aircross', 2022, 's', 4500, 1840, 1670, 2730, 1590, 1430, 11.2, 18, 235, 'F', 'h', 1.6, 4, 225, 320, 'a', 8, 225, 8.7, 43, 13.2, 45],
      ['Berlingo', 2022, 'u', 4403, 1848, 1844, 2785, 1553, 1467, 10.8, 16, 205, 'F', 'd', 1.5, 4, 100, 250, 'm', 6, 172, 12.5, 61, 0, 45],
      ['Jumpy', 2022, 'u', 4959, 1920, 1948, 3275, 1630, 1786, 12.4, 16, 215, 'F', 'd', 2.0, 4, 145, 370, 'a', 8, 170, 12.0, 70, 0, 25]
    ],
    'Dacia': [
      ['Sandero', 2023, 'c', 4088, 1848, 1499, 2604, 1560, 1114, 10.5, 15, 185, 'F', 'e', 1.0, 3, 90, 160, 'm', 6, 175, 11.7, 50, 0, 95],
      ['Duster', 2023, 's', 4341, 1804, 1693, 2673, 1570, 1298, 10.7, 16, 215, 'F', 'e', 1.3, 4, 130, 240, 'm', 6, 190, 10.6, 50, 0, 80],
      ['Jogger', 2023, 'w', 4547, 1784, 1632, 2898, 1570, 1226, 11.1, 16, 205, 'F', 'e', 1.0, 3, 110, 200, 'm', 6, 183, 10.5, 50, 0, 45],
      ['Spring', 2023, 'c', 3734, 1622, 1516, 2423, 1385, 984, 9.6, 14, 165, 'F', 'z', 0, 0, 45, 125, 'd', 1, 125, 19.1, 0, 27, 40]
    ],
    'Volkswagen': [
      ['Polo', 2023, 'c', 4074, 1751, 1451, 2548, 1525, 1165, 10.6, 15, 185, 'F', 'e', 1.0, 3, 95, 175, 'm', 5, 187, 10.8, 40, 0, 90],
      ['Golf 8', 2023, 'k', 4284, 1789, 1456, 2636, 1549, 1255, 10.9, 16, 205, 'F', 'e', 1.5, 4, 130, 200, 'm', 6, 224, 9.2, 50, 0, 100],
      ['Golf GTI', 2023, 'p', 4287, 1789, 1463, 2627, 1549, 1414, 11.1, 18, 225, 'F', 'e', 2.0, 4, 245, 370, 'a', 7, 250, 6.3, 50, 0, 60],
      ['Golf R', 2023, 'p', 4290, 1789, 1458, 2628, 1549, 1551, 11.1, 19, 235, 'A', 'e', 2.0, 4, 320, 420, 'a', 7, 270, 4.7, 55, 0, 45],
      ['Tiguan', 2023, 's', 4509, 1839, 1675, 2681, 1582, 1490, 11.5, 17, 215, 'F', 'e', 1.5, 4, 150, 250, 'a', 7, 200, 9.2, 58, 0, 85],
      ['T-Roc', 2023, 's', 4236, 1819, 1584, 2590, 1546, 1270, 11.1, 16, 205, 'F', 'e', 1.0, 3, 110, 200, 'm', 6, 187, 10.8, 50, 0, 70],
      ['Passat SW', 2023, 'w', 4767, 1832, 1456, 2786, 1584, 1450, 11.7, 17, 215, 'F', 'd', 2.0, 4, 150, 360, 'a', 7, 220, 8.9, 66, 0, 50],
      ['ID.3', 2023, 'k', 4261, 1809, 1568, 2770, 1556, 1812, 10.2, 18, 215, 'R', 'z', 0, 0, 204, 310, 'd', 1, 160, 7.3, 0, 58, 55],
      ['ID.4', 2023, 's', 4584, 1852, 1640, 2766, 1580, 2124, 10.2, 19, 235, 'R', 'z', 0, 0, 204, 310, 'd', 1, 160, 8.5, 0, 77, 50],
      ['Touran', 2022, 'w', 4527, 1829, 1659, 2791, 1571, 1520, 11.9, 16, 205, 'F', 'e', 1.5, 4, 150, 250, 'a', 7, 209, 8.9, 58, 0, 40],
      ['Caddy', 2022, 'u', 4500, 1855, 1797, 2755, 1580, 1502, 11.4, 16, 205, 'F', 'd', 2.0, 4, 102, 280, 'm', 6, 173, 12.1, 50, 0, 35]
    ],
    'Audi': [
      ['A1', 2022, 'c', 4029, 1740, 1409, 2563, 1540, 1165, 10.6, 16, 195, 'F', 'e', 1.0, 3, 95, 175, 'm', 5, 191, 10.8, 40, 0, 50],
      ['A3', 2023, 'k', 4343, 1816, 1425, 2636, 1555, 1280, 10.9, 17, 225, 'F', 'e', 1.5, 4, 150, 250, 'a', 7, 232, 8.4, 50, 0, 70],
      ['A4', 2023, 'b', 4762, 1847, 1428, 2820, 1587, 1445, 11.6, 17, 225, 'F', 'e', 2.0, 4, 204, 320, 'a', 7, 241, 7.3, 54, 0, 55],
      ['Q3', 2023, 's', 4484, 1856, 1616, 2680, 1584, 1495, 11.8, 17, 215, 'F', 'e', 1.5, 4, 150, 250, 'a', 7, 207, 9.2, 58, 0, 60],
      ['Q5', 2023, 's', 4682, 1893, 1662, 2820, 1616, 1770, 11.7, 18, 235, 'A', 'd', 2.0, 4, 204, 400, 'a', 7, 222, 7.6, 70, 0, 50],
      ['RS3', 2023, 'p', 4389, 1851, 1436, 2631, 1592, 1570, 11.6, 19, 265, 'A', 'e', 2.5, 5, 400, 500, 'a', 7, 250, 3.8, 55, 0, 35],
      ['RS6 Avant', 2023, 'p', 4995, 1951, 1460, 2929, 1668, 2075, 12.1, 21, 275, 'A', 'e', 4.0, 8, 600, 800, 'a', 8, 250, 3.6, 73, 0, 30],
      ['e-tron GT', 2023, 'p', 4989, 1964, 1396, 2900, 1670, 2276, 11.6, 20, 245, 'A', 'z', 0, 0, 476, 630, 'a', 2, 245, 4.1, 0, 93, 25],
      ['TT', 2021, 'p', 4191, 1832, 1353, 2505, 1572, 1365, 11.0, 18, 245, 'F', 'e', 2.0, 4, 197, 320, 'a', 7, 241, 6.6, 55, 0, 30]
    ],
    'BMW': [
      ['Série 1', 2023, 'k', 4319, 1799, 1434, 2670, 1565, 1365, 11.4, 17, 225, 'F', 'e', 1.5, 3, 136, 230, 'a', 7, 213, 8.7, 42, 0, 60],
      ['Série 3 320d', 2023, 'b', 4709, 1827, 1442, 2851, 1587, 1545, 11.4, 18, 225, 'R', 'd', 2.0, 4, 190, 400, 'a', 8, 240, 7.1, 59, 0, 70],
      ['M3 Competition', 2023, 'p', 4794, 1903, 1433, 2857, 1617, 1730, 12.2, 19, 275, 'R', 'e', 3.0, 6, 510, 650, 'a', 8, 250, 3.9, 59, 0, 45],
      ['Série 5', 2023, 'b', 5060, 1900, 1515, 2995, 1631, 1725, 12.1, 18, 245, 'R', 'e', 2.0, 4, 208, 330, 'a', 8, 230, 7.5, 60, 0, 45],
      ['X1', 2023, 's', 4500, 1845, 1642, 2692, 1582, 1575, 11.7, 18, 225, 'F', 'e', 1.5, 3, 136, 230, 'a', 7, 208, 9.2, 45, 0, 55],
      ['X3', 2023, 's', 4708, 1891, 1676, 2864, 1616, 1825, 11.9, 19, 245, 'A', 'd', 2.0, 4, 190, 400, 'a', 8, 213, 7.9, 65, 0, 50],
      ['M4', 2023, 'p', 4794, 1887, 1393, 2857, 1617, 1725, 12.2, 19, 275, 'R', 'e', 3.0, 6, 510, 650, 'a', 8, 250, 3.9, 59, 0, 35],
      ['i4', 2023, 'b', 4783, 1852, 1448, 2856, 1600, 2125, 12.5, 18, 245, 'R', 'z', 0, 0, 340, 430, 'd', 1, 190, 5.7, 0, 84, 35],
      ['iX1', 2023, 's', 4500, 1845, 1616, 2692, 1582, 2085, 11.7, 18, 225, 'A', 'z', 0, 0, 313, 494, 'd', 1, 180, 5.6, 0, 66, 30],
      ['M2', 2023, 'p', 4580, 1887, 1403, 2747, 1617, 1700, 12.0, 19, 275, 'R', 'e', 3.0, 6, 460, 550, 'm', 6, 250, 4.3, 52, 0, 30]
    ],
    'Mercedes-Benz': [
      ['Classe A', 2023, 'k', 4419, 1796, 1440, 2729, 1567, 1355, 11.0, 17, 205, 'F', 'e', 1.3, 4, 163, 270, 'a', 7, 222, 8.2, 43, 0, 75],
      ['CLA', 2023, 'b', 4688, 1830, 1439, 2729, 1567, 1430, 11.2, 18, 225, 'F', 'e', 1.3, 4, 163, 270, 'a', 7, 229, 8.4, 43, 0, 45],
      ['Classe C', 2023, 'b', 4751, 1820, 1438, 2865, 1601, 1625, 11.1, 18, 225, 'R', 'e', 1.5, 4, 204, 300, 'a', 9, 246, 7.3, 66, 0, 60],
      ['Classe E', 2023, 'b', 4949, 1880, 1468, 2961, 1634, 1780, 11.6, 18, 245, 'R', 'e', 2.0, 4, 258, 400, 'a', 9, 250, 6.4, 66, 0, 45],
      ['GLA', 2023, 's', 4410, 1834, 1611, 2729, 1567, 1465, 11.4, 18, 215, 'F', 'e', 1.3, 4, 163, 270, 'a', 7, 210, 8.7, 43, 0, 50],
      ['GLC', 2023, 's', 4716, 1890, 1640, 2888, 1627, 1845, 11.8, 19, 235, 'A', 'h', 2.0, 4, 313, 550, 'a', 9, 218, 6.7, 62, 0, 50],
      ['AMG A45 S', 2023, 'p', 4445, 1850, 1412, 2729, 1583, 1550, 11.6, 19, 245, 'A', 'e', 2.0, 4, 421, 500, 'a', 8, 270, 3.9, 51, 0, 30],
      ['EQA', 2023, 's', 4463, 1834, 1620, 2729, 1575, 2040, 11.4, 18, 235, 'F', 'z', 0, 0, 190, 385, 'd', 1, 160, 8.9, 0, 66, 30],
      ['Sprinter', 2022, 'u', 5932, 2020, 2351, 3924, 1740, 2200, 14.4, 16, 225, 'R', 'd', 2.0, 4, 143, 330, 'a', 9, 161, 13.0, 65, 0, 40]
    ],
    'Porsche': [
      ['911 Carrera (992)', 2023, 'p', 4519, 1852, 1300, 2450, 1587, 1505, 11.2, 20, 245, 'R', 'e', 3.0, 6, 385, 450, 'a', 8, 293, 4.2, 64, 0, 60],
      ['911 GT3 RS', 2023, 'p', 4572, 1900, 1322, 2457, 1620, 1450, 11.9, 20, 275, 'R', 'e', 4.0, 6, 525, 465, 'a', 7, 296, 3.2, 64, 0, 45],
      ['Taycan', 2023, 'b', 4963, 1966, 1395, 2900, 1690, 2205, 11.7, 20, 245, 'A', 'z', 0, 0, 476, 500, 'a', 2, 230, 4.9, 0, 93, 35],
      ['Cayenne', 2023, 's', 4930, 1983, 1698, 2895, 1680, 2110, 12.1, 20, 275, 'A', 'e', 3.0, 6, 353, 500, 'a', 8, 248, 6.1, 90, 0, 40],
      ['Macan', 2023, 's', 4726, 1922, 1621, 2807, 1655, 1845, 11.9, 19, 235, 'A', 'e', 2.0, 4, 265, 400, 'a', 7, 232, 6.4, 65, 0, 40],
      ['718 Cayman', 2022, 'p', 4379, 1801, 1295, 2475, 1536, 1365, 11.0, 19, 235, 'R', 'e', 2.0, 4, 300, 380, 'm', 6, 275, 5.1, 54, 0, 30]
    ],
    'Opel': [
      ['Corsa', 2023, 'c', 4060, 1765, 1435, 2538, 1530, 1090, 10.7, 16, 195, 'F', 'e', 1.2, 3, 100, 205, 'm', 6, 194, 9.9, 44, 0, 75],
      ['Astra', 2023, 'k', 4374, 1860, 1442, 2675, 1584, 1298, 11.0, 17, 225, 'F', 'e', 1.2, 3, 130, 230, 'a', 8, 210, 9.7, 52, 0, 50],
      ['Mokka', 2023, 's', 4151, 1791, 1534, 2557, 1548, 1200, 10.4, 17, 215, 'F', 'e', 1.2, 3, 130, 230, 'a', 8, 200, 9.1, 44, 0, 45],
      ['Grandland', 2023, 's', 4477, 1856, 1609, 2675, 1601, 1350, 10.7, 18, 225, 'F', 'e', 1.2, 3, 130, 230, 'a', 8, 188, 10.2, 53, 0, 35]
    ],
    'Fiat': [
      ['500', 2021, 'c', 3571, 1627, 1488, 2300, 1407, 980, 9.3, 15, 185, 'F', 'h', 1.0, 3, 70, 92, 'm', 6, 167, 13.8, 35, 0, 70],
      ['500e', 2022, 'c', 3632, 1683, 1527, 2322, 1440, 1365, 9.7, 16, 195, 'F', 'z', 0, 0, 118, 220, 'd', 1, 150, 9.0, 0, 42, 45],
      ['Panda', 2022, 'c', 3653, 1643, 1551, 2300, 1414, 980, 9.5, 14, 175, 'F', 'h', 1.0, 3, 70, 92, 'm', 6, 155, 14.7, 37, 0, 60],
      ['Tipo', 2021, 'k', 4532, 1792, 1497, 2636, 1545, 1270, 10.9, 16, 205, 'F', 'e', 1.0, 3, 100, 190, 'm', 6, 190, 11.8, 45, 0, 30],
      ['Ducato', 2022, 'u', 5413, 2050, 2254, 3450, 1810, 1930, 12.5, 16, 225, 'F', 'd', 2.2, 4, 140, 350, 'm', 6, 160, 13.5, 75, 0, 45]
    ],
    'Alfa Romeo': [
      ['Giulia', 2023, 'b', 4643, 1860, 1436, 2820, 1555, 1429, 10.8, 18, 225, 'R', 'e', 2.0, 4, 280, 400, 'a', 8, 240, 5.7, 58, 0, 30],
      ['Giulia Quadrifoglio', 2023, 'p', 4643, 1860, 1426, 2820, 1555, 1580, 10.8, 19, 245, 'R', 'e', 2.9, 6, 510, 600, 'a', 8, 307, 3.9, 58, 0, 25],
      ['Stelvio', 2023, 's', 4687, 1903, 1671, 2818, 1600, 1660, 11.7, 19, 235, 'A', 'e', 2.0, 4, 280, 400, 'a', 8, 230, 5.7, 64, 0, 25],
      ['Tonale', 2023, 's', 4528, 1835, 1601, 2636, 1570, 1445, 11.3, 18, 225, 'F', 'h', 1.5, 4, 160, 240, 'a', 7, 212, 8.8, 55, 0.8, 25]
    ],
    'Ferrari': [
      ['SF90 Stradale', 2022, 'h', 4710, 1972, 1186, 2650, 1679, 1570, 12.0, 20, 275, 'A', 'h', 4.0, 8, 1000, 800, 'a', 8, 340, 2.5, 68, 8, 30],
      ['296 GTB', 2023, 'h', 4565, 1958, 1187, 2600, 1665, 1470, 11.5, 20, 245, 'R', 'h', 3.0, 6, 830, 740, 'a', 8, 330, 2.9, 65, 7.5, 25],
      ['F8 Tributo', 2021, 'h', 4611, 1979, 1206, 2650, 1677, 1435, 11.7, 20, 245, 'R', 'e', 3.9, 8, 720, 770, 'a', 7, 340, 2.9, 78, 0, 25],
      ['Roma', 2022, 'p', 4656, 1974, 1301, 2670, 1652, 1570, 11.9, 20, 245, 'R', 'e', 3.9, 8, 620, 760, 'a', 8, 320, 3.4, 80, 0, 20],
      ['Purosangue', 2023, 's', 4973, 2028, 1589, 3018, 1737, 2033, 12.5, 22, 255, 'A', 'e', 6.5, 12, 725, 716, 'a', 8, 310, 3.3, 100, 0, 15]
    ],
    'Lamborghini': [
      ['Huracán EVO', 2022, 'h', 4520, 1933, 1165, 2620, 1668, 1422, 11.5, 20, 245, 'A', 'e', 5.2, 10, 640, 600, 'a', 7, 325, 2.9, 80, 0, 30],
      ['Revuelto', 2024, 'h', 4947, 2033, 1160, 2779, 1720, 1772, 12.6, 21, 265, 'A', 'h', 6.5, 12, 1015, 725, 'a', 8, 350, 2.5, 65, 3.8, 20],
      ['Urus', 2023, 's', 5112, 2016, 1638, 3003, 1695, 2200, 12.6, 21, 285, 'A', 'e', 4.0, 8, 650, 850, 'a', 8, 305, 3.6, 85, 0, 25]
    ],
    'Toyota': [
      ['Yaris', 2023, 'c', 3940, 1745, 1500, 2560, 1518, 1085, 10.2, 16, 195, 'F', 'h', 1.5, 3, 116, 120, 'c', 0, 175, 9.7, 36, 0.8, 90],
      ['Yaris Cross', 2023, 's', 4180, 1765, 1595, 2560, 1530, 1190, 10.5, 17, 205, 'F', 'h', 1.5, 3, 116, 120, 'c', 0, 170, 11.2, 36, 0.8, 70],
      ['Corolla', 2023, 'k', 4370, 1790, 1435, 2640, 1530, 1370, 10.9, 17, 225, 'F', 'h', 1.8, 4, 140, 185, 'c', 0, 180, 9.1, 43, 0.9, 70],
      ['C-HR', 2023, 's', 4362, 1832, 1564, 2640, 1550, 1420, 10.4, 18, 225, 'F', 'h', 1.8, 4, 140, 185, 'c', 0, 170, 9.9, 43, 0.9, 50],
      ['RAV4', 2023, 's', 4600, 1855, 1685, 2690, 1595, 1620, 11.4, 18, 225, 'A', 'h', 2.5, 4, 222, 221, 'c', 0, 180, 8.1, 55, 1.6, 55],
      ['Aygo X', 2023, 'c', 3700, 1740, 1510, 2430, 1520, 940, 9.4, 17, 175, 'F', 'e', 1.0, 3, 72, 93, 'm', 5, 158, 15.6, 35, 0, 45],
      ['Hilux', 2022, 'u', 5325, 1855, 1815, 3085, 1535, 2110, 12.8, 17, 265, 'A', 'd', 2.8, 4, 204, 500, 'a', 6, 175, 10.7, 80, 0, 40],
      ['GR Yaris', 2022, 'p', 3995, 1805, 1455, 2560, 1531, 1280, 10.6, 18, 225, 'A', 'e', 1.6, 3, 261, 360, 'm', 6, 230, 5.5, 50, 0, 40],
      ['GR Supra', 2022, 'p', 4379, 1854, 1299, 2470, 1594, 1495, 11.0, 19, 255, 'R', 'e', 3.0, 6, 340, 500, 'a', 8, 250, 4.3, 52, 0, 30]
    ],
    'Honda': [
      ['Civic', 2023, 'k', 4551, 1802, 1408, 2735, 1537, 1533, 11.4, 18, 235, 'F', 'h', 2.0, 4, 184, 315, 'c', 0, 180, 7.8, 40, 1.1, 55],
      ['Jazz', 2023, 'c', 4045, 1695, 1525, 2517, 1481, 1233, 10.1, 15, 185, 'F', 'h', 1.5, 4, 122, 253, 'c', 0, 175, 9.4, 40, 0.9, 45],
      ['CR-V', 2023, 's', 4706, 1866, 1684, 2700, 1590, 1785, 11.4, 18, 235, 'A', 'h', 2.0, 4, 184, 335, 'c', 0, 187, 9.4, 57, 1.1, 40],
      ['HR-V', 2023, 's', 4340, 1790, 1582, 2610, 1535, 1380, 11.3, 18, 225, 'F', 'h', 1.5, 4, 131, 253, 'c', 0, 170, 10.6, 40, 0.9, 35],
      ['Civic Type R', 2023, 'p', 4594, 1890, 1407, 2735, 1626, 1429, 11.8, 19, 265, 'F', 'e', 2.0, 4, 329, 420, 'm', 6, 275, 5.4, 47, 0, 35]
    ],
    'Nissan': [
      ['Micra', 2021, 'c', 3999, 1743, 1455, 2525, 1520, 1039, 10.0, 16, 195, 'F', 'e', 1.0, 3, 92, 160, 'm', 5, 180, 11.8, 41, 0, 45],
      ['Juke', 2023, 's', 4210, 1800, 1595, 2636, 1570, 1219, 10.6, 17, 205, 'F', 'e', 1.0, 3, 114, 200, 'm', 6, 180, 10.7, 46, 0, 50],
      ['Qashqai e-Power', 2023, 's', 4425, 1835, 1625, 2665, 1585, 1665, 11.1, 18, 215, 'F', 'h', 1.5, 3, 190, 330, 'd', 1, 170, 7.9, 55, 2.1, 75],
      ['X-Trail e-Power', 2023, 's', 4680, 1840, 1725, 2705, 1585, 1905, 11.1, 18, 235, 'A', 'h', 1.5, 3, 213, 330, 'd', 1, 180, 7.0, 55, 2.1, 40],
      ['Leaf', 2022, 'k', 4490, 1788, 1540, 2700, 1540, 1580, 11.0, 17, 215, 'F', 'z', 0, 0, 150, 320, 'd', 1, 144, 7.9, 0, 40, 40],
      ['GT-R', 2022, 'p', 4710, 1895, 1370, 2780, 1590, 1752, 11.7, 20, 255, 'A', 'e', 3.8, 6, 570, 637, 'a', 6, 315, 2.8, 74, 0, 30]
    ],
    'Mazda': [
      ['Mazda2', 2022, 'c', 4065, 1695, 1495, 2570, 1495, 1043, 9.8, 16, 185, 'F', 'e', 1.5, 4, 90, 148, 'm', 6, 183, 9.8, 44, 0, 40],
      ['Mazda3', 2023, 'k', 4460, 1795, 1435, 2725, 1570, 1339, 10.6, 18, 215, 'F', 'e', 2.0, 4, 122, 213, 'm', 6, 197, 10.4, 51, 0, 45],
      ['CX-30', 2023, 's', 4395, 1795, 1540, 2655, 1565, 1399, 10.6, 18, 215, 'F', 'e', 2.0, 4, 122, 213, 'm', 6, 186, 10.6, 51, 0, 40],
      ['CX-5', 2023, 's', 4575, 1845, 1680, 2700, 1595, 1533, 11.0, 19, 225, 'F', 'e', 2.0, 4, 165, 213, 'm', 6, 201, 9.9, 56, 0, 40],
      ['MX-5', 2023, 'p', 3915, 1735, 1230, 2310, 1495, 1049, 9.4, 17, 205, 'R', 'e', 2.0, 4, 184, 205, 'm', 6, 219, 6.5, 45, 0, 40]
    ],
    'Hyundai': [
      ['i10', 2022, 'c', 3670, 1680, 1480, 2425, 1479, 933, 9.6, 15, 175, 'F', 'e', 1.0, 3, 67, 96, 'm', 5, 156, 14.6, 36, 0, 45],
      ['i20', 2023, 'c', 4040, 1775, 1450, 2580, 1541, 1120, 10.2, 16, 195, 'F', 'e', 1.0, 3, 100, 172, 'm', 6, 188, 10.4, 40, 0, 50],
      ['i30', 2022, 'k', 4340, 1795, 1455, 2650, 1559, 1245, 10.6, 16, 205, 'F', 'e', 1.0, 3, 120, 172, 'm', 6, 190, 11.1, 50, 0, 40],
      ['Kona', 2023, 's', 4350, 1825, 1585, 2660, 1575, 1415, 10.6, 18, 215, 'F', 'h', 1.6, 4, 141, 265, 'a', 6, 165, 11.2, 38, 1.3, 55],
      ['Tucson', 2023, 's', 4500, 1865, 1650, 2680, 1608, 1541, 11.8, 18, 235, 'F', 'h', 1.6, 4, 230, 350, 'a', 6, 193, 8.0, 52, 1.5, 60],
      ['Ioniq 5', 2023, 's', 4635, 1890, 1605, 3000, 1628, 1985, 11.9, 19, 235, 'R', 'z', 0, 0, 229, 350, 'd', 1, 185, 7.3, 0, 77, 40],
      ['i30 N', 2022, 'p', 4340, 1795, 1451, 2650, 1559, 1429, 10.9, 19, 235, 'F', 'e', 2.0, 4, 280, 392, 'm', 6, 250, 5.9, 50, 0, 25]
    ],
    'Kia': [
      ['Picanto', 2022, 'c', 3595, 1595, 1485, 2400, 1403, 946, 9.4, 14, 175, 'F', 'e', 1.0, 3, 67, 96, 'm', 5, 161, 14.6, 35, 0, 40],
      ['Rio', 2022, 'c', 4065, 1725, 1450, 2580, 1530, 1110, 10.2, 15, 185, 'F', 'e', 1.0, 3, 100, 172, 'm', 6, 188, 10.3, 45, 0, 35],
      ['Ceed', 2022, 'k', 4310, 1800, 1447, 2650, 1559, 1250, 10.6, 16, 205, 'F', 'e', 1.0, 3, 120, 172, 'm', 6, 190, 11.1, 50, 0, 35],
      ['Sportage', 2023, 's', 4515, 1865, 1645, 2680, 1616, 1587, 11.8, 18, 235, 'F', 'h', 1.6, 4, 230, 350, 'a', 6, 193, 8.0, 52, 1.5, 55],
      ['Niro', 2023, 's', 4420, 1825, 1545, 2720, 1585, 1474, 10.6, 16, 205, 'F', 'h', 1.6, 4, 141, 265, 'a', 6, 161, 10.4, 42, 1.3, 40],
      ['EV6', 2023, 's', 4695, 1890, 1550, 2900, 1628, 2015, 11.6, 19, 235, 'R', 'z', 0, 0, 229, 350, 'd', 1, 185, 7.3, 0, 77, 35]
    ],
    'Ford': [
      ['Fiesta', 2022, 'c', 4068, 1735, 1476, 2493, 1505, 1176, 10.2, 16, 195, 'F', 'e', 1.0, 3, 100, 170, 'm', 6, 191, 10.8, 42, 0, 65],
      ['Focus', 2022, 'k', 4378, 1825, 1471, 2700, 1580, 1322, 11.0, 16, 215, 'F', 'e', 1.0, 3, 125, 200, 'm', 6, 200, 10.0, 52, 0, 55],
      ['Puma', 2023, 's', 4186, 1805, 1536, 2588, 1562, 1280, 10.5, 17, 215, 'F', 'e', 1.0, 3, 125, 210, 'm', 6, 191, 9.8, 42, 0, 60],
      ['Kuga', 2023, 's', 4614, 1883, 1666, 2710, 1586, 1602, 11.4, 18, 225, 'F', 'h', 2.5, 4, 190, 200, 'c', 0, 196, 9.2, 54, 1.1, 45],
      ['Mustang GT', 2022, 'p', 4789, 1916, 1381, 2720, 1595, 1739, 12.2, 19, 255, 'R', 'e', 5.0, 8, 450, 529, 'm', 6, 250, 4.8, 61, 0, 35],
      ['Focus ST', 2022, 'p', 4388, 1825, 1458, 2700, 1590, 1508, 11.0, 19, 235, 'F', 'e', 2.3, 4, 280, 420, 'm', 6, 250, 5.7, 52, 0, 25],
      ['Transit Custom', 2022, 'u', 5050, 1986, 2020, 3300, 1700, 1958, 11.6, 16, 215, 'F', 'd', 2.0, 4, 130, 385, 'm', 6, 165, 13.0, 70, 0, 45]
    ],
    'Tesla': [
      ['Model 3', 2023, 'b', 4720, 1850, 1441, 2875, 1580, 1765, 11.6, 18, 235, 'R', 'z', 0, 0, 283, 420, 'd', 1, 201, 6.1, 0, 60, 90],
      ['Model Y', 2023, 's', 4750, 1921, 1624, 2890, 1636, 1909, 12.1, 19, 255, 'R', 'z', 0, 0, 299, 420, 'd', 1, 217, 6.9, 0, 60, 85],
      ['Model S', 2022, 'b', 4970, 1964, 1445, 2960, 1662, 2069, 12.3, 19, 245, 'A', 'z', 0, 0, 670, 850, 'd', 1, 250, 3.2, 0, 100, 40],
      ['Model X', 2022, 's', 5057, 1999, 1684, 2965, 1700, 2352, 12.4, 20, 265, 'A', 'z', 0, 0, 670, 850, 'd', 1, 250, 3.9, 0, 100, 30]
    ],
    'Volvo': [
      ['XC40', 2023, 's', 4425, 1873, 1652, 2702, 1601, 1685, 11.4, 18, 235, 'F', 'e', 2.0, 4, 197, 300, 'a', 8, 180, 7.3, 54, 0, 45],
      ['XC60', 2023, 's', 4708, 1902, 1658, 2865, 1653, 1855, 11.4, 19, 235, 'A', 'h', 2.0, 4, 350, 659, 'a', 8, 180, 5.7, 71, 18.8, 40],
      ['V60', 2022, 'w', 4761, 1850, 1432, 2872, 1600, 1698, 11.4, 18, 235, 'F', 'e', 2.0, 4, 197, 300, 'a', 8, 180, 7.4, 60, 0, 30],
      ['EX30', 2024, 's', 4233, 1836, 1555, 2650, 1568, 1830, 10.6, 19, 235, 'R', 'z', 0, 0, 272, 343, 'd', 1, 180, 5.3, 0, 64, 30]
    ],
    'Škoda': [
      ['Fabia', 2023, 'c', 4108, 1780, 1459, 2564, 1531, 1131, 10.5, 15, 185, 'F', 'e', 1.0, 3, 95, 175, 'm', 5, 195, 10.6, 40, 0, 55],
      ['Octavia', 2023, 'b', 4689, 1829, 1470, 2686, 1543, 1330, 10.5, 16, 205, 'F', 'e', 1.5, 4, 150, 250, 'm', 6, 231, 8.2, 45, 0, 60],
      ['Kodiaq', 2023, 's', 4697, 1882, 1681, 2791, 1586, 1650, 12.2, 18, 235, 'A', 'd', 2.0, 4, 200, 400, 'a', 7, 210, 7.8, 58, 0, 40],
      ['Enyaq', 2023, 's', 4649, 1879, 1616, 2765, 1587, 2107, 10.9, 19, 235, 'R', 'z', 0, 0, 204, 310, 'd', 1, 160, 8.5, 0, 77, 35]
    ],
    'SEAT': [
      ['Ibiza', 2023, 'c', 4059, 1780, 1447, 2564, 1528, 1132, 10.6, 15, 185, 'F', 'e', 1.0, 3, 95, 175, 'm', 5, 187, 10.9, 40, 0, 55],
      ['Leon', 2023, 'k', 4368, 1800, 1456, 2686, 1547, 1266, 10.9, 16, 205, 'F', 'e', 1.5, 4, 130, 200, 'm', 6, 219, 9.4, 45, 0, 50],
      ['Arona', 2023, 's', 4138, 1780, 1552, 2566, 1528, 1166, 10.6, 16, 205, 'F', 'e', 1.0, 3, 110, 200, 'm', 6, 190, 10.0, 40, 0, 45],
      ['Ateca', 2022, 's', 4381, 1841, 1615, 2630, 1571, 1365, 10.9, 17, 215, 'F', 'e', 1.5, 4, 150, 250, 'a', 7, 201, 8.8, 50, 0, 35],
      ['Cupra Formentor', 2023, 's', 4450, 1839, 1511, 2680, 1571, 1509, 10.9, 18, 235, 'A', 'e', 2.0, 4, 310, 400, 'a', 7, 250, 4.9, 55, 0, 40]
    ],
    'Mini': [
      ['Cooper', 2022, 'c', 3876, 1727, 1414, 2495, 1501, 1210, 10.8, 16, 195, 'F', 'e', 1.5, 3, 136, 220, 'm', 6, 210, 8.2, 40, 0, 45]
    ],
    'Land Rover': [
      ['Defender 110', 2023, 's', 5018, 1996, 1967, 3022, 1702, 2248, 12.8, 19, 255, 'A', 'd', 3.0, 6, 250, 600, 'a', 8, 188, 8.0, 89, 0, 30],
      ['Range Rover Evoque', 2023, 's', 4371, 1904, 1649, 2681, 1631, 1787, 11.6, 18, 235, 'A', 'h', 1.5, 3, 309, 540, 'a', 8, 213, 6.4, 45, 15, 30]
    ],
    'Jaguar': [
      ['F-Type', 2022, 'p', 4470, 1923, 1311, 2622, 1585, 1660, 11.7, 19, 255, 'R', 'e', 5.0, 8, 450, 580, 'a', 8, 285, 4.6, 70, 0, 20]
    ],
    'Lotus': [
      ['Emira', 2023, 'p', 4412, 1895, 1225, 2575, 1615, 1405, 11.0, 20, 245, 'R', 'e', 3.5, 6, 400, 420, 'm', 6, 290, 4.3, 52, 0, 20]
    ],
    'Bugatti': [
      ['Chiron', 2021, 'h', 4544, 2038, 1212, 2711, 1749, 1996, 12.4, 20, 285, 'A', 'e', 8.0, 16, 1500, 1600, 'a', 7, 420, 2.4, 100, 0, 15]
    ],
    'McLaren': [
      ['720S', 2021, 'h', 4543, 1930, 1196, 2670, 1674, 1419, 12.0, 19, 245, 'R', 'e', 4.0, 8, 720, 770, 'a', 7, 341, 2.9, 72, 0, 20]
    ],
    'Aston Martin': [
      ['Vantage', 2022, 'p', 4465, 1942, 1273, 2704, 1650, 1530, 11.8, 20, 255, 'R', 'e', 4.0, 8, 510, 685, 'a', 8, 314, 3.6, 73, 0, 15]
    ],
    'Alpine': [
      ['A110', 2023, 'p', 4180, 1798, 1252, 2420, 1553, 1102, 11.0, 18, 215, 'R', 'e', 1.8, 4, 252, 320, 'a', 7, 250, 4.5, 45, 0, 35]
    ],
    'Suzuki': [
      ['Swift', 2022, 'c', 3840, 1735, 1495, 2450, 1530, 921, 9.6, 16, 185, 'F', 'h', 1.2, 4, 83, 107, 'm', 5, 180, 12.2, 37, 0, 35]
    ]
  };

  /* ---------- estimations par segment (fallback) ---------------------------
     Moyennes plausibles du segment ; toute fiche produite ici est marquée
     estimated:true → n'importe quel VIN valide donne une fiche exploitable. */
  var EST = {
    citadine:   { L: 4000, W: 1750, H: 1470, wb: 2550, tk: 1520, kg: 1100, tr: 10.4, wd: 16, ww: 195, dt: 'F', en: 'e', dl: 1.0, cy: 3, hp: 95,  nm: 170, tt: 'm', gr: 5, vm: 180, ac: 11.5, tl: 42, bt: 0 },
    compacte:   { L: 4350, W: 1800, H: 1450, wb: 2650, tk: 1560, kg: 1300, tr: 10.9, wd: 17, ww: 215, dt: 'F', en: 'e', dl: 1.3, cy: 4, hp: 130, nm: 230, tt: 'a', gr: 7, vm: 205, ac: 9.5,  tl: 50, bt: 0 },
    berline:    { L: 4800, W: 1850, H: 1440, wb: 2850, tk: 1600, kg: 1550, tr: 11.5, wd: 18, ww: 235, dt: 'R', en: 'e', dl: 2.0, cy: 4, hp: 200, nm: 350, tt: 'a', gr: 8, vm: 235, ac: 7.5,  tl: 60, bt: 0 },
    'break':    { L: 4750, W: 1840, H: 1470, wb: 2800, tk: 1590, kg: 1550, tr: 11.5, wd: 17, ww: 225, dt: 'F', en: 'd', dl: 2.0, cy: 4, hp: 150, nm: 360, tt: 'a', gr: 8, vm: 215, ac: 9.0,  tl: 60, bt: 0 },
    SUV:        { L: 4450, W: 1840, H: 1630, wb: 2670, tk: 1580, kg: 1500, tr: 11.2, wd: 18, ww: 225, dt: 'F', en: 'e', dl: 1.3, cy: 4, hp: 150, nm: 250, tt: 'a', gr: 7, vm: 195, ac: 9.5,  tl: 55, bt: 0 },
    sportive:   { L: 4450, W: 1850, H: 1350, wb: 2600, tk: 1590, kg: 1500, tr: 11.5, wd: 19, ww: 245, dt: 'R', en: 'e', dl: 3.0, cy: 6, hp: 400, nm: 500, tt: 'a', gr: 8, vm: 270, ac: 4.5,  tl: 60, bt: 0 },
    hypercar:   { L: 4600, W: 1980, H: 1190, wb: 2650, tk: 1670, kg: 1500, tr: 12.0, wd: 20, ww: 255, dt: 'A', en: 'e', dl: 4.0, cy: 8, hp: 750, nm: 750, tt: 'a', gr: 7, vm: 330, ac: 2.9,  tl: 75, bt: 0 },
    utilitaire: { L: 4900, W: 1950, H: 1900, wb: 3100, tk: 1650, kg: 1800, tr: 12.0, wd: 16, ww: 215, dt: 'F', en: 'd', dl: 2.0, cy: 4, hp: 130, nm: 340, tt: 'm', gr: 6, vm: 165, ac: 13.0, tl: 65, bt: 0 }
  };

  /* ---------- construction des index (une seule fois au boot) -------------- */
  var vehicles = [];  // tous les véhicules (objets au schéma complet + id/pop)
  var byIdMap  = {};  // id → véhicule
  var byMakeMap = {}; // marque → [véhicules]

  function slugify(s) {
    return String(s).toLowerCase()
      .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u').replace(/ç/g, 'c')
      .replace(/š/g, 's').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /* transforme une ligne compacte du dataset en objet véhicule complet */
  function rowToVehicle(make, r) {
    return {
      id: slugify(make) + '-' + slugify(r[0]) + '-' + r[1],
      vin: null,
      make: make, model: r[0], year: r[1], segment: SEG[r[2]],
      dims: { lengthMM: r[3], widthMM: r[4], heightMM: r[5],
              wheelbaseMM: r[6], trackMM: r[7] },
      weightKG: r[8], turningRadiusM: r[9],
      wheels: { diamIN: r[10], widthMM: r[11] },
      drivetrain: DT[r[12]],
      engine: { type: ENG[r[13]], displacementL: r[14], cylinders: r[15],
                powerHP: r[16], torqueNM: r[17] },
      transmission: { type: TR[r[18]], gears: r[19] },
      perf: { topSpeedKMH: r[20], accel0100S: r[21] },
      fuel: { tankL: r[22], battKWH: r[23] },
      estimated: false,
      pop: r[24] // popularité relative (interne, pour le tri des candidats)
    };
  }

  function buildIndexes() {
    var makes = Object.keys(DATA);
    for (var i = 0; i < makes.length; i++) {
      var make = makes[i], rows = DATA[make];
      byMakeMap[make] = [];
      for (var j = 0; j < rows.length; j++) {
        var v = rowToVehicle(make, rows[j]);
        vehicles.push(v);
        byIdMap[v.id] = v;
        byMakeMap[make].push(v);
      }
    }
  }

  /* ---------- décodage VIN -------------------------------------------------- */

  /* VIN valide = 17 caractères alphanumériques, sans I, O ni Q */
  function validVin(vin) {
    return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
  }

  /* marque via WMI : correspondance exacte 3 caractères, sinon famille 2 car. */
  function wmiMake(vin) {
    return WMI3[vin.slice(0, 3)] || WMI2[vin.slice(0, 2)] || null;
  }

  /* année-modèle via le caractère 10 (index 9) ; gestion du cycle de 30 ans */
  function decodeYear(vin) {
    var c = vin.charAt(9), y = null;
    if (c >= '1' && c <= '9') y = 2000 + (c.charCodeAt(0) - 48); // 1-9 → 2001-2009
    else if (YEARC[c] !== undefined) y = YEARC[c];               // A-Y → 2010-2030
    if (y === null) return null;
    /* si l'année dépasse l'année courante + 1 → cycle précédent (-30 ans) */
    var max = new Date().getFullYear() + 1;
    if (y > max) y -= 30;
    return y;
  }

  /* clone profond simple (objets de données uniquement) */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* copie d'un véhicule du dataset, personnalisée avec le VIN et son année */
  function materialize(v, vin, year) {
    var out = clone(v);
    delete out.pop; // champ interne, hors schéma public
    out.vin = vin;
    if (year) out.year = year;
    return out;
  }

  /* ---------- API ----------------------------------------------------------- */

  /* fiche moyenne plausible d'un segment (fallback universel) */
  function estimate(segment) {
    var e = EST[segment] || EST.compacte;
    var seg = EST[segment] ? segment : 'compacte';
    return {
      id: 'est-' + slugify(seg),
      vin: null, make: 'Inconnu', model: 'Estimation ' + seg,
      year: new Date().getFullYear(), segment: seg,
      dims: { lengthMM: e.L, widthMM: e.W, heightMM: e.H,
              wheelbaseMM: e.wb, trackMM: e.tk },
      weightKG: e.kg, turningRadiusM: e.tr,
      wheels: { diamIN: e.wd, widthMM: e.ww },
      drivetrain: DT[e.dt],
      engine: { type: ENG[e.en], displacementL: e.dl, cylinders: e.cy,
                powerHP: e.hp, torqueNM: e.nm },
      transmission: { type: TR[e.tt], gears: e.gr },
      perf: { topSpeedKMH: e.vm, accel0100S: e.ac },
      fuel: { tankL: e.tl, battKWH: e.bt },
      estimated: true
    };
  }

  /* identification complète d'un VIN */
  function identify(vin) {
    vin = String(vin || '').trim().toUpperCase();
    if (!validVin(vin)) {
      return { error: 'VIN invalide : 17 caractères requis, sans I, O ni Q', vin: vin };
    }
    var make = wmiMake(vin);
    var year = decodeYear(vin);
    var res = { vin: vin, make: make || 'Inconnu', year: year, exact: false };

    /* 1) mapping déjà confirmé par l'utilisateur → identification exacte */
    var map = POS.store.gget(MAP_KEY, {}) || {};
    var confirmedId = map[vin];
    if (confirmedId && byIdMap[confirmedId]) {
      res.exact = true;
      res.vehicle = materialize(byIdMap[confirmedId], vin, year);
      POS.bus.emit('vehicle:identified', { vehicle: res.vehicle });
      return res;
    }

    /* 2) la marque a des modèles en base → candidats triés par popularité */
    if (make && byMakeMap[make] && byMakeMap[make].length) {
      var cands = byMakeMap[make].slice().sort(function (a, b) { return b.pop - a.pop; });
      res.candidates = cands.map(function (c) { return materialize(c, vin, year); });
      res.vehicle = res.candidates[0]; // le plus probable (estimated:false)
      return res;
    }

    /* 3) marque inconnue ou sans modèle → estimation par segment courant */
    var seg = MAKE_SEG[make] || 'compacte';
    res.vehicle = estimate(seg);
    res.vehicle.vin = vin;
    res.vehicle.make = res.make;
    if (year) res.vehicle.year = year;
    return res;
  }

  /* l'utilisateur confirme le modèle exact pour ce VIN */
  function confirm(vin, vehicleId) {
    vin = String(vin || '').trim().toUpperCase();
    if (!validVin(vin)) {
      return { error: 'VIN invalide : 17 caractères requis, sans I, O ni Q', vin: vin };
    }
    var v = byIdMap[vehicleId];
    if (!v) return { error: 'Véhicule inconnu : ' + vehicleId, vin: vin };
    var map = POS.store.gget(MAP_KEY, {}) || {};
    map[vin] = vehicleId;
    POS.store.gset(MAP_KEY, map);
    var veh = materialize(v, vin, decodeYear(vin));
    POS.bus.emit('vehicle:identified', { vehicle: veh });
    return { vin: vin, exact: true, vehicle: veh };
  }

  /* liste des marques en base, triée alphabétiquement */
  function makes() {
    return Object.keys(byMakeMap).sort();
  }

  /* modèles d'une marque (insensible à la casse), triés par popularité */
  function models(make) {
    var key = null, mk = String(make || '').toLowerCase();
    for (var m in byMakeMap) {
      if (m.toLowerCase() === mk) { key = m; break; }
    }
    if (!key) return [];
    return byMakeMap[key].slice().sort(function (a, b) { return b.pop - a.pop; });
  }

  function byId(id) { return byIdMap[id] || null; }
  function all() { return vehicles.slice(); }
  function count() { return vehicles.length; }

  /* ---------- boot ----------------------------------------------------------- */
  var offVin = null; // désabonnement du listener 'obd:vin'

  var api = {
    identify: identify,
    confirm: confirm,
    makes: makes,
    models: models,
    byId: byId,
    estimate: estimate,
    all: all,
    count: count,
    /* nettoyage : retire les listeners du bus (anti-fuite mémoire) */
    destroy: function () { if (offVin) { offVin(); offVin = null; } },
    version: '1.0.0'
  };

  function boot() {
    buildIndexes();
    /* reconnaissance automatique du véhicule via le VIN remonté par l'OBD */
    offVin = POS.bus.on('obd:vin', function (d) {
      if (d && d.vin) identify(d.vin);
    });
    POS.registry.register('vehdb', api);
  }

  POS.ready(boot);
})();
