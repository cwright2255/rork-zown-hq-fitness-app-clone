jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));

// updateDoc and increment are not in this mock on purpose: if the store tried to write a group's member count again, the call
// would throw here, and the join or leave would be reported as failed.
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, ...path) => ({ collection: path.join('/') })),
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDocs: jest.fn(),
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
}));

import { setDoc, deleteDoc } from 'firebase/firestore';
import { useGroupStore } from '../store/groupStore';

const groups = () => [
  { id: 'g1', name: 'Morning Runners', memberCount: 3 },
  { id: 'g2', name: 'Lifters', memberCount: 10 },
];

let warn;
beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  useGroupStore.setState({ groups: groups(), joinedGroupIds: new Set() });
});
afterEach(() => warn.mockRestore());

describe('joining a group', () => {
  it('writes the person\'s own membership and nothing about the group', async () => {
    await useGroupStore.getState().joinGroup('g1', 'alice');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][0]).toEqual({ path: 'users/alice/groupMemberships/g1' });
    expect(setDoc.mock.calls[0][1]).toEqual({ joinedAt: expect.any(String) });
    expect(warn).not.toHaveBeenCalled();
  });

  it('shows the person as joined and the count one higher straight away', async () => {
    await useGroupStore.getState().joinGroup('g1', 'alice');
    const { joinedGroupIds, groups: list } = useGroupStore.getState();
    expect(joinedGroupIds.has('g1')).toBe(true);
    expect(list.find((g) => g.id === 'g1').memberCount).toBe(4);
    expect(list.find((g) => g.id === 'g2').memberCount).toBe(10);
  });

  it('does nothing without a signed-in person', async () => {
    await useGroupStore.getState().joinGroup('g1', null);
    expect(setDoc).not.toHaveBeenCalled();
    expect(useGroupStore.getState().joinedGroupIds.size).toBe(0);
  });
});

describe('leaving a group', () => {
  beforeEach(() => useGroupStore.setState({ joinedGroupIds: new Set(['g1']) }));

  it('removes the person\'s own membership and nothing about the group', async () => {
    await useGroupStore.getState().leaveGroup('g1', 'alice');
    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(deleteDoc.mock.calls[0][0]).toEqual({ path: 'users/alice/groupMemberships/g1' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('shows the person as gone and the count one lower, never below zero', async () => {
    await useGroupStore.getState().leaveGroup('g1', 'alice');
    expect(useGroupStore.getState().joinedGroupIds.has('g1')).toBe(false);
    expect(useGroupStore.getState().groups.find((g) => g.id === 'g1').memberCount).toBe(2);

    useGroupStore.setState({ groups: [{ id: 'g3', memberCount: 0 }], joinedGroupIds: new Set(['g3']) });
    await useGroupStore.getState().leaveGroup('g3', 'alice');
    expect(useGroupStore.getState().groups[0].memberCount).toBe(0);
  });
});
