module.exports = {
  preset: undefined,
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native/Libraries/Alert/Alert$': '<rootDir>/__mocks__/react-native-alert.js',
    '^react-native/Libraries/Share/Share$': '<rootDir>/__mocks__/react-native-share.js',
    '^expo-router$': '<rootDir>/__mocks__/expo-router.js',
    '^@testing-library/react-native$': '<rootDir>/node_modules/@testing-library/react-native/build/index.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(zustand|@testing-library/react-native)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
