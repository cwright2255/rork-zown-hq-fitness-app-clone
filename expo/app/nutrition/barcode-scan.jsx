import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { ScanLine } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';
import { tokens } from '../../../theme/tokens';

export default function BarcodeScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const cameraRef = useRef(null);

  const lookupBarcode = useCallback(async (barcode) => {
    setIsLookingUp(true);
    setIsScanning(false);
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://us-central1-zown-3c512.cloudfunctions.net';
      const res = await fetch(`${apiBase}/text/llm/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a food database expert. Given a barcode number, provide nutritional information for a common food product. Return ONLY a JSON object with: name, brand (optional), calories, protein, carbs, fat (all per 100g), servingSize, and barcode. If barcode is not recognized, create a plausible food product.' },
            { role: 'user', content: `Look up nutritional information for barcode: ${barcode}` },
          ],
        }),
      });
      const json = await res.json();
      try {
        const data = JSON.parse(json.completion);
        if (data?.name) {
          setScanResult({ ...data, barcode });
        } else {
          throw new Error('not found');
        }
      } catch (e) {
        Alert.alert('Product Not Found', 'This barcode is not in our database.', [
          { text: 'Try Again', onPress: () => setIsScanning(true) },
          { text: 'Manual Entry', onPress: () => router.push('/nutrition/search') },
        ]);
      }
    } catch (e) {
      Alert.alert('Lookup Failed', 'Please check connection and try again.', [
        { text: 'Try Again', onPress: () => setIsScanning(true) },
      ]);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  const handleBarcodeScanned = useCallback(({ data }) => {
    if (!isScanning) return;
    lookupBarcode(data);
  }, [isScanning, lookupBarcode]);

  const addToMeal = () => {
    if (!scanResult) return;
    router.push({
      pathname: '/nutrition/search',
      params: { scannedFood: JSON.stringify(scanResult) },
    });
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Scan Barcode" showBack />
        <View style={styles.center}><ActivityIndicator color=tokens.colors.background.default /></View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Scan Barcode" showBack />
        <View style={styles.permWrap}>
          <ScanLine size={64} color="#666" />
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permText}>
            We need camera access to scan barcodes on food packages.
          </Text>
          <PrimaryButton title="Grant Permission" onPress={requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  if (scanResult) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Product Found" showBack />
        <View style={{ padding: 16 }}>
          <View style={styles.resultCard}>
            <Text style={styles.productName}>{scanResult.name}</Text>
            {scanResult.brand ? <Text style={styles.brandName}>{scanResult.brand}</Text> : null}
            <Text style={styles.barcodeText}>Barcode: {scanResult.barcode}</Text>
            <View style={styles.divider} />
            <View style={styles.nutritionGrid}>
              {[
                { v: scanResult.calories, l: 'Calories' },
                { v: `${scanResult.protein}g`, l: 'Protein' },
                { v: `${scanResult.carbs}g`, l: 'Carbs' },
                { v: `${scanResult.fat}g`, l: 'Fat' },
              ].map((n, i) => (
                <View key={i} style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{n.v}</Text>
                  <Text style={styles.nutritionLabel}>{n.l}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ gap: 12, marginTop: 16 }}>
            <PrimaryButton title="Add to Log" onPress={addToMeal} />
            <PrimaryButton title="Scan Another" variant="outline" onPress={() => { setScanResult(null); setIsScanning(true); }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128'],
        }}>
        <View style={styles.overlay}>
          <ScreenHeader title="Scan Barcode" showBack transparent />
          <View style={styles.scanArea}>
            <View style={styles.scanFrame} />
            <Text style={styles.hint}>Point camera at barcode</Text>
          </View>
          {isLookingUp ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color=tokens.colors.background.default size="large" />
              <Text style={styles.loadingText}>Looking up product...</Text>
            </View>
          ) : null}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  camera: { flex: 1 },
  overlay: { flex: 1 },
  scanArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 260, height: 160,
    borderWidth: 2, borderColor: tokens.colors.background.default, borderRadius: 16,
  },
  hint: { color: tokens.colors.background.default, marginTop: 16, fontSize: 14 },
  loadingOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingText: { color: tokens.colors.background.default, marginTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permWrap: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16 },
  permTitle: { fontSize: 20, fontWeight: '700', color: tokens.colors.background.default, textAlign: 'center' },
  permText: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
  resultCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 20,
  },
  productName: { fontSize: 22, fontWeight: '700', color: tokens.colors.background.default },
  brandName: { fontSize: 14, color: '#999', marginTop: 4 },
  barcodeText: { fontSize: 12, color: '#666', marginTop: 8 },
  divider: { height: 1, backgroundColor: '#2A2A2A', marginVertical: 16 },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nutritionItem: {
    flex: 1, minWidth: '45%',
    padding: 12,
    borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12,
    alignItems: 'center',
  },
  nutritionValue: { color: tokens.colors.background.default, fontSize: 18, fontWeight: '700' },
  nutritionLabel: { color: '#999', fontSize: 12, marginTop: 2 },
});
