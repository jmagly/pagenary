/**
 * Syntax highlighting module using Prism.js
 * Lazy-loads Prism only when code blocks are detected
 */

let prismPromise = null;

// Languages to load - add more as needed
const LANGUAGES = ['c', 'json', 'javascript', 'typescript', 'python', 'rust', 'go', 'bash', 'shell', 'yaml', 'toml', 'sql', 'solidity', 'ini'];

/**
 * Lazily load Prism.js and required language modules
 */
async function loadPrism() {
  if (prismPromise) return prismPromise;

  prismPromise = (async () => {
    await loadLocalScript('./vendor/prism/prism.js');
    for (const language of ['c', 'json', 'typescript', 'python', 'rust', 'go', 'bash', 'yaml', 'toml', 'sql', 'solidity', 'ini']) {
      await loadLocalScript(`./vendor/prism/components/prism-${language}.min.js`);
    }
    return globalThis.Prism;
  })();

  return prismPromise;
}

function loadLocalScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Unable to load local syntax highlighter: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Map common language aliases to Prism language names
 */
function normalizeLanguage(lang) {
  const aliases = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'sh': 'bash',
    'shell': 'bash',
    'yml': 'yaml',
    'sol': 'solidity',
  };
  return aliases[lang] || lang;
}

/**
 * Highlight all code blocks within a container
 * @param {HTMLElement} container - The container to search for code blocks
 */
export async function highlightCodeBlocks(container) {
  // Find all code blocks with a language class
  const codeBlocks = container.querySelectorAll('pre code[class*="language-"]');
  if (codeBlocks.length === 0) return;

  // Filter out mermaid blocks (handled separately)
  const highlightable = Array.from(codeBlocks).filter(
    block => !block.classList.contains('language-mermaid')
  );
  if (highlightable.length === 0) return;

  const Prism = await loadPrism();

  for (const codeBlock of highlightable) {
    // Extract language from class
    const langClass = Array.from(codeBlock.classList).find(c => c.startsWith('language-'));
    if (!langClass) continue;

    const lang = normalizeLanguage(langClass.replace('language-', ''));

    // Check if Prism supports this language
    if (Prism.languages[lang]) {
      const code = codeBlock.textContent;
      codeBlock.innerHTML = Prism.highlight(code, Prism.languages[lang], lang);
      codeBlock.parentElement.classList.add('highlighted');
    }
  }
}
