// ESLint reads every file in the app without running it and reports mistakes that would otherwise only show up when
// someone opens that screen: a variable that does not exist, a component or function that is imported from a file that
// does not export it, an import that points at nothing, a hook called where hooks may not be called.
//
//   npm run lint        checks everything (the Tests workflow on GitHub runs the same command)
//
// It reports only things that are wrong, never matters of style, so a red result always means a real mistake. The
// rules that were left out are listed at the bottom, with the reason.
const path = require('path');
const js = require('@eslint/js');
const globals = require('globals');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const importPlugin = require('eslint-plugin-import');

// What exists on the phone besides the language itself. `window` is here because React Native defines it; `document`,
// `Buffer` and the like are not, see the second block of overrides.
const phoneGlobals = {
  __DEV__: 'readonly', global: 'readonly', globalThis: 'readonly', console: 'readonly', process: 'readonly',
  require: 'readonly', module: 'writable', exports: 'writable', window: 'readonly',
  fetch: 'readonly', FormData: 'readonly', Headers: 'readonly', Request: 'readonly', Response: 'readonly',
  AbortController: 'readonly', AbortSignal: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
  Blob: 'readonly', FileReader: 'readonly', WebSocket: 'readonly', XMLHttpRequest: 'readonly',
  atob: 'readonly', btoa: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  setImmediate: 'readonly', clearImmediate: 'readonly', requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly', queueMicrotask: 'readonly', performance: 'readonly', navigator: 'readonly',
  alert: 'readonly', structuredClone: 'readonly',
};

module.exports = [
  {
    ignores: [
      'node_modules/**', 'functions/node_modules/**', 'dist/**', '.expo/**', 'ios/**', 'android/**', 'web-build/**',
      'public/**', 'assets/**',
    ],
    // A "// eslint-disable" comment for a rule that is not switched on here is harmless; do not nag about it.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    plugins: { react, 'react-hooks': reactHooks, import: importPlugin },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.es2021, ...phoneGlobals },
    },
    settings: {
      react: { version: '19.1' },
      'import/extensions': ['.js', '.jsx'],
      'import/resolver': { [path.join(__dirname, 'eslint-import-resolver.js')]: {} },
    },
    rules: {
      // A name that is used but never defined (from js.configs.recommended), and the same for <Components>.
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
      // An import that points at no file, or asks a file for something it does not export.
      'import/no-unresolved': ['error', { commonjs: true }],
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      // Hooks called inside an if, a loop or after a return break React on the next render.
      'react-hooks/rules-of-hooks': 'error',
      // Things React Native renders badly or refuses to render.
      'react/jsx-no-comment-textnodes': 'error', // "// text" inside JSX is shown on screen as text
      'react/jsx-no-duplicate-props': 'error',
      'react/no-children-prop': 'error',
      'react/no-direct-mutation-state': 'error',
      'no-restricted-syntax': ['error', {
        // `{items.length && <Row/>}` shows a bare 0 when the list is empty, and React Native throws "Text strings must be
        // rendered within a <Text> component". Write `items.length > 0 && ...`.
        selector: "JSXExpressionContainer > LogicalExpression[operator='&&'][left.type='MemberExpression'][left.property.name='length']",
        message: 'Compare the length, for example `items.length > 0 && ...`: a bare `items.length &&` renders 0 when the list is empty.',
      }],
      // Code that does something other than it looks like it does.
      'array-callback-return': ['error', { checkForEach: false }],
      'no-use-before-define': ['error', { functions: false, classes: true, variables: false }],
      'no-self-compare': 'error',
      'no-throw-literal': 'error',

      // Left out on purpose. Each of these reports many places that are not mistakes, which would hide the ones that are.
      'no-unused-vars': 'off', // 400+ unused imports and variables: tidiness, not a bug
      'no-empty': 'off', // empty catch blocks that deliberately ignore a failure
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off',
      'no-case-declarations': 'off',
      // react-hooks/exhaustive-deps (118 places) and react/jsx-no-leaked-render (158 places) need a person to judge each one.
    },
  },
  {
    // The tests run under jest and node.
    files: ['__tests__/**', 'rules-tests/**', 'jest.setup.js', 'jest.global-setup.js', 'mocks/**', 'metro-stubs/**'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
  },
  {
    // Build tools, scripts, this config and the cloud functions run under node, not on the phone.
    files: ['*.config.js', 'eslint-import-resolver.js', 'plugins/**', 'scripts/**', 'functions/**', 'backend/**'],
    languageOptions: { globals: globals.node },
  },
  {
    // Browser-only or node-only things that a few files use after checking they are there (`typeof Buffer !== 'undefined'`,
    // `Platform.OS === 'web'`). The phone has none of them, so they are declared only for these files: anywhere else,
    // using one is reported.
    files: [
      'app/index.jsx', 'components/RunningMap.jsx', 'constants/performance.js', 'lib/exportMeshToGLB.js', 'lib/meshCache.js',
      'services/spotifyService.js', 'services/voiceCommandService.js',
    ],
    languageOptions: {
      globals: {
        document: 'readonly', crypto: 'readonly', Buffer: 'readonly', IntersectionObserver: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
      },
    },
  },
];
