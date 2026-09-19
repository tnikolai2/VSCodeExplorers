import * as fs from 'fs';
import * as path from 'path';
import { generateIconSvg } from '../utils/iconSvg';
import { MAX_SLOTS } from '../models/types';

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
    return generateIconSvg(label);
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
   * Initializes or updates all default icons with the latest SVG design.
   */
  public static async initializeDefaultIcons(extensionPath: string): Promise<void> {
    const iconsDir = path.join(extensionPath, 'resources', 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    for (let i = 1; i <= MAX_SLOTS; i++) {
      const filePath = path.join(iconsDir, `explorer-${i}.svg`);
      const svgContent = IconGenerator.generateSvg(String(i));
      await fs.promises.writeFile(filePath, svgContent, 'utf-8');
    }
  }
}

