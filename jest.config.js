module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleFileExtensions: ["js", "jsx"],
  transform: {
    "^.+\\.jsx?$": "babel-jest",
  },
  transformIgnorePatterns: ["node_modules/(?!@shotgunjed)/"],
  testMatch: ["**/__tests__/**/*.js?(x)", "**/test/**/*.spec.js?(x)"],
  coverageReporters: ["html", "text", "lcov"],
};
