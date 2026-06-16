const { evaluate, shouldCheck } = require('../../scripts/claude-hooks/pre-commit-privacy-check');

describe('pre-commit-privacy-check hook', () => {
  test('shouldCheck matches a Bash git commit command', () => {
    expect(shouldCheck('Bash', 'git commit -m "test"')).toBe(true);
    expect(shouldCheck('Bash', 'git status')).toBe(false);
    expect(shouldCheck('Edit', 'git commit -m "test"')).toBe(false);
    expect(shouldCheck('Bash', undefined)).toBe(false);
  });

  test('does not check when the command is not a git commit', () => {
    const runCheck = jest.fn();
    const decision = evaluate({ tool_name: 'Bash', tool_input: { command: 'git status' } }, runCheck);
    expect(decision).toEqual({ block: false, message: null });
    expect(runCheck).not.toHaveBeenCalled();
  });

  test('does not block a git commit when the privacy check passes', () => {
    const runCheck = jest.fn(() => ({ errors: [], allowedRuntimeFindings: [] }));
    const decision = evaluate({ tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' } }, runCheck);
    expect(decision).toEqual({ block: false, message: null });
    expect(runCheck).toHaveBeenCalledTimes(1);
  });

  test('blocks a git commit when the privacy check fails', () => {
    const runCheck = jest.fn(() => ({ errors: ['src/x.ts:1 uses fetch'], allowedRuntimeFindings: [] }));
    const decision = evaluate({ tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' } }, runCheck);
    expect(decision.block).toBe(true);
    expect(decision.message).toContain('src/x.ts:1 uses fetch');
  });

  test('ignores malformed payloads without throwing', () => {
    expect(() => evaluate(null)).not.toThrow();
    expect(evaluate(null)).toEqual({ block: false, message: null });
    expect(evaluate({})).toEqual({ block: false, message: null });
  });
});
