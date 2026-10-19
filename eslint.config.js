import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'data/**',
      '.agent/**', '.antigravity/**', '.archive/**', '.test-cache/**', 'outputs/**',
    ],
  },
  {
    files: ['server.ts', 'server/**/*.ts', 'shared/**/*.ts', 'src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      'no-debugger': 'error',
      'no-constant-binary-expression': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-imports': 'error',
      'no-self-assign': 'error',
      'no-unreachable-loop': 'error',
      'no-useless-catch': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
    },
  },
];
