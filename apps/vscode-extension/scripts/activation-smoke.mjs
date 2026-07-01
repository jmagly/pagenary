import Module from 'node:module';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const require = createRequire(import.meta.url);
const originalLoad = Module._load;
const registered = new Map();
const diagnostics = new Map();
const messages = [];
let panelHtml = '';

const markdownDocument = {
  languageId: 'markdown',
  fileName: path.join(root, 'fixtures', 'preview.md'),
  uri: { fsPath: path.join(root, 'fixtures', 'preview.md') },
  getText: () => '# Preview\n\nBody.',
  positionAt: () => new fakeVscode.Position(0, 0)
};

const jsonDocument = {
  languageId: 'json',
  fileName: path.join(root, '..', 'publisher', 'tenants.json'),
  uri: { fsPath: path.join(root, '..', 'publisher', 'tenants.json') },
  getText: () => '{"tenants":[{"id":"Bad Id","source":{"type":"git"}}]}',
  positionAt: () => new fakeVscode.Position(0, 0)
};

const fakeVscode = {
  DiagnosticSeverity: { Error: 0 },
  Position: class Position {
    constructor(line, character) {
      this.line = line;
      this.character = character;
    }
    translate(lineDelta, charDelta) {
      return new fakeVscode.Position(this.line + lineDelta, this.character + charDelta);
    }
  },
  Range: class Range {
    constructor(start, end) {
      this.start = start;
      this.end = end;
    }
  },
  Diagnostic: class Diagnostic {
    constructor(range, message, severity) {
      this.range = range;
      this.message = message;
      this.severity = severity;
    }
  },
  ViewColumn: { Beside: 2 },
  languages: {
    createDiagnosticCollection: () => ({
      set: (uri, items) => diagnostics.set(uri.fsPath, items),
      clear: () => diagnostics.clear(),
      dispose: () => {}
    })
  },
  commands: {
    registerCommand: (name, fn) => {
      registered.set(name, fn);
      return { dispose: () => {} };
    }
  },
  window: {
    activeTextEditor: { document: jsonDocument },
    showInformationMessage: (message) => messages.push(message),
    createWebviewPanel: (_type, title) => ({
      title,
      webview: {
        set html(value) {
          panelHtml = value;
        }
      }
    })
  },
  workspace: {
    findFiles: async () => [jsonDocument.uri],
    openTextDocument: async () => jsonDocument
  }
};

Module._load = function load(request, parent, isMain) {
  if (request === 'vscode') return fakeVscode;
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const extension = require(path.join(root, 'src', 'extension.js'));
  const context = { subscriptions: [] };
  extension.activate(context);

  for (const command of ['pagenary.validateActiveFile', 'pagenary.validateWorkspace', 'pagenary.openPreview']) {
    if (!registered.has(command)) throw new Error(`Command was not registered: ${command}`);
  }

  await registered.get('pagenary.validateActiveFile')();
  const activeDiagnostics = diagnostics.get(jsonDocument.uri.fsPath) || [];
  if (activeDiagnostics.length < 2) {
    throw new Error('Active-file validation did not publish expected diagnostics.');
  }

  await registered.get('pagenary.validateWorkspace')();
  if (!messages.some((message) => /workspace validation complete/i.test(message))) {
    throw new Error('Workspace validation did not report completion.');
  }

  fakeVscode.window.activeTextEditor = { document: markdownDocument };
  await registered.get('pagenary.openPreview')();
  if (!panelHtml.includes('Content-Security-Policy') || !panelHtml.includes('<h1>Preview</h1>')) {
    throw new Error('Preview command did not render expected webview HTML.');
  }

  console.log('VS Code extension activation smoke check passed.');
} finally {
  Module._load = originalLoad;
}
