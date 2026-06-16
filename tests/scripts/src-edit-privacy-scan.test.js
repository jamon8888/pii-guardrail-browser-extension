const { evaluate, isUnderSrc } = require('../../scripts/claude-hooks/src-edit-privacy-scan');

describe('src-edit-privacy-scan hook', () => {
  test('isUnderSrc recognizes paths under src/ on both separator styles', () => {
    expect(isUnderSrc('src/offscreen/ner-provider.ts')).toBe(true);
    expect(isUnderSrc('C:\\repo\\src\\offscreen\\ner-provider.ts')).toBe(true);
    expect(isUnderSrc('/repo/src/offscreen/ner-provider.ts')).toBe(true);
    expect(isUnderSrc('scripts/check-privacy-boundary.js')).toBe(false);
    expect(isUnderSrc(undefined)).toBe(false);
  });

  test('does not warn for non-src edits', () => {
    const runCheck = jest.fn();
    const decision = evaluate({ tool_name: 'Write', tool_input: { file_path: 'scripts/foo.js' } }, runCheck);
    expect(decision).toEqual({ warn: false, message: null });
    expect(runCheck).not.toHaveBeenCalled();
  });

  test('does not warn for non Edit/Write tools', () => {
    const runCheck = jest.fn();
    const decision = evaluate({ tool_name: 'Bash', tool_input: { file_path: 'src/x.ts' } }, runCheck);
    expect(decision).toEqual({ warn: false, message: null });
    expect(runCheck).not.toHaveBeenCalled();
  });

  test('does not warn when the privacy check passes', () => {
    const runCheck = jest.fn(() => ({ errors: [], allowedRuntimeFindings: [] }));
    const decision = evaluate({ tool_name: 'Edit', tool_input: { file_path: 'src/x.ts' } }, runCheck);
    expect(decision).toEqual({ warn: false, message: null });
    expect(runCheck).toHaveBeenCalledTimes(1);
  });

  test('warns (non-blocking) when the privacy check fails', () => {
    const runCheck = jest.fn(() => ({ errors: ['src/x.ts:1 uses fetch'], allowedRuntimeFindings: [] }));
    const decision = evaluate({ tool_name: 'Write', tool_input: { file_path: 'src/x.ts' } }, runCheck);
    expect(decision.warn).toBe(true);
    expect(decision.message).toContain('src/x.ts:1 uses fetch');
  });

  test('ignores malformed payloads without throwing', () => {
    expect(() => evaluate(null)).not.toThrow();
    expect(evaluate(null)).toEqual({ warn: false, message: null });
  });
});
