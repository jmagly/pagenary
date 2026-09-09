import assert from 'node:assert/strict';
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
  const expectedDiagnostics = [
    { message: 'Tenant `id` must match the Pagenary tenant id pattern.', severity: fakeVscode.DiagnosticSeverity.Error, source: 'pagenary' },
    { message: 'Git tenant source requires a non-empty `url`.', severity: fakeVscode.DiagnosticSeverity.Error, source: 'pagenary' }
  ];
  const diagnosticContents = () => (diagnostics.get(jsonDocument.uri.fsPath) || [])
    .map(({ message, severity, source }) => ({ message, severity, source }));
  assert.deepEqual(diagnosticContents(), expectedDiagnostics, 'Active-file diagnostic content');

  diagnostics.clear();
  messages.length = 0;
  await registered.get('pagenary.validateWorkspace')();
  assert.deepEqual([...diagnostics.keys()], [jsonDocument.uri.fsPath], 'Workspace validated fixture file');
  assert.deepEqual(diagnosticContents(), expectedDiagnostics, 'Workspace must publish fresh expected diagnostics');
  assert.deepEqual(messages, ['Pagenary workspace validation complete: 1 file(s), 2 issue(s).']);

  fakeVscode.window.activeTextEditor = { document: markdownDocument };
  await registered.get('pagenary.openPreview')();
  if (!panelHtml.includes('Content-Security-Policy') || !panelHtml.includes('<h1>Preview</h1>')) {
    throw new Error('Preview command did not render expected webview HTML.');
  }

  console.log('VS Code extension activation smoke check passed.');
} finally {
  Module._load = originalLoad;
}
