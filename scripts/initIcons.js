const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'resources', 'icons');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

function generateSvg(label) {
  const cleanLabel = (label || '').trim().slice(0, 3).toUpperCase();
  let fontSize = 13.0;
  let lengthAttrs = '';

  if (cleanLabel.length === 1) {
    fontSize = 17.5;
  } else if (cleanLabel.length === 2) {
    fontSize = 14.5;
    lengthAttrs = ' textLength="17" lengthAdjust="spacingAndGlyphs"';
  } else if (cleanLabel.length >= 3) {
    fontSize = 13.0;
    lengthAttrs = ' textLength="20" lengthAdjust="spacingAndGlyphs"';
  }

  const escapedText = cleanLabel
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <defs>
    <mask id="folderMask">
      <rect width="24" height="24" fill="white"/>
      <text x="12" y="13.7" 
            font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
            font-size="${fontSize}" 
            font-weight="900"${lengthAttrs}
            text-anchor="middle" 
            dominant-baseline="central" 
            alignment-baseline="central" 
            fill="black">${escapedText}</text>
    </mask>
  </defs>
  <g mask="url(#folderMask)">
    <!-- Back folder flap -->
    <path fill="currentColor" fill-opacity="0.45" d="M1.5 3.5C1.5 2.67 2.17 2 3 2h5.5c.4 0 .78.16 1.06.44L11.5 4.5H21c.83 0 1.5.67 1.5 1.5V7H1.5V3.5z"/>
    <!-- Front folder card maximized in size -->
    <path fill="currentColor" d="M1 6h22v15c0 .83-.67 1.5-1.5 1.5H2.5c-.83 0-1.5-.67-1.5-1.5V6z"/>
  </g>
</svg>`;
}

for (let i = 1; i <= 10; i++) {
  fs.writeFileSync(path.join(dir, `explorer-${i}.svg`), generateSvg(String(i)), 'utf-8');
}
console.log('Successfully generated default icons 1..10 in resources/icons/');
