// Mock Chrome extension APIs for testing
(globalThis as any).chrome = {
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    },
  },
  runtime: {
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
    sendMessage: jest.fn().mockResolvedValue({}),
  },
  i18n: {
    getMessage: jest.fn((key: string, substitutions?: string[]) => {
      const messages: Record<string, string> = {
        nerModel_bardsaiv2: 'BardsAI EU PII v2 (36 entities)',
        nerModel_bardsai: 'BardsAI EU multilingual',
        nerModel_ai4privacy: 'AI4Privacy prototype',
        nerModel_hikmaai: 'HikmaAI DistilBERT PII',
        scanCanceled: 'Scan canceled',
        cancelDialogBody: 'Do you want to paste this text without checking for personal data?',
        rememberChoice: 'Remember this choice',
        pasteWithoutCheckingBtn: 'Paste without checking',
        pasteWithoutChecking: 'Paste without checking',
        dontPaste: "Don't paste",
        revealOriginals: 'Reveal originals',
        hideOriginals: 'Hide originals',
        was: 'Was: {0}',
        replacedItems: '{0} replaced item{1}',
        copiedContainsReplaced: 'Copied — contains replaced items. Restore originals?',
        replaceWithOriginals: 'Replace with originals',
        clipboardReplaced: 'Clipboard replaced',
        localAiOffModalTitle: 'Local AI detection is off to protect this browser',
        localAiOffModalBody: 'Privacy Guardrail detected critical browser-reported memory and turned off Local AI detection once to reduce the risk of browser slowdowns or freezes.',
        patternDetectionActiveItem: 'Pattern detection remains active for structured personal data.',
        namesMayBeMissed: 'Names, organizations, locations, and context-only PII may be missed while Local AI detection is off.',
        canReviewSetting: 'You can review this setting and re-enable Local AI detection if you accept the performance risk.',
        keepPatternDetectionOnly: 'Keep pattern detection only',
        openSettings: 'Open settings',
      };
      let result = messages[key] ?? key;
      if (substitutions) {
        for (let i = 0; i < substitutions.length; i++) {
          result = result.replace(new RegExp(`\\{${i}\\}`), substitutions[i]);
        }
      }
      return result;
    }),
  },
};
