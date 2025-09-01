// eslint.config.js
const js = require('@eslint/js');
const react = require('eslint-plugin-react');
const hooks = require('eslint-plugin-react-hooks');
const refresh = require('eslint-plugin-react-refresh');
const importPlugin = require('eslint-plugin-import');
const unusedImports = require('eslint-plugin-unused-imports');

module.exports = [
  { ignores: ['node_modules/**', 'dist/**', 'build/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    plugins: {
      react,
      'react-hooks': hooks,
      'react-refresh': refresh,
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/prop-types': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'unused-imports/no-unused-imports': 'error',
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          newlines-between: 'always',
        },
      ],
      'react-refresh/only-export-components': 'warn',
    },
  },
];
