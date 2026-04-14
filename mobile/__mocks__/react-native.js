'use strict';

const React = require('react');

const View = ({ children, ...props }) => React.createElement('View', props, children);
const Text = ({ children, ...props }) => React.createElement('Text', props, children);
const ScrollView = ({ children, ...props }) => React.createElement('ScrollView', props, children);
const TouchableOpacity = ({ children, onPress, disabled, ...props }) =>
  React.createElement('TouchableOpacity', { onClick: disabled ? undefined : onPress, ...props }, children);
const ActivityIndicator = (props) => React.createElement('ActivityIndicator', props);

const StyleSheet = {
  create: (styles) => styles,
  hairlineWidth: 1,
  flatten: (style) => style,
};

const Alert = {
  alert: () => {},
};

const Share = {
  share: () => Promise.resolve({ action: 'sharedAction' }),
};

const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios || obj.default,
};

module.exports = {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Share,
  Platform,
  default: {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Alert,
    Share,
    Platform,
  },
};
