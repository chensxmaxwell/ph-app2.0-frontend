module.exports = {
    root: true,
    extends: [
      '@react-native',
      'plugin:import/errors', // Add this line to extend the recommended configuration
      'plugin:import/warnings', // Optionally, add this line to enable additional warnings
    ],
    plugins: ['module-resolver', 'import'], // Add 'import' to the plugins array
    settings: {
      'import/ignore': ['node_modules/react-native/index\\.js$'],
      typescript: {},
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
        'babel-module': {
          allowExistingDirectories: true,
          alias: {
            '@images': './assets/images',
            '@common': './src/common',
          },
        },
      },
    },
    overrides: [
      {
        // ICD-001 BLE layer: the repo has no .prettierrc, so pin a style here
        // (single quotes, matching @react-native's `quotes` rule) instead of
        // letting prettier defaults and `quotes` fight each other.
        files: [
          'src/services/icd001/**',
          'src/screens/icd001-debug/**',
          'src/screens/advanced-control/**',
          'src/screens/control/advanced-entry.tsx',
          'src/screens/onboarding/ConnectDevice/scanFilter.ts',
          'src/screens/onboarding/ConnectDevice/useFindDevices.ts',
          '__tests__/icd001/**',
        ],
        rules: {
          'prettier/prettier': [
            'error',
            { singleQuote: true, trailingComma: 'all', arrowParens: 'avoid', printWidth: 110 },
          ],
        },
      },
    ],
    rules: {
      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          alphabetize: {
            order: 'asc',
          },
          'newlines-between': 'always',
        },
      ],
      'module-resolver/use-alias': 2,
    },
  };
