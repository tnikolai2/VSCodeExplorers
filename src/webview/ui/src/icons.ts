export const ICONS = {
  chevron: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3.5l4.5 4.5-4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  folderClosed: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.293a1 1 0 0 1 .707.293l1.207 1.207H13A1.5 1.5 0 0 1 14.5 4.5v1H2v-2a.5.5 0 0 1 .5-.5h2.5z" fill="#dcb67a"/><path d="M1.5 5.5h13l-1.2 8a1.5 1.5 0 0 1-1.488 1.278H4.188A1.5 1.5 0 0 1 2.7 13.5L1.5 5.5z" fill="#e8a853"/></svg>',
  folderOpened: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.293a1 1 0 0 1 .707.293l1.207 1.207H13A1.5 1.5 0 0 1 14.5 4.5v1H2v-2a.5.5 0 0 1 .5-.5h2.5z" fill="#dcb67a"/><path d="M1 6.5h14l-1.8 7.5a1.5 1.5 0 0 1-1.465 1H4.265a1.5 1.5 0 0 1-1.465-1L1 6.5z" fill="#f5be6e"/></svg>',
  file: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2a1 1 0 0 1 1-1h5.5l4 4V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2z" fill="#3a3d41" stroke="#808080" stroke-width="1.2"/><path d="M9.5 1.5V5H13" fill="none" stroke="#808080" stroke-width="1.2"/></svg>',
  fileTs: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#3178C6"/><path d="M4 6.5h5M6.5 6.5v6M10.2 10.5c.5.5 1.1.8 1.8.8.7 0 1.2-.3 1.2-.8s-.5-.7-1.3-.9c-1.3-.4-2-.8-2-1.9 0-1 .9-1.8 2.1-1.8.8 0 1.5.3 2 .8l-.7.8c-.4-.4-.8-.6-1.3-.6-.6 0-1 .3-1 .7s.4.6 1.2.9c1.3.4 2.1.8 2.1 2 0 1.2-.9 1.9-2.2 1.9-.9 0-1.7-.3-2.3-.9l.7-.9z" fill="#ffffff"/></svg>',
  fileJs: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#F7DF1E"/><path d="M5.5 6.5v4.5c0 1.2-.6 1.6-1.5 1.6-.7 0-1.2-.3-1.5-.7l.8-.8c.2.3.4.4.7.4.4 0 .6-.2.6-.7V6.5h.9zm4.7 4c.5.5 1.1.8 1.8.8.7 0 1.2-.3 1.2-.8s-.5-.7-1.3-.9c-1.3-.4-2-.8-2-1.9 0-1 .9-1.8 2.1-1.8.8 0 1.5.3 2 .8l-.7.8c-.4-.4-.8-.6-1.3-.6-.6 0-1 .3-1 .7s.4.6 1.2.9c1.3.4 2.1.8 2.1 2 0 1.2-.9 1.9-2.2 1.9-.9 0-1.7-.3-2.3-.9l.7-.9z" fill="#000000"/></svg>',
  fileJson: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2a1 1 0 0 1 1-1h5.5l4 4V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2z" fill="#cbcb41" stroke="#a0a030" stroke-width="1.2"/><path d="M5 8c0-1.1.4-1.5 1.2-1.5v.8c-.4 0-.5.2-.5.7v.5c0 .4-.2.7-.6.8.4.1.6.4.6.8v.5c0 .5.1.7.5.7v.8C5.4 11.5 5 11.1 5 10V8zm6 0c0-1.1-.4-1.5-1.2-1.5v.8c.4 0 .5.2.5.7v.5c0 .4.2.7.6.8-.4.1-.6.4-.6.8v.5c0 .5-.1.7-.5.7v.8c.8 0 1.2-.4 1.2-1.5V8z" fill="#2d2d2d"/></svg>',
  close: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
};

export function getFileIcon(fileName: string): string {
  const parts = fileName.split('.');
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : '';
  if (ext === 'ts' || ext === 'tsx') return ICONS.fileTs;
  if (ext === 'js' || ext === 'jsx') return ICONS.fileJs;
  if (ext === 'json') return ICONS.fileJson;
  return ICONS.file;
}

export function generateIconSvg(label: string): string {
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22">
  <defs>
    <mask id="previewMask_${cleanLabel}">
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
  <g mask="url(#previewMask_${cleanLabel})">
    <path fill="currentColor" fill-opacity="0.45" d="M1.5 3.5C1.5 2.67 2.17 2 3 2h5.5c.4 0 .78.16 1.06.44L11.5 4.5H21c.83 0 1.5.67 1.5 1.5V7H1.5V3.5z"/>
    <path fill="currentColor" d="M1 6h22v15c0 .83-.67 1.5-1.5 1.5H2.5c-.83 0-1.5-.67-1.5-1.5V6z"/>
  </g>
</svg>`;
}

