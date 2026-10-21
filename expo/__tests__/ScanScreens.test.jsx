import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => global.__params,
  router: {
    back: (...a) => global.__router.back(...a),
    replace: (...a) => global.__router.replace(...a),
    push: (...a) => global.__router.push(...a),
    canGoBack: () => global.__router.canGoBack(),
  },
}), { virtual: true });
jest.mock('expo-camera', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    CameraView: mockReact.forwardRef((props, ref) => {
      global.__camera = props;
      mockReact.useImperativeHandle(ref, () => ({ takePictureAsync: (...a) => global.__takePicture(...a) }));
      return mockReact.createElement(mockRn.View, null, props.children);
    }),
    useCameraPermissions: () => global.__permission,
  };
}, { virtual: true });
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}), { virtual: true });
jest.mock('firebase/functions', () => ({
  httpsCallable: (...a) => global.__httpsCallable(...a),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { fake: true } }));
jest.mock('@/components/ScreenHeader', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: () => mockReact.createElement(mockRn.View) };
});
jest.mock('@/components/PrimaryButton', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onPress }) =>
      mockReact.createElement(mockRn.TouchableOpacity, { onPress, accessibilityRole: 'button' },
        mockReact.createElement(mockRn.Text, null, title)),
  };
});

import BarcodeScanScreen from '../app/nutrition/barcode-scan';
import FoodScanScreen from '../app/nutrition/scan';

const found = {
  data: {
    found: true,
    barcode: '0123456789012',
    product: { name: 'Oat Bar', brand: 'Acme' },
    nutrition_per_100g: { energy_kcal: 389.4, protein_g: 10.26, carbohydrates_g: 66.34, fat_g: 6.91 },
  },
};

const setup = (params = {}) => {
  global.__params = params;
  global.__router = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
  global.__permission = [{ granted: true }, jest.fn()];
  global.__camera = null;
};

