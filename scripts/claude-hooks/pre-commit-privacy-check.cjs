'use strict';

const path = require('path');
const fs = require('fs');

const GIT_COMMIT_PATTERN = /\bgit\s+commit\b/;

function shouldCheck(toolName, command) {
  return toolName === 'Bash' && typeof command === 'string' && GIT_COMMIT_PATTERN.test(command);
}

function defaultRunCheck() {
  const { checkPrivacyBoundary } = require('../check-privacy-boundary.js');
  return checkPrivacyBoundary(path.resolve(__dirname, '..', '..'));
}

function evaluate(payload, runCheck) {
  const check = runCheck || defaultRunCheck;
  const toolName = payload && payload.tool_name;
  const command = payload && payload.tool_input && payload.tool_input.command;

  if (!shouldCheck(toolName, command)) {
    return { block: false, message: null };
  }

  const result = check();
  if (result.errors.length > 0) {
    return {
      block: true,
      message: [
        'Privacy boundary check failed - commit blocked:',
        ...result.errors.map((error) => `- ${error}`),
        'Run "npm run check:privacy-boundary" for full output, fix the findings, then retry the commit.',
      ].join('\n'),
    };
  }

  return { block: false, message: null };
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
  if (decision.block) {
    process.stderr.write(decision.message + '\n');
    process.exitCode = 2;
    return;
  }
  process.exitCode = 0;
}

if (require.main === module) {
  main();
}

module.exports = { evaluate, shouldCheck, GIT_COMMIT_PATTERN };
