import { isNoDeviceError, pickDevice } from '../lib/spotifyDevices';

describe('spotifyDevices', () => {
  it('recognises the no-active-device error from its reason or message', () => {
    expect(isNoDeviceError({ reason: 'NO_ACTIVE_DEVICE' })).toBe(true);
    expect(isNoDeviceError(new Error('Spotify API error: 404 - Player command failed: No active device found'))).toBe(true);
    expect(isNoDeviceError(new Error('Spotify API error: 404 - Not found'))).toBe(false);
    expect(isNoDeviceError(new Error('Spotify Premium is required to play music from Zown.'))).toBe(false);
    expect(isNoDeviceError(null)).toBe(false);
  });

  it('returns null when there is no usable device', () => {
    expect(pickDevice([], null)).toBeNull();
    expect(pickDevice(undefined, null)).toBeNull();
    expect(pickDevice([{ id: 'a', is_restricted: true, type: 'Smartphone' }], null)).toBeNull();
    expect(pickDevice([{ is_active: true }], null)).toBeNull();
  });

  it('prefers the active device, then the last used, then a phone, then anything', () => {
    const laptop = { id: 'laptop', type: 'Computer', is_active: false };
    const phone = { id: 'phone', type: 'Smartphone', is_active: false };
    const speaker = { id: 'speaker', type: 'Speaker', is_active: false };
    expect(pickDevice([laptop, { ...phone, is_active: true }, speaker], 'speaker').id).toBe('phone');
    expect(pickDevice([laptop, phone, speaker], 'speaker').id).toBe('speaker');
    expect(pickDevice([laptop, speaker, phone], null).id).toBe('phone');
    expect(pickDevice([laptop, speaker], null).id).toBe('laptop');
  });

  it('skips restricted devices even when active', () => {
    const restricted = { id: 'tv', type: 'TV', is_active: true, is_restricted: true };
    const phone = { id: 'phone', type: 'Smartphone' };
    expect(pickDevice([restricted, phone], null).id).toBe('phone');
  });
});