let alertSpy;
beforeEach(() => {
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('barcode scanner', () => {
  const scan = async (data = '0123456789012') => {
    await act(async () => { global.__camera.onBarcodeScanned({ data }); });
  };

  it('looks the barcode up and shows the product with per-100g numbers', async () => {
    setup();
    global.__httpsCallable = jest.fn(() => jest.fn(async () => found));
    const utils = render(<BarcodeScanScreen />);
    await scan();
    expect(global.__httpsCallable).toHaveBeenCalledWith({ fake: true }, 'lookupCalorieApiBarcode');
    expect(utils.getByText('Oat Bar')).toBeTruthy();
    expect(utils.getByText('Acme')).toBeTruthy();
    expect(utils.getByText('389')).toBeTruthy();
    expect(utils.getByText('10.3g')).toBeTruthy();
    expect(utils.getByText('66.3g')).toBeTruthy();
    expect(utils.getByText('6.9g')).toBeTruthy();
  });

  it('Add to Log goes to the log screen with the food, labelled as 100g, and no meal when none was chosen', async () => {
    setup();
    global.__httpsCallable = jest.fn(() => jest.fn(async () => found));
    const utils = render(<BarcodeScanScreen />);
    await scan();
    fireEvent.press(utils.getByText('Add to Log'));
    expect(global.__router.replace).toHaveBeenCalledTimes(1);
    const arg = global.__router.replace.mock.calls[0][0];
    expect(arg.pathname).toBe('/nutrition/food/scanned');
    expect(arg.params.mealId).toBeUndefined();
    const food = JSON.parse(arg.params.scannedFood);
    expect(food).toMatchObject({
      name: 'Oat Bar', brand: 'Acme', calories: 389, protein: 10.3, carbs: 66.3, fat: 6.9,
      servingSize: '100g', barcode: '0123456789012',
    });
  });

  // A scanned food used to go to the log with no rating, so a meal made of it (a ready-meal chicken tikka masala) had no stars.
  it('gives the scanned food its rating and its fibre, sugar and sodium for the log screen', async () => {
    setup();
    const tikka = {
      data: {
        found: true, barcode: '4056489123456', product: { name: 'Chicken Tikka Masala', brand: 'Lidl' },
        nutrition_per_100g: {
          energy_kcal: 140, protein_g: 8, carbohydrates_g: 12, fat_g: 6, fiber_g: 1.2, sugars_g: 3.5, saturated_fat_g: 1.7, salt_g: 0.9,
        },
      },
    };
    global.__httpsCallable = jest.fn(() => jest.fn(async () => tikka));
    const utils = render(<BarcodeScanScreen />);
    await scan();
    fireEvent.press(utils.getByText('Add to Log'));
    const food = JSON.parse(global.__router.replace.mock.calls[0][0].params.scannedFood);
    expect(food).toMatchObject({ name: 'Chicken Tikka Masala', nutritionalScore: { score: 'C' }, fiber: 1.2, sugar: 3.5, sodium: 360 });
    expect(food.nutritionalScore).not.toHaveProperty('partial');
  });

  it('uses the barcode that was scanned when the answer does not repeat it', async () => {
    setup();
    const { barcode, ...noBarcode } = found.data;
    global.__httpsCallable = jest.fn(() => jest.fn(async () => ({ data: noBarcode })));
    const utils = render(<BarcodeScanScreen />);
    await scan('9780201379624');
    fireEvent.press(utils.getByText('Add to Log'));
    expect(JSON.parse(global.__router.replace.mock.calls[0][0].params.scannedFood).barcode).toBe('9780201379624');
  });

  it('marks the rating as limited when the product does not list everything it is judged on', async () => {
    setup();
    global.__httpsCallable = jest.fn(() => jest.fn(async () => found));
    const utils = render(<BarcodeScanScreen />);
    await scan();
    fireEvent.press(utils.getByText('Add to Log'));
    const food = JSON.parse(global.__router.replace.mock.calls[0][0].params.scannedFood);
    expect(food.nutritionalScore).toEqual({ score: 'C', partial: true });
  });

  it('carries the chosen meal through to the log screen', async () => {
    setup({ mealId: 'dinner' });
    global.__httpsCallable = jest.fn(() => jest.fn(async () => found));
    const utils = render(<BarcodeScanScreen />);
    await scan();
    fireEvent.press(utils.getByText('Add to Log'));
    expect(global.__router.replace.mock.calls[0][0].params.mealId).toBe('dinner');
  });

  it('runs one lookup when the camera reports the same barcode twice in a row', async () => {
    setup();
    const callable = jest.fn(async () => found);
    global.__httpsCallable = jest.fn(() => callable);
    render(<BarcodeScanScreen />);
    await act(async () => {
      const handler = global.__camera.onBarcodeScanned;
      handler({ data: '0123456789012' });
      handler({ data: '0123456789012' });
    });
    expect(callable).toHaveBeenCalledTimes(1);
  });

  it('says so when the barcode is not in the database', async () => {
    setup();
    global.__httpsCallable = jest.fn(() => jest.fn(async () => ({ data: { found: false } })));
    render(<BarcodeScanScreen />);
    await scan();
    expect(alertSpy).toHaveBeenCalledWith('Product Not Found', expect.any(String), expect.any(Array));
  });

  it('says so when the lookup itself fails', async () => {
    setup();
    global.__httpsCallable = jest.fn(() => jest.fn(async () => { throw new Error('offline'); }));
    render(<BarcodeScanScreen />);
    await scan();
    expect(alertSpy).toHaveBeenCalledWith('Lookup Failed', expect.any(String), expect.any(Array));
  });

  it('asks for camera permission before scanning', () => {
    setup();
    global.__permission = [{ granted: false }, jest.fn()];
    const utils = render(<BarcodeScanScreen />);
    expect(utils.getByText('Camera Permission Required')).toBeTruthy();
    fireEvent.press(utils.getByText('Grant Permission'));
    expect(global.__permission[1]).toHaveBeenCalled();
  });
});

describe('photo scanner', () => {
  const pasta = { name: 'Pasta', confidence: 0.8, calories: 158, protein: 6, carbs: 31, fat: 1 };

  // The picture is read from the phone with fetch + FileReader; the AI itself is
  // reached through the postLLM Cloud Function (a callable), never a plain URL.
  const mockPhoto = () => {
    global.fetch = jest.fn(async () => ({ blob: async () => 'blob' }));
    global.FileReader = class {
      readAsDataURL() {
        // The phone labels the picture with a generic type; the app must not pass that on.
        this.result = 'data:application/octet-stream;base64,QUJD';
        Promise.resolve().then(() => this.onloadend());
      }
    };
    global.__takePicture = jest.fn(async () => ({ uri: 'file:///photo.jpg' }));
  };
  const mockAi = (reply) => {
    const call = jest.fn(async () => (typeof reply === 'function' ? reply() : { data: { completion: reply } }));
    global.__httpsCallable = jest.fn(() => call);
    return call;
  };
  const mockNetwork = (completion) => { mockPhoto(); return mockAi(completion); };

  const capture = async (utils) => {
    await act(async () => { fireEvent.press(utils.getByTestId('scan-capture')); });
  };

  it('identifies a photo and labels the numbers per 100g', async () => {
    setup();
    mockNetwork(JSON.stringify(pasta));
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => expect(utils.getByText('Pasta')).toBeTruthy());
    expect(utils.getByText('Nutrition (per 100g)')).toBeTruthy();
    expect(utils.getByText('158')).toBeTruthy();
  });

  it('sends the picture to the postLLM function as a JPEG image, not to a web address', async () => {
    setup();
    const call = mockNetwork(JSON.stringify(pasta));
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => utils.getByText('Pasta'));
    expect(global.__httpsCallable).toHaveBeenCalledWith({ fake: true }, 'postLLM', expect.objectContaining({ timeout: expect.any(Number) }));
    expect(call).toHaveBeenCalledTimes(1);
    const { messages } = call.mock.calls[0][0];
    const parts = messages[messages.length - 1].content;
    expect(parts.find((p) => p.type === 'text')).toBeTruthy();
    expect(parts.find((p) => p.type === 'image_url')).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,QUJD' },
    });
    // the only web request is reading the picture off the phone
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('file:///photo.jpg');
  });

  it('asks the camera for a picture small enough to send', async () => {
    setup();
    mockNetwork(JSON.stringify(pasta));
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => utils.getByText('Pasta'));
    const opts = global.__takePicture.mock.calls[0][0];
    expect(opts.quality).toBeLessThanOrEqual(0.6);
  });

  it('reads an answer the AI wraps in a code fence', async () => {
    setup();
    mockNetwork('```json\n' + JSON.stringify(pasta) + '\n```');
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => expect(utils.getByText('Pasta')).toBeTruthy());
  });

  it('shows "Analyzing food..." while the AI is working, and stops once it answers', async () => {
    setup();
    let release;
    mockNetwork(() => new Promise((resolve) => { release = () => resolve({ data: { completion: JSON.stringify(pasta) } }); }));
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => expect(utils.getByText('Analyzing food...')).toBeTruthy());
    expect(utils.queryByTestId('scan-capture')).toBeNull();
    await act(async () => { release(); });
    await waitFor(() => expect(utils.getByText('Pasta')).toBeTruthy());
    expect(utils.queryByText('Analyzing food...')).toBeNull();
  });

  it('Add to Meal goes to the log screen as a 100g food, with the chosen meal', async () => {
    setup({ mealId: 'lunch' });
    mockNetwork(JSON.stringify({ ...pasta, servingSize: '1 bowl' }));
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => utils.getByText('Add to Meal'));
    fireEvent.press(utils.getByText('Add to Meal'));
    expect(global.__router.replace).toHaveBeenCalledTimes(1);
    const arg = global.__router.replace.mock.calls[0][0];
    expect(arg.pathname).toBe('/nutrition/food/scanned');
    expect(arg.params.mealId).toBe('lunch');
    expect(JSON.parse(arg.params.scannedFood)).toMatchObject({ name: 'Pasta', calories: 158, servingSize: '100g' });
  });

  it('leaves the meal out when none was chosen', async () => {
    setup();
    mockNetwork(JSON.stringify(pasta));
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => utils.getByText('Add to Meal'));
    fireEvent.press(utils.getByText('Add to Meal'));
    expect(global.__router.replace.mock.calls[0][0].params.mealId).toBeUndefined();
  });

  it('tells the person when no food was recognised', async () => {
    setup();
    mockNetwork('null');
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Analysis Failed', expect.stringMatching(/clearer photo/)));
    expect(utils.queryByText('Add to Meal')).toBeNull();
  });

  it('tells the person when the AI cannot be reached, and lets them try again', async () => {
    setup();
    mockNetwork(() => { throw new Error('unavailable'); });
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Analysis Failed', expect.stringMatching(/connection/)));
    expect(utils.queryByText('Add to Meal')).toBeNull();
    expect(utils.getByTestId('scan-capture')).toBeTruthy();
  });

  describe('when today\'s AI requests are used up', () => {
    const used = (tier, limit) => Object.assign(new Error('used up'), {
      code: 'functions/resource-exhausted',
      details: { reason: 'ai_limit', bucket: 'assist', tier, limit },
    });
    const limitAlert = () => alertSpy.mock.calls.find((c) => c[0] === 'Daily limit reached');

    it('says so, instead of blaming the connection, and offers the plans to a free person', async () => {
      setup();
      mockNetwork(() => { throw used('free', 5); });
      const utils = render(<FoodScanScreen />);
      await capture(utils);
      await waitFor(() => expect(limitAlert()).toBeTruthy());
      const [, message, buttons] = limitAlert();
      expect(message).toContain('You have used your 5 free AI requests for today.');
      expect(message).toContain('Upgrade to Pro for 100 a day');
      expect(alertSpy).not.toHaveBeenCalledWith('Analysis Failed', expect.any(String));
      expect(buttons.map((b) => b.text)).toEqual(['Not now', 'See plans']);
      expect(buttons[0].style).toBe('cancel');
      expect(global.__router.push).not.toHaveBeenCalled();
      buttons[1].onPress();
      expect(global.__router.push).toHaveBeenCalledWith('/paywall');
      expect(utils.getByTestId('scan-capture')).toBeTruthy();
    });

    it('offers Legend to a Pro person', async () => {
      setup();
      mockNetwork(() => { throw used('pro', 100); });
      const utils = render(<FoodScanScreen />);
      await capture(utils);
      await waitFor(() => expect(limitAlert()).toBeTruthy());
      expect(limitAlert()[1]).toContain('Upgrade to Legend for 300 a day');
      expect(limitAlert()[2].map((b) => b.text)).toEqual(['Not now', 'See plans']);
    });

    it('offers no plans to a Legend person, who has none higher to go to', async () => {
      setup();
      mockNetwork(() => { throw used('legend', 300); });
      const utils = render(<FoodScanScreen />);
      await capture(utils);
      await waitFor(() => expect(limitAlert()).toBeTruthy());
      expect(limitAlert()[1]).toContain('They come back at midnight Eastern.');
      expect(limitAlert()[2]).toEqual([{ text: 'OK' }]);
    });
  });

  it('tells the person when the picture cannot be read', async () => {
    setup();
    mockPhoto();
    global.fetch = jest.fn(async () => { throw new Error('no file'); });
    const call = mockAi('{}');
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Analysis Failed', expect.any(String)));
    expect(call).not.toHaveBeenCalled();
  });
});
