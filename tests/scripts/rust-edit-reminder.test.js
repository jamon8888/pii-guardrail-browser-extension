const { evaluate, isRustSourceFile } = require('../../scripts/claude-hooks/rust-edit-reminder');

describe('rust-edit-reminder hook', () => {
  test('isRustSourceFile matches crate/src/*.rs on both separator styles', () => {
    expect(isRustSourceFile('crate/src/pipeline.rs')).toBe(true);
    expect(isRustSourceFile('crate\\src\\pipeline.rs')).toBe(true);
    expect(isRustSourceFile('C:\\repo\\crate\\src\\pipeline.rs')).toBe(true);
    expect(isRustSourceFile('crate/pkg/privacy_guardrail_wasm.js')).toBe(false);
    expect(isRustSourceFile('crate/Cargo.toml')).toBe(false);
    expect(isRustSourceFile(undefined)).toBe(false);
  });

  test('does not remind for non Edit/Write tools', () => {
    const decision = evaluate({ tool_name: 'Bash', tool_input: { file_path: 'crate/src/pipeline.rs' } });
    expect(decision).toEqual({ remind: false, message: null });
  });

  test('does not remind for non-Rust edits', () => {
    const decision = evaluate({ tool_name: 'Edit', tool_input: { file_path: 'src/background/service-worker.ts' } });
    expect(decision).toEqual({ remind: false, message: null });
  });

  test('reminds when crate/src/*.rs changes', () => {
    const decision = evaluate({ tool_name: 'Write', tool_input: { file_path: 'crate/src/pipeline.rs' } });
    expect(decision.remind).toBe(true);
    expect(decision.message).toContain('npm run build:wasm');
    expect(decision.message).toContain('pipeline.rs');
  });

  test('ignores malformed payloads without throwing', () => {
    expect(() => evaluate(null)).not.toThrow();
    expect(evaluate(null)).toEqual({ remind: false, message: null });
  });
});
