/* Ajoute les autorisations iOS necessaires dans ios/App/App/Info.plist
   (camera pour la vision, Bluetooth pour l'OBD, position pour la carte).
   A LANCER SUR LE MAC, APRES `npx cap add ios`.  Outil local. */
const fs = require('fs');
const path = 'ios/App/App/Info.plist';

if (!fs.existsSync(path)) {
  console.error('Info.plist introuvable. Lance d\'abord :  npx cap add ios');
  process.exit(1);
}

const perms = {
  NSCameraUsageDescription:        'Practice utilise la camera arriere pour la vision ADAS (detection vehicules, pietons, panneaux).',
  NSMicrophoneUsageDescription:    'Practice peut utiliser le micro pour le copilote vocal.',
  NSLocationWhenInUseUsageDescription: 'Practice utilise ta position pour la carte et la navigation.',
  NSBluetoothAlwaysUsageDescription:   'Practice se connecte a ton lecteur OBD (ELM327) en Bluetooth pour lire les donnees du vehicule.',
  NSBluetoothPeripheralUsageDescription: 'Practice se connecte a ton lecteur OBD (ELM327) en Bluetooth pour lire les donnees du vehicule.'
};

let p = fs.readFileSync(path, 'utf8');
const idx = p.lastIndexOf('</dict>');
if (idx === -1) { console.error('Info.plist mal forme.'); process.exit(1); }

let block = '', added = [];
for (const k in perms) {
  if (p.indexOf('<key>' + k + '</key>') === -1) {
    block += '\t<key>' + k + '</key>\n\t<string>' + perms[k] + '</string>\n';
    added.push(k);
  }
}
if (block) { p = p.slice(0, idx) + block + p.slice(idx); fs.writeFileSync(path, p); }
console.log(added.length ? ('Permissions ajoutees : ' + added.join(', ')) : 'Permissions deja presentes.');
