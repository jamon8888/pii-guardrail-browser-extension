'use strict';

const path = require('path');
const fs = require('fs');

function isUnderSrc(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return false;
  const normalized = filePath.split(/[\\/]/).join('/');
  return normalized === 'src' || normalized.startsWith('src/') || normalized.includes('/src/');
}

function defaultRunCheck() {
  const { checkPrivacyBoundary } = require('../check-privacy-boundary.js');
  return checkPrivacyBoundary(path.resolve(__dirname, '..', '..'));
}

function evaluate(payload, runCheck) {
  const check = runCheck || defaultRunCheck;
  const toolName = payload && payload.tool_name;
  const filePath = payload && payload.tool_input && payload.tool_input.file_path;

  if ((toolName !== 'Edit' && toolName !== 'Write') || !isUnderSrc(filePath)) {
    return { warn: false, message: null };
  }

  const result = check();
  if (result.errors.length > 0) {
    return {
      warn: true,
      message: [
        'Privacy boundary warning (non-blocking, will block at commit time):',
        ...result.errors.map((error) => `- ${error}`),
      ].join('\n'),
    };
  }

  return { warn: false, message: null };
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
  if (decision.warn) {
    process.stderr.write(decision.message + '\n');
  }
  process.exitCode = 0;
}

if (require.main === module) {
  main();
}

module.exports = { evaluate, isUnderSrc };
