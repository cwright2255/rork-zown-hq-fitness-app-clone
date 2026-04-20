import { useAuthStore } from '../src/stores/authStore';

const user = {
  uid: 'u1',
  email: 'u@example.com',
  displayName: 'U',
  fitnessLevel: 'beginner',
  goals: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('authStore', () => {
  beforeEach(() => useAuthStore.getState().reset());

  it('starts unauthenticated', () => {
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });

  it('setUser marks authenticated', () => {
    useAuthStore.getState().setUser(user);
    const s = useAuthStore.getState();
    expect(s.user).toEqual(user);
    expect(s.isAuthenticated).toBe(true);
    expect(s.isLoading).toBe(false);
  });

  it('setLoading toggles loading', () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
  });

  it('reset clears everything', () => {
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().reset();
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.isAuthenticated).toBe(false);
    expect(s.error).toBeNull();
  });
});
