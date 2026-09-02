module.exports = (api) => {
  // Jest inlines the committed stub instead of a developer's real .env so the
  // companion-chat tests never see (or bake in) a private LLM_API_KEY.
  const envPath = api.env('test') ? '.env.example' : '.env';

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: envPath,
          blacklist: null,
          whitelist: null,
          safe: false,
          allowUndefined: true,
        },
      ],
      [
        'module-resolver',
        {
          alias: {
            '@images': './assets/images',
            '@common': './src/common',
          },
        },
      ],
      ['react-native-reanimated/plugin'],
    ],
  };
};
