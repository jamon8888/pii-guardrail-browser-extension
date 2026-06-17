'use strict';

const fs = require('fs');

const RUST_SRC_PATTERN = /crate[\\/]src[\\/].*\.rs$/;

function isRustSourceFile(filePath) {
  return typeof filePath === 'string' && RUST_SRC_PATTERN.test(filePath);
}

function evaluate(payload) {
  const toolName = payload && payload.tool_name;
  const filePath = payload && payload.tool_input && payload.tool_input.file_path;

  if ((toolName !== 'Edit' && toolName !== 'Write') || !isRustSourceFile(filePath)) {
    return { remind: false, message: null };
  }

  const fileName = filePath.split(/[\\/]/).pop();
  return {
    remind: true,
    message: `Reminder: ${fileName} changed under crate/src/ — rerun "npm run build:wasm" before testing in the browser.`,
  };
}

function readStdin() {
  try {
    const data = fs.readFileSync(0, 'utf8');
    return JSON.parse(data);
  } catch (_err) {
    return null;
  }
}

function main() {
  const payload = readStdin();
  const decision = evaluate(payload || {});
  if (decision.remind) {
    process.stderr.write(decision.message + '\n');
  }
  process.exitCode = 0;
}

if (require.main === module) {
  main();
}

module.exports = { evaluate, isRustSourceFile, RUST_SRC_PATTERN };
