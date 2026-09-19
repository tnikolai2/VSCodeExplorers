import * as fs from 'fs';
import * as path from 'path';

/**
 * Generates clean, theme-adaptive SVG folder icons with large, clearly visible characters.
 */
export class IconGenerator {
  /**
   * Automatically extracts 1 to 3 icon characters from an Activity Bar title.
   * e.g.: "FE" -> "FE", "API" -> "API", "Frontend" -> "FRO", "Front End" -> "FE", "Explorer 1" -> "1"
   */
  public static extractIconLabel(title: string): string {
    const trimmed = (title || '').trim();
    if (!trimmed) return '1';

    // If short (1-3 chars), use as-is
    if (trimmed.length <= 3) {
      return trimmed.toUpperCase();
    }

    // If title has a trailing number (e.g. "Explorer 2", "Bar 3"), use the number
    const trailingNum = trimmed.match(/\d+$/);
    if (trailingNum && trailingNum[0].length <= 3) {
      return trailingNum[0];
    }

    // If multi-word (e.g. "Front End", "Shared Libs"), take first letter of each word
    const words = trimmed.split(/[\s_\-]+/).filter(Boolean);
    if (words.length >= 2) {
      return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
    }

    // Otherwise take first 2-3 letters
    return trimmed.slice(0, Math.min(3, trimmed.length)).toUpperCase();
  }

  /**
   * Generates SVG XML content with extra large, bold text cut out of the folder.
   */
  public static generateSvg(label: string): string {
    const cleanLabel = (label || '').trim().slice(0, 3).toUpperCase();
    
    // Maximize text to occupy the entire folder card
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

  /**
   * Saves an icon for a specific slot (1..10)
   */
  public static async saveSlotIcon(extensionPath: string, slotIndex: number, label: string): Promise<string> {
    const iconsDir = path.join(extensionPath, 'resources', 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    const filePath = path.join(iconsDir, `explorer-${slotIndex}.svg`);
    const svgContent = IconGenerator.generateSvg(label);
    await fs.promises.writeFile(filePath, svgContent, 'utf-8');
    return filePath;
  }

  /**
   * Initializes or updates all 10 default icons with the latest SVG design.
   */
  public static async initializeDefaultIcons(extensionPath: string): Promise<void> {
    const iconsDir = path.join(extensionPath, 'resources', 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    for (let i = 1; i <= 10; i++) {
      const filePath = path.join(iconsDir, `explorer-${i}.svg`);
      const svgContent = IconGenerator.generateSvg(String(i));
      await fs.promises.writeFile(filePath, svgContent, 'utf-8');
    }
  }
}

