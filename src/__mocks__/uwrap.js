// Stub for the native 'uwrap' canvas module, which is unavailable in the Jest jsdom environment.
module.exports = {
  Count: jest.fn(() => 0),
  varPreLine: jest.fn(() => []),
};
