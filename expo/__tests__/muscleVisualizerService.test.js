import {
  normalizeMuscleNames, getMuscleVisualizeImage, getWorkoutVisualizeImage, getHeatmapVisualizeImage,
} from '../services/muscleVisualizerService';
import { callProxy } from '../services/callProxy';

// The muscle diagrams are fetched by the app's cloud functions, which hold the RapidAPI key
// (functions/src/index.js). The functions are replaced here by a fake.
jest.mock('../services/callProxy', () => ({ callProxy: jest.fn() }));

const IMAGE = { base64: 'AQID', contentType: 'image/png' };
let warn;
beforeEach(() => {
  callProxy.mockReset();
  callProxy.mockResolvedValue(IMAGE);
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.fetch = jest.fn();
});
afterEach(() => { warn.mockRestore(); delete global.fetch; });

describe('normalizeMuscleNames', () => {
  it('lower-cases and trims names, and drops anything that is not a name', () => {
    expect(normalizeMuscleNames([' Biceps ', 'TRICEPS', '', null, 4, undefined])).toEqual(['biceps', 'triceps']);
    expect(normalizeMuscleNames(undefined)).toEqual([]);
  });
});

describe('getMuscleVisualizeImage', () => {
  it('asks the cloud function for the muscles and gives back an image address', async () => {
    const uri = await getMuscleVisualizeImage({ muscles: ['Biceps', 'Triceps'] });
    expect(uri).toBe('data:image/png;base64,AQID');
    expect(callProxy).toHaveBeenCalledWith('getMuscleVisualizeImage', {
      muscles: ['biceps', 'triceps'], color: '#E74C3C', gender: 'male', size: 'small',
    });
  });

  it('passes the colour, gender and size it is given', async () => {
    await getMuscleVisualizeImage({ muscles: ['quads'], color: '#00FF00', gender: 'female', size: 'large' });
    expect(callProxy).toHaveBeenCalledWith('getMuscleVisualizeImage', { muscles: ['quads'], color: '#00FF00', gender: 'female', size: 'large' });
  });

  it('uses the image type the function reports, or png when it reports none', async () => {
    callProxy.mockResolvedValue({ base64: 'QQ==', contentType: 'image/webp' });
    await expect(getMuscleVisualizeImage({ muscles: ['abs'] })).resolves.toBe('data:image/webp;base64,QQ==');
    callProxy.mockResolvedValue({ base64: 'QQ==' });
    await expect(getMuscleVisualizeImage({ muscles: ['abs'] })).resolves.toBe('data:image/png;base64,QQ==');
  });

  it('asks for nothing when there are no muscles', async () => {
    await expect(getMuscleVisualizeImage({ muscles: [] })).resolves.toBeNull();
    await expect(getMuscleVisualizeImage({ muscles: [null, ''] })).resolves.toBeNull();
    await expect(getMuscleVisualizeImage()).resolves.toBeNull();
    expect(callProxy).not.toHaveBeenCalled();
  });

  it('gives null, not an error, when the function fails or sends no image', async () => {
    callProxy.mockRejectedValueOnce(new Error('Muscle Visualizer failed: 403'));
    await expect(getMuscleVisualizeImage({ muscles: ['abs'] })).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith('[muscleVisualizerService] request failed:', 'Muscle Visualizer failed: 403');
    callProxy.mockResolvedValueOnce({});
    await expect(getMuscleVisualizeImage({ muscles: ['abs'] })).resolves.toBeNull();
    callProxy.mockResolvedValueOnce({ base64: '' });
    await expect(getMuscleVisualizeImage({ muscles: ['abs'] })).resolves.toBeNull();
    callProxy.mockResolvedValueOnce(null);
    await expect(getMuscleVisualizeImage({ muscles: ['abs'] })).resolves.toBeNull();
  });
});

describe('getWorkoutVisualizeImage', () => {
  it('asks for the muscles worked and the ones helping', async () => {
    const uri = await getWorkoutVisualizeImage({ targetMuscles: ['Chest'], secondaryMuscles: ['Triceps', null] });
    expect(uri).toBe('data:image/png;base64,AQID');
    expect(callProxy).toHaveBeenCalledWith('getWorkoutVisualizeImage', {
      targetMuscles: ['chest'], secondaryMuscles: ['triceps'], gender: 'male', size: 'small',
    });
  });

  it('needs at least one muscle worked', async () => {
    await expect(getWorkoutVisualizeImage({ targetMuscles: [], secondaryMuscles: ['triceps'] })).resolves.toBeNull();
    expect(callProxy).not.toHaveBeenCalled();
  });

  it('gives null when the function fails', async () => {
    callProxy.mockRejectedValueOnce(new Error('down'));
    await expect(getWorkoutVisualizeImage({ targetMuscles: ['chest'] })).resolves.toBeNull();
  });
});

describe('getHeatmapVisualizeImage', () => {
  it('asks for one colour per muscle', async () => {
    const uri = await getHeatmapVisualizeImage({ muscleColors: [{ muscle: 'Chest', color: '#FF0000' }, { muscle: 'abs', color: '#00FF00' }], gender: 'female' });
    expect(uri).toBe('data:image/png;base64,AQID');
    expect(callProxy).toHaveBeenCalledWith('getHeatmapVisualizeImage', {
      muscleColors: [{ muscle: 'chest', color: '#FF0000' }, { muscle: 'abs', color: '#00FF00' }], gender: 'female', size: 'small',
    });
  });

  it('keeps each colour with its own muscle when an entry has no usable name', async () => {
    await getHeatmapVisualizeImage({ muscleColors: [{ muscle: 'chest', color: '#111111' }, { muscle: null, color: '#222222' }, { muscle: 'abs', color: '#333333' }] });
    expect(callProxy.mock.calls[0][1].muscleColors).toEqual([{ muscle: 'chest', color: '#111111' }, { muscle: 'abs', color: '#333333' }]);
  });

  it('asks for nothing without a usable muscle', async () => {
    await expect(getHeatmapVisualizeImage({ muscleColors: [] })).resolves.toBeNull();
    await expect(getHeatmapVisualizeImage({ muscleColors: [{ muscle: null, color: '#000' }] })).resolves.toBeNull();
    await expect(getHeatmapVisualizeImage()).resolves.toBeNull();
    expect(callProxy).not.toHaveBeenCalled();
  });

  it('never reads a key or calls the diagram service itself', async () => {
    process.env.EXPO_PUBLIC_RAPIDAPI_KEY = 'SENTINEL-RAPID';
    try {
      await getMuscleVisualizeImage({ muscles: ['abs'] });
      await getWorkoutVisualizeImage({ targetMuscles: ['abs'] });
      await getHeatmapVisualizeImage({ muscleColors: [{ muscle: 'abs', color: '#000' }] });
      expect(JSON.stringify(callProxy.mock.calls)).not.toContain('SENTINEL');
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      delete process.env.EXPO_PUBLIC_RAPIDAPI_KEY;
    }
  });
});
