#!/usr/bin/env python3
"""Remove the doubled space above the header on the barcode scanner screens and the trail detail photo
Run from the expo/ folder:  python3 apply_header_space.py
All-or-nothing: every change is matched in memory first and nothing is written unless all of it matches."""
import os, sys

NEW_FILES = {
 "__tests__/TrailPhotoHeaderSpace.test.jsx": "import React from 'react';\nimport { StyleSheet } from 'react-native';\nimport { act, render } from '@testing-library/react-native';\n\n// The trail detail screen floats its back button over the trail photo. This test uses the\n// real ScreenHeader and a safe area that behaves like the real one (a SafeAreaView pads the\n// top by the notch height unless its edges leave 'top' out), so it measures what a phone\n// would show: how far down the back button sits.\nconst INSET_TOP = 59; // an iPhone with the Dynamic Island\n\njest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });\njest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });\njest.mock('expo-router', () => ({\n  router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },\n  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),\n  useLocalSearchParams: () => ({ id: 'trailapi-77' }),\n}), { virtual: true });\njest.mock('react-native-safe-area-context', () => {\n  const mockReact = require('react');\n  const mockRn = require('react-native');\n  return {\n    useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),\n    SafeAreaView: ({ style, edges, children }) => {\n      const padsTop = !edges || edges.includes('top');\n      return mockReact.createElement(mockRn.View, { style: [style, padsTop ? { paddingTop: 59 } : null] }, children);\n    },\n  };\n}, { virtual: true });\njest.mock('react-native-maps', () => {\n  const mockReact = require('react');\n  const mockRn = require('react-native');\n  const MapView = (props) => mockReact.createElement(mockRn.View, { testID: 'trail-route-map' }, props.children);\n  return { __esModule: true, default: MapView, MapView, Polyline: () => null, Marker: () => null, PROVIDER_DEFAULT: null };\n});\njest.mock('@/components/PrimaryButton', () => {\n  const mockReact = require('react');\n  const mockRn = require('react-native');\n  return { __esModule: true, default: ({ title }) => mockReact.createElement(mockRn.Text, null, title) };\n});\njest.mock('@/components/ElevationProfileChart', () => ({ __esModule: true, default: () => null }));\njest.mock('@/components/TrailWeather', () => ({ __esModule: true, default: () => null }));\njest.mock('@/components/MuscleHeatmapCard', () => ({ __esModule: true, default: () => null }));\njest.mock('@/lib/muscleFatigue', () => ({ getTargetMuscles: () => [], getTargetMuscleIntensities: () => ({}) }));\njest.mock('@/lib/openDirections', () => ({ promptDirections: jest.fn() }));\njest.mock('@/store/hikingStore', () => ({\n  useHikingStore: () => ({\n    getTrailById: () => ({\n      id: 'trailapi-77', source: 'trailapi', name: 'Old Rag Loop', address: 'Syria, VA',\n      latitude: 38.55, longitude: -78.3, lengthMiles: 9.2, distanceKm: 12.5,\n    }),\n    savedTrailIds: [], toggleSaveTrail: jest.fn(), userLocation: null,\n  }),\n}));\njest.mock('@/store/offlineTrailStore', () => ({\n  useOfflineTrailStore: () => ({ trails: {}, keepTrail: jest.fn(), removeTrail: jest.fn() }),\n}));\njest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));\njest.mock('@/store/bodyCompositionStore', () => ({\n  useBodyCompositionStore: () => ({ scans: [], loadScans: jest.fn() }),\n}));\njest.mock('@/services/hikingService', () => ({\n  getPhotoUrl: jest.fn(() => 'https://example.com/trail.jpg'),\n  getTrailMaps: jest.fn(async () => []),\n  fetchRouteForMap: jest.fn(async () => null),\n}));\njest.mock('@/services/gpxShare', () => ({ shareGpx: jest.fn(), gpxShareErrorText: () => '' }));\n\nimport TrailPreviewScreen from '../app/running/hiking/[id]';\n\n// The space above the back button: every top padding on the way up from it to the screen's edge.\nconst spaceAbove = (node) => {\n  let total = 0;\n  for (let n = node.parent; n; n = n.parent) {\n    if (typeof n.type !== 'string') continue; // only real views count; wrappers only pass a style on\n    const style = StyleSheet.flatten(n.props.style) || {};\n    total += style.paddingTop || 0;\n  }\n  return total;\n};\n\ndescribe('Trail detail: space above the back button', () => {\n  let warn;\n  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });\n  afterEach(() => { warn.mockRestore(); });\n\n  it('leaves room for the notch once, not twice, above the back button', async () => {\n    const utils = render(<TrailPreviewScreen />);\n    await act(async () => { await Promise.resolve(); await Promise.resolve(); });\n    // The header pads the notch plus a little breathing room (8). A second top safe area\n    // around the screen used to add the notch height again: 126 instead of 67.\n    expect(spaceAbove(utils.UNSAFE_getByType('ChevronLeft'))).toBe(INSET_TOP + 8);\n    utils.unmount();\n  });\n\n  it('keeps the save button on the photo beside the back button', async () => {\n    const utils = render(<TrailPreviewScreen />);\n    await act(async () => { await Promise.resolve(); await Promise.resolve(); });\n    expect(utils.getByTestId('trail-save-button')).toBeTruthy();\n    utils.unmount();\n  });\n\n  it('measures what it claims: a screen inside a second top safe area is caught', async () => {\n    const { SafeAreaView } = require('react-native-safe-area-context');\n    const ScreenHeader = require('@/components/ScreenHeader').default;\n    const utils = render(\n      <SafeAreaView edges={['top', 'bottom']}>\n        <ScreenHeader showBack transparent />\n      </SafeAreaView>,\n    );\n    expect(spaceAbove(utils.UNSAFE_getByType('ChevronLeft'))).toBe(INSET_TOP * 2 + 8);\n  });\n});\n"
}

