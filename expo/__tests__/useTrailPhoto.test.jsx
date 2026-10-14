import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useTrailPhoto } from '../hooks/useTrailPhoto';

jest.mock('@/services/hikingService', () => ({
  getPhotoUri: jest.fn(),
  peekPhotoUri: jest.fn(() => null),
}));
const Service = require('@/services/hikingService');

function Probe({ trail, width = 500 }) {
  const uri = useTrailPhoto(trail, width);
  return <Text testID="photo">{uri === null ? 'none' : uri}</Text>;
}
const shown = (utils) => utils.getByTestId('photo').props.children;
const flush = async () => { await act(async () => {}); };

beforeEach(() => {
  Service.getPhotoUri.mockReset();
  Service.peekPhotoUri.mockReset();
  Service.peekPhotoUri.mockReturnValue(null);
});

describe('useTrailPhoto', () => {
  it('uses the picture the trail comes with, and asks for nothing', async () => {
    const utils = render(<Probe trail={{ photoUrl: 'https://img/1.jpg', photoName: 'places/a/photos/b' }} />);
    await flush();
    expect(shown(utils)).toBe('https://img/1.jpg');
    expect(Service.getPhotoUri).not.toHaveBeenCalled();
  });

  it('gives none for a trail with no picture, or no trail', async () => {
    expect(shown(render(<Probe trail={{}} />))).toBe('none');
    expect(shown(render(<Probe trail={null} />))).toBe('none');
    expect(shown(render(<Probe trail={undefined} />))).toBe('none');
    await flush();
    expect(Service.getPhotoUri).not.toHaveBeenCalled();
  });

  it('gives none while the address of a Places photo is on its way, then the address', async () => {
    let finish;
    Service.getPhotoUri.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const utils = render(<Probe trail={{ photoName: 'places/a/photos/b' }} width={900} />);
    expect(shown(utils)).toBe('none');
    expect(Service.getPhotoUri).toHaveBeenCalledWith('places/a/photos/b', 900);
    await act(async () => { finish('https://lh3/late'); });
    expect(shown(utils)).toBe('https://lh3/late');
  });

  it('shows an address it already has straight away', async () => {
    Service.peekPhotoUri.mockReturnValue('https://lh3/known');
    const utils = render(<Probe trail={{ photoName: 'places/a/photos/b' }} />);
    expect(shown(utils)).toBe('https://lh3/known');
    await flush();
    expect(Service.getPhotoUri).not.toHaveBeenCalled();
  });

  it('has the known address from the very first draw, with no flash of the placeholder', async () => {
    Service.peekPhotoUri.mockReturnValue('https://lh3/known');
    const draws = [];
    function Recorder() {
      const uri = useTrailPhoto({ photoName: 'places/a/photos/b' }, 500);
      draws.push(uri);
      return null;
    }
    render(<Recorder />);
    await flush();
    expect(draws[0]).toBe('https://lh3/known');
    expect(draws.every((d) => d === 'https://lh3/known')).toBe(true);
  });

  it('moves to the known address of another photo straight away', async () => {
    Service.peekPhotoUri.mockImplementation((name) => `https://lh3/${name}`);
    const utils = render(<Probe trail={{ photoName: 'one' }} />);
    expect(shown(utils)).toBe('https://lh3/one');
    utils.rerender(<Probe trail={{ photoName: 'two' }} />);
    await flush();
    expect(shown(utils)).toBe('https://lh3/two');
    expect(Service.getPhotoUri).not.toHaveBeenCalled();
  });

  it('asks again when the picture is wanted at another size', async () => {
    Service.getPhotoUri.mockImplementation(async (name, width) => `https://lh3/${name}/${width}`);
    const utils = render(<Probe trail={{ photoName: 'one' }} width={300} />);
    await flush();
    expect(shown(utils)).toBe('https://lh3/one/300');
    utils.rerender(<Probe trail={{ photoName: 'one' }} width={900} />);
    await flush();
    expect(Service.getPhotoUri).toHaveBeenLastCalledWith('one', 900);
    expect(shown(utils)).toBe('https://lh3/one/900');
  });

  it('stays on none when the photo cannot be found', async () => {
    Service.getPhotoUri.mockResolvedValue(null);
    const utils = render(<Probe trail={{ photoName: 'places/a/photos/b' }} />);
    await flush();
    expect(shown(utils)).toBe('none');
  });

  it('follows the trail when the screen is given another one', async () => {
    Service.getPhotoUri.mockImplementation(async (name) => `https://lh3/${name}`);
    const utils = render(<Probe trail={{ photoName: 'one' }} />);
    await flush();
    expect(shown(utils)).toBe('https://lh3/one');
    utils.rerender(<Probe trail={{ photoName: 'two' }} />);
    await flush();
    expect(shown(utils)).toBe('https://lh3/two');
    utils.rerender(<Probe trail={{ photoUrl: 'https://img/direct.jpg' }} />);
    await flush();
    expect(shown(utils)).toBe('https://img/direct.jpg');
    utils.rerender(<Probe trail={{}} />);
    await flush();
    expect(shown(utils)).toBe('none');
  });

  it('ignores an answer that arrives after the screen has moved on', async () => {
    let finishOne;
    Service.getPhotoUri.mockImplementation((name) => (name === 'one'
      ? new Promise((resolve) => { finishOne = resolve; })
      : Promise.resolve('https://lh3/two')));
    const utils = render(<Probe trail={{ photoName: 'one' }} />);
    utils.rerender(<Probe trail={{ photoName: 'two' }} />);
    await flush();
    expect(shown(utils)).toBe('https://lh3/two');
    await act(async () => { finishOne('https://lh3/one-late'); });
    expect(shown(utils)).toBe('https://lh3/two');
  });
});
