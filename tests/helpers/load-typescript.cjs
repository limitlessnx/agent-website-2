const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

module.exports = function loadTypescript(path, mocks = {}, append = '', globals = {}) {
  const source = fs.readFileSync(path, 'utf8') + '\n' + append;
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: path,
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
    getCurrentDirectory: () => process.cwd(), getCanonicalFileName: f => f, getNewLine: () => '\n',
  }));
  const exports = {};
  const context = { exports, module: { exports }, console, process, Date, crypto: require('node:crypto').webcrypto, Buffer, AbortController, setTimeout, clearTimeout,
    require: name => {
      if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
      if (name.startsWith('node:')) return require(name);
      throw new Error('Unmocked dependency: ' + name);
    }, ...globals };
  vm.runInNewContext(compiled.outputText, context, { filename: path });
  return context.module.exports;
};
