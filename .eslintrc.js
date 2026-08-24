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
