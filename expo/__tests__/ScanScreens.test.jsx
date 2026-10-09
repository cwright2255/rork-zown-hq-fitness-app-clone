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

  const mockNetwork = (aiBody) => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/text/llm/')) return { json: async () => aiBody };
      return { blob: async () => 'blob' };
    });
    global.FileReader = class {
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,QUJD';
        Promise.resolve().then(() => this.onloadend());
      }
    };
    global.__takePicture = jest.fn(async () => ({ uri: 'file:///photo.jpg' }));
  };

  const capture = async (utils) => {
    await act(async () => { fireEvent.press(utils.getByTestId('scan-capture')); });
  };

  it('identifies a photo and labels the numbers per 100g', async () => {
    setup();
    mockNetwork({ completion: JSON.stringify(pasta) });
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => expect(utils.getByText('Pasta')).toBeTruthy());
    expect(utils.getByText('Nutrition (per 100g)')).toBeTruthy();
    expect(utils.getByText('158')).toBeTruthy();
  });

  it('Add to Meal goes to the log screen as a 100g food, with the chosen meal', async () => {
    setup({ mealId: 'lunch' });
    mockNetwork({ completion: JSON.stringify({ ...pasta, servingSize: '1 bowl' }) });
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
    mockNetwork({ completion: JSON.stringify(pasta) });
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => utils.getByText('Add to Meal'));
    fireEvent.press(utils.getByText('Add to Meal'));
    expect(global.__router.replace.mock.calls[0][0].params.mealId).toBeUndefined();
  });

  it('tells the person when no food was recognised', async () => {
    setup();
    mockNetwork({ completion: 'null' });
    const utils = render(<FoodScanScreen />);
    await capture(utils);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Analysis Failed', expect.any(String)));
    expect(utils.queryByText('Add to Meal')).toBeNull();
  });
});
