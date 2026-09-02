const React = require("react");
const { View } = require("react-native");

// `@images/*.svg` imports are React components via react-native-svg-transformer
// in Metro. The react-native Jest preset only maps them to asset stubs, which
// React cannot render, so tests that mount real screens get a plain View.
const SvgMock = (props) =>
  React.createElement(View, { ...props, testID: props.testID ?? "svg-mock" });

module.exports = SvgMock;
module.exports.default = SvgMock;
module.exports.__esModule = true;
