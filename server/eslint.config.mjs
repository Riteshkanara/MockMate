// server/eslint.config.mjs
import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['node_modules', 'dist']),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,   // require, module, exports, process, Buffer, __dirname
        ...globals.jest,   // describe, test, expect, beforeEach, afterEach
      },
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'commonjs',
      },
    },
    rules: {
  'no-unused-vars': ['warn', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',   // ← add this
  }],
  'no-empty': 'warn',
  'no-undef': 'error',
},
  },
])