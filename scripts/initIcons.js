require('ts-node/register');
const path = require('path');
const { IconGenerator } = require('../src/services/iconGenerator');

const rootDir = path.join(__dirname, '..');

IconGenerator.initializeDefaultIcons(rootDir)
  .then(() => {
    console.log('Successfully generated default icons 1..10 in resources/icons/');
  })
  .catch((err) => {
    console.error('Failed to generate default icons:', err);
    process.exit(1);
  });
