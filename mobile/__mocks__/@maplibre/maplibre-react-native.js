module.exports = {
  offlineManager: {
    createPack: jest.fn().mockResolvedValue(undefined),
    deletePack: jest.fn().mockResolvedValue(undefined),
  },
};
