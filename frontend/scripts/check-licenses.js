// Script to check copyleft licenses

import { init } from 'license-checker-rseidelsohn';

const ALLOWED_LICENSES = [
  'MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 
  'Unlicense', 'CC0-1.0', 'MIT-0', 'MPL-2.0', '0BSD', 'Python-2.0', 'BlueOak-1.0.0', 'OFL-1.1', 'CC-BY-4.0', 'CC-BY-3.0'
];

const IGNORED_PACKAGES = [
];

function main() {
  console.log('Scan dependencies.\n');

  init({
    start: '.',
    production: false,
  }, function(err, packages) {
    if (err) {
      console.error('Error during license scan:', err);
      process.exit(1);
    }

    const violations = [];
    const scannedPackages = Object.entries(packages);

    for (const [nameWithVersion, details] of scannedPackages) {
      const packageName = nameWithVersion.substring(0, nameWithVersion.lastIndexOf('@'));
      
      if (IGNORED_PACKAGES.includes(packageName)) continue;

      const licenses = Array.isArray(details.licenses) 
        ? details.licenses 
        : [details.licenses];

      const hasUnallowedLicense = licenses.some(lic => {
        if (!lic) return true;
        
        const cleanLic = lic.replace(/\*/g, '').trim();
        return !ALLOWED_LICENSES.some(allowed => cleanLic.toLowerCase().includes(allowed.toLowerCase()));
      });

      if (hasUnallowedLicense) {
        violations.push({
          package: nameWithVersion,
          license: details.licenses || 'UNBEKANNT',
          repository: details.repository || 'Keine URL gefunden'
        });
      }
    }

    if (violations.length > 0) {
      console.error('\x1b[31m%s\x1b[0m', '❌ Attention! Some dependencies have critical licenses:');
      console.table(violations);
      console.error('\x1b[31m%s\x1b[0m', `\nThe buiild will fail in CI/CD because of ${violations.length} blockers.`);
      process.exit(1); // CI fails
    } else {
      console.log('\x1b[32m%s\x1b[0m', `✅ Everything is fine! ${scannedPackages.length} dependencies scanned, all licenses are allowed.`);
      process.exit(0); // CI succeeds
    }
  });
}

main();
