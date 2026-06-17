import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-content', 'node_modules', 'ios', 'android', 'coverage', 'playwright-report'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Custom guard: facts must come from the compiled content bundle, never be
  // hardcoded in src/. Flags bare decimal coordinate-looking literals in app code.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Literal[value=/^-?\\d{1,3}\\.\\d{4,}$/]",
          message:
            'Looks like a hardcoded coordinate. Facts (coordinates, dates, claims) must come from dist-content/bundle.json, not src/. See plan: content/code separation.',
        },
      ],
    },
  },
);
