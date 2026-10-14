// services/callProxy.js: asks one of the app's cloud functions and gives back its answer.
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { region: 'fake-functions' } }));

import { callProxy } from '../services/callProxy';

describe('callProxy', () => {
  it('calls the named function with the data and gives back its answer', async () => {
    const { httpsCallable } = require('firebase/functions');
    const fn = jest.fn(async () => ({ data: { photoUri: 'https://x' } }));
    httpsCallable.mockReturnValue(fn);
    await expect(callProxy('getPlacesPhotoUri', { photoName: 'places/a/photos/b' })).resolves.toEqual({ photoUri: 'https://x' });
    expect(httpsCallable).toHaveBeenCalledWith({ region: 'fake-functions' }, 'getPlacesPhotoUri');
    expect(fn).toHaveBeenCalledWith({ photoName: 'places/a/photos/b' });
  });

  it('lets a failure through for the caller to handle', async () => {
    const { httpsCallable } = require('firebase/functions');
    httpsCallable.mockReturnValue(jest.fn(async () => { throw new Error('unauthenticated'); }));
    await expect(callProxy('searchPlacesNearby', {})).rejects.toThrow('unauthenticated');
  });
});
