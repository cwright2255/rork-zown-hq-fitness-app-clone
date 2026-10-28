// The phone only asks the server about invites (services/inviteService.js): it cannot make a code, join with one or give a plan.
jest.mock('../services/callProxy', () => ({ callProxy: jest.fn() }));

import { callProxy } from '../services/callProxy';
import { fetchInviteStatus, redeemInviteCode } from '../services/inviteService';

beforeEach(() => { callProxy.mockReset(); });

describe('inviteService', () => {
  it('asks getInviteStatus for the code and the counts, and gives back what it answered', async () => {
    callProxy.mockResolvedValue({ code: 'K7P2QX4M' });
    await expect(fetchInviteStatus()).resolves.toEqual({ code: 'K7P2QX4M' });
    expect(callProxy).toHaveBeenCalledWith('getInviteStatus', {});
  });

  it('sends redeemInviteCode the code exactly as it was typed, and nothing else', async () => {
    callProxy.mockResolvedValue({ ok: true, friendDays: 7, inviterDays: 7 });
    await expect(redeemInviteCode('K7P2-QX4M')).resolves.toEqual({ ok: true, friendDays: 7, inviterDays: 7 });
    expect(callProxy).toHaveBeenCalledWith('redeemInviteCode', { code: 'K7P2-QX4M' });
  });

  it('lets a failure through, for the screen to word', async () => {
    callProxy.mockRejectedValue(new Error('unavailable'));
    await expect(fetchInviteStatus()).rejects.toThrow('unavailable');
    await expect(redeemInviteCode('K7P2-QX4M')).rejects.toThrow('unavailable');
  });
});