EDITS = {
 "__tests__/screenHeaderSafeArea.test.js": [
  [
   "});\n\n// Screens this still happens on, by file and how many times. Fixing one means lowering\n// its number (or removing the line); a new screen with the problem fails here.\nconst STILL_DOUBLED = {\n  'app/nutrition/barcode-scan.jsx': 3, // the loading, camera-access and Product Found screens\n  'app/running/hiking/[id].jsx': 1, // the trail detail with its photo\n};\n\ndescribe('screens in app/', () => {\n",
   "});\n\n// Screens this still happens on, by file and how many times. None are left, so a new\n// screen with the problem fails here. To allow one on purpose, list its file and the count.\nconst STILL_DOUBLED = {};\n\ndescribe('screens in app/', () => {\n"
  ]
 ],
 "app/nutrition/barcode-scan.jsx": [
  [
   "import React, { useState, useRef, useCallback } from 'react';\nimport { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from 'react-native';\nimport { CameraView, useCameraPermissions } from 'expo-camera';\nimport { router, useLocalSearchParams } from 'expo-router';\n",
   "import React, { useState, useRef, useCallback } from 'react';\nimport { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';\nimport { CameraView, useCameraPermissions } from 'expo-camera';\nimport { router, useLocalSearchParams } from 'expo-router';\n"
  ],
  [
   "  if (!permission) {\n    return (\n      <SafeAreaView style={styles.container}>\n        <ScreenHeader title=\"Scan Barcode\" showBack />\n        <View style={styles.center}><ActivityIndicator color=\"#000000\" /></View>\n      </SafeAreaView>\n    );\n  }\n",
   "  if (!permission) {\n    return (\n      <View style={styles.container}>\n        <ScreenHeader title=\"Scan Barcode\" showBack />\n        <View style={styles.center}><ActivityIndicator color=\"#000000\" /></View>\n      </View>\n    );\n  }\n"
  ],
  [
   "  if (!permission.granted) {\n    return (\n      <SafeAreaView style={styles.container}>\n        <ScreenHeader title=\"Scan Barcode\" showBack />\n        <View style={styles.permWrap}>\n",
   "  if (!permission.granted) {\n    return (\n      <View style={styles.container}>\n        <ScreenHeader title=\"Scan Barcode\" showBack />\n        <View style={styles.permWrap}>\n"
  ],
  [
   "          <PrimaryButton title=\"Grant Permission\" onPress={requestPermission} />\n        </View>\n      </SafeAreaView>\n    );\n  }\n",
   "          <PrimaryButton title=\"Grant Permission\" onPress={requestPermission} />\n        </View>\n      </View>\n    );\n  }\n"
  ],
  [
   "  if (scanResult) {\n    return (\n      <SafeAreaView style={styles.container}>\n        <ScreenHeader title=\"Product Found\" showBack />\n        <View style={{ padding: 16 }}>\n",
   "  if (scanResult) {\n    return (\n      <View style={styles.container}>\n        <ScreenHeader title=\"Product Found\" showBack />\n        <View style={{ padding: 16 }}>\n"
  ],
  [
   "          </View>\n        </View>\n      </SafeAreaView>\n    );\n  }\n",
   "          </View>\n        </View>\n      </View>\n    );\n  }\n"
  ]
 ],
 "app/running/hiking/[id].jsx": [
  [
   "\n  return (\n    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>\n      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>\n        <View style={styles.heroWrap}>\n",
   "\n  return (\n    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>\n      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>\n        <View style={styles.heroWrap}>\n"
  ]
 ]
}


DELETES = {
}

def main():
    if not os.path.isdir('app') or not os.path.isdir('lib'):
        sys.exit('Run this from the expo/ folder.')
    pending = {}
    for path, text in NEW_FILES.items():
        if os.path.exists(path) and open(path, encoding='utf-8').read() != text:
            sys.exit('MATCH FAILED: ' + path + ' already exists with different content')
        pending[path] = text
    for path, pairs in EDITS.items():
        if not os.path.exists(path):
            sys.exit('MATCH FAILED: missing file ' + path)
        text = open(path, encoding='utf-8').read()
        for old, new in pairs:
            if text.count(old) != 1:
                sys.exit('MATCH FAILED in ' + path + ' near: ' + repr(old[:70]))
            text = text.replace(old, new)
        pending[path] = text
    for path, text in DELETES.items():
        if os.path.exists(path) and open(path, encoding='utf-8').read() != text:
            sys.exit('MATCH FAILED: ' + path + ' was changed, not removing it')
    for path, text in pending.items():
        os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(text)
    removed = 0
    for path in DELETES:
        if os.path.exists(path):
            os.remove(path)
            removed += 1
    print('ALL FILES UPDATED OK (%d files written, %d removed)' % (len(pending), removed))

main()
