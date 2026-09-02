module.exports = {
  preset: 'react-native',
  // Stubs RNGestureHandlerModule so screens that use Swipeable (Message list,
  // Alarm list) can mount under react-test-renderer.
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js'],
  moduleNameMapper: {
    '\\.svg$': '<rootDir>/jest/svg-mock.js',
  },
};
