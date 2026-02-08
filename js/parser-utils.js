// Extracted pure helpers from the in-page parser for unit testing and reuse.

export function escapeHTML(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function replaceDashes(text) {
  return text.replace(/(\.{2,3}-|-\.{2,3})/g, '—');
}

export function replaceCurlyApostrophes(text) {
  let result = text;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (charCode >= 8216 && charCode <= 8219 && charCode !== 39) {
      result = result.replace(text[i], "'");
    }
  }
  return result.replace(/[’‘‵′]/g, "'");
}

export function wrapSpan(className, content, censorStyle = 'remove') {
  content = escapeHTML(content.replace(/[''‵′]/g, "'"));
  const tokens = content.split(/(\s+)/g);
  let html = '';
  let censoring = false;
  let censorBuffer = '';
  let visibleBuffer = '';

  const flushCensor = () => {
    if (censorBuffer.length > 0) {
      if (censorStyle === 'blur') {
        // Blur mode: colorable blurred text inheriting the line's color class
        html += `<span class="${className} censored-content blur-mode colorable" data-original="${censorBuffer}">${censorBuffer}</span>`;
      } else {
        // Remove mode: invisible but preserves space (no text shift)
        html += `<span class="${className} censored-content censored-remove" data-original="${censorBuffer}">${censorBuffer}</span>`;
      }
      censorBuffer = '';
    }
  };
  const flushVisible = () => {
    if (visibleBuffer.length > 0) {
      html += `<span class="${className} colorable">${visibleBuffer}</span>`;
      visibleBuffer = '';
    }
  };

  tokens.forEach((token) => {
    if (token === '') return;
    if (/^\s+$/.test(token)) {
      if (censoring) {
        censorBuffer += token;
      } else {
        flushVisible();
        html += token;
      }
      return;
    }
    for (const char of token) {
      if (char === '÷') {
        if (censoring) {
          flushCensor();
          censoring = false;
        } else {
          flushVisible();
          censoring = true;
        }
      } else if (censoring) {
        censorBuffer += char;
      } else {
        visibleBuffer += char;
      }
    }
    if (!censoring) flushVisible();
  });

  if (censoring) {
    html += censorBuffer;
  }
  return html;
}

export function formatSaysLine(line, currentCharacterName, disableCharacterNameColoring = false) {
  if (!currentCharacterName || disableCharacterNameColoring) {
    return wrapSpan('white', line);
  }
  const hasExclamation = line.startsWith('[!]');
  const lineWithoutExclamation = hasExclamation ? line.substring(3).trim() : line;
  const nameMatch = lineWithoutExclamation.match(/^([^:]+?)\s+says/);
  const speakerName = nameMatch ? nameMatch[1].trim().toLowerCase() : '';
  const toSectionPattern = /\(to [^)]+\)/i;
  const hasToSection = toSectionPattern.test(lineWithoutExclamation);

  let mainColor;
  if (hasToSection) {
    const toSectionMatch = lineWithoutExclamation.match(toSectionPattern);
    const targetName = toSectionMatch ? toSectionMatch[0].match(/\(to ([^)]+)\)/i)[1].toLowerCase() : '';
    if (targetName === currentCharacterName.toLowerCase()) {
      mainColor = 'white';
    } else {
      mainColor = speakerName === currentCharacterName.toLowerCase() ? 'white' : 'lightgrey';
    }
  } else {
    mainColor = speakerName === currentCharacterName.toLowerCase() ? 'white' : 'lightgrey';
  }

  if (hasExclamation) {
    const sanitizedRest = lineWithoutExclamation.replace(/[<>&"']/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' }[m]));
    return `<span class="toyou colorable">[!]</span> <span class="${mainColor} colorable">${sanitizedRest}</span>`;
  }
  return wrapSpan(mainColor, line);
}

// ESM exports above


