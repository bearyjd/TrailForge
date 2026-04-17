const mockFrom = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockResolvedValue({ data: [], error: null }),
  insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

const mockAuth = {
  signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  onAuthStateChange: jest.fn(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  })),
  setSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
};

const createClient = jest.fn(() => ({ from: mockFrom, auth: mockAuth }));

module.exports = { createClient };
module.exports.__esModule = true;
