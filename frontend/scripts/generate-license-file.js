import { init } from 'license-checker-rseidelsohn';
import fs from 'fs';

function main() {
  console.log('Generating THIRD_PARTY_LICENSES.md file...');

  init({
    start: '.',
    production: true, // Only log production dependencies
    customFormat: {
      licenseText: true,
      repository: true,
      publisher: true
    }
  }, function(err, packages) {
    if (err) {
      console.error('Error during license scan:', err);
      process.exit(1);
    }

    const scannedPackages = Object.entries(packages);
    
    // Markdown Header
    let markdownOutput = `# Third-Party License Notices\n\n`;
    markdownOutput += `This project contains third-party software components licensed under various open-source licenses. Below is the list of components and their full license text as required by their respective terms.\n\n---\n\n`;

    for (const [nameWithVersion, details] of scannedPackages) {
      const lastAtIndex = nameWithVersion.lastIndexOf('@');
      let packageName = nameWithVersion;
      
      if (lastAtIndex > 0) {
        packageName = nameWithVersion.substring(0, lastAtIndex);
      }

      // Skip your own application package if it gets picked up by the checker
      if (packageName === 'my-backend-project' || packageName === '') {
        continue;
      }

      const licenses = Array.isArray(details.licenses) ? details.licenses : [details.licenses];

      // Build the section for each package (now using packageName instead of nameWithVersion)
      markdownOutput += `## ${packageName}\n`;
      markdownOutput += `- **License:** ${licenses.join(', ')}\n`;
      if (details.publisher) markdownOutput += `- **Author/Publisher:** ${details.publisher}\n`;
      if (details.repository) markdownOutput += `- **Repository:** ${details.repository}\n`;
      markdownOutput += `\n### License Text\n\`\`\`text\n`;
      
      const bodyText = details.licenseText || `Refer to the official repository for the full license terms.`;
      markdownOutput += `${bodyText.trim()}\n\`\`\`\n\n---\n\n`;
    }

    try {
      // Ensure it writes to the correct path configured in your script
      fs.writeFileSync('./THIRD_PARTY_LICENSES.md', markdownOutput, 'utf-8');
      console.log('\x1b[32m%s\x1b[0m', '✅ Success: THIRD_PARTY_LICENSES.md has been generated in your root folder.');
      process.exit(0);
    } catch (writeErr) {
      console.error('Error writing the license file:', writeErr);
      process.exit(1);
    }
  });
}

main();
