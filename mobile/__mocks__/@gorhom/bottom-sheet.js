const React = require('react');
const { View } = require('react-native');

const BottomSheet = React.forwardRef(function BottomSheet({ children, index }, _ref) {
  if (index === -1) return null;
  return React.createElement(View, { testID: 'bottom-sheet' }, children);
});

module.exports = BottomSheet;
module.exports.default = BottomSheet;
module.exports.__esModule = true;
