module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    "scripts/**/*.js",
    "src/**/*.js"
  ],
  coverageDirectory: "coverage",
  testMatch: ["**/__coverage.test.js"],
};
