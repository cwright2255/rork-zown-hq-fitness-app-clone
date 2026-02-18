import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, SafeAreaView } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { X, ScanLine, RotateCcw, Loader2, CheckCircle, Package } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';

interface BarcodeResult {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  barcode: string;
}

export default function BarcodeScanScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [scanResult, setScanResult] = useState<BarcodeResult | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const toggleCameraFacing = useCallback(() => {
    setFacing((current: CameraType) => (current === 'back' ? 'front' : 'back'));
  }, []);

  const lookupBarcode = useCallback(async (barcode: string) => {
    setIsLookingUp(true);
    setIsScanning(false);
    
    try {
      console.log('Looking up barcode:', barcode);
      
      // Mock barcode lookup - in a real app, you'd use a service like Open Food Facts API
      // For demo purposes, we'll simulate a lookup with AI
      const aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a food database expert. Given a barcode number, provide nutritional information for a common food product. Return ONLY a JSON object with: name, brand (optional), calories, protein, carbs, fat (all per 100g), servingSize, and barcode. If barcode is not recognized, create a plausible food product.'
            },
            {
              role: 'user',
              content: `Look up nutritional information for barcode: ${barcode}`
            }
          ]
        })
      });
      
      const aiResult = await aiResponse.json();
      console.log('Barcode lookup result:', aiResult);
      
      try {
        const productData = JSON.parse(aiResult.completion);
        if (productData && productData.name) {
          setScanResult({
            ...productData,
            barcode: barcode
          });
        } else {
          throw new Error('Product not found');
        }
      } catch (parseError) {
        console.error('Failed to parse barcode response:', parseError);
        Alert.alert(
          'Product Not Found', 
          'This barcode is not in our database. You can still add the food manually.',
          [
            { text: 'Try Again', onPress: () => setIsScanning(true) },
            { text: 'Manual Entry', onPress: () => router.push('/nutrition/search' as any) }
          ]
        );
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      Alert.alert(
        'Lookup Failed', 
        'Failed to look up the barcode. Please check your connection and try again.',
        [
          { text: 'Try Again', onPress: () => setIsScanning(true) },
          { text: 'Manual Entry', onPress: () => router.push('/nutrition/search' as any) }
        ]
      );
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  const handleBarcodeScanned = useCallback(({ type, data }: { type: string; data: string }) => {
    if (!isScanning) return;
    
    console.log('Barcode scanned:', { type, data });
    lookupBarcode(data);
  }, [isScanning, lookupBarcode]);

  const addToMeal = useCallback(() => {
    if (!scanResult) return;
    
    // Navigate back to nutrition page with the scanned product data
    router.push({
      pathname: '/nutrition/search' as any,
      params: {
        scannedFood: JSON.stringify(scanResult)
      }
    });
  }, [scanResult]);

  const scanAgain = useCallback(() => {
    setScanResult(null);
    setIsScanning(true);
  }, []);

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Loader2 size={32} color={Colors.primary} />
          <Text style={styles.loadingText}>Loading camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <ScanLine size={64} color={Colors.text.secondary} />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need access to your camera to scan barcodes on food packages for nutrition tracking.
          </Text>
          <Button 
            title="Grant Permission" 
            onPress={requestPermission}
            style={styles.permissionButton}
          />
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (scanResult) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <X size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Product Found</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.resultContainer}>
          <Card variant="elevated" style={styles.resultCard}>
            <View style={styles.successIcon}>
              <CheckCircle size={48} color={Colors.success} />
            </View>
            
            <Text style={styles.productName}>{scanResult.name}</Text>
            {scanResult.brand && (
              <Text style={styles.brandName}>{scanResult.brand}</Text>
            )}
            <Text style={styles.barcodeText}>Barcode: {scanResult.barcode}</Text>
            
            <View style={styles.nutritionInfo}>
              <Text style={styles.nutritionTitle}>Nutrition (per {scanResult.servingSize})</Text>
              
              <View style={styles.nutritionGrid}>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{scanResult.calories}</Text>
                  <Text style={styles.nutritionLabel}>Calories</Text>
                </View>
                
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{scanResult.protein}g</Text>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                </View>
                
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{scanResult.carbs}g</Text>
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                </View>
                
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{scanResult.fat}g</Text>
                  <Text style={styles.nutritionLabel}>Fat</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.actionButtons}>
              <Button 
                title="Add to Meal"
                onPress={addToMeal}
                style={styles.addButton}
              />
              
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={scanAgain}
              >
                <Text style={styles.retryButtonText}>Scan Another</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <X size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Barcode</Text>
        <TouchableOpacity 
          style={styles.flipButton}
          onPress={toggleCameraFacing}
        >
          <RotateCcw size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
      </View>
      
      {Platform.OS !== 'web' ? (
        <CameraView 
          ref={cameraRef}
          style={styles.camera} 
          facing={facing}
          barcodeScannerSettings={{
            barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8', 'code128', 'code39'],
          }}
          onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.scanArea}>
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                
                <View style={styles.scanLine} />
              </View>
            </View>
            
            <View style={styles.instructionContainer}>
              {isLookingUp ? (
                <View style={styles.lookupContainer}>
                  <Loader2 size={32} color={Colors.text.inverse} />
                  <Text style={styles.lookupText}>Looking up product...</Text>
                </View>
              ) : (
                <>
                  <Package size={32} color={Colors.text.inverse} />
                  <Text style={styles.instructionText}>
                    Position the barcode within the frame
                  </Text>
                  <Text style={styles.subInstructionText}>
                    Make sure the barcode is clearly visible and well-lit
                  </Text>
                </>
              )}
            </View>
          </View>
        </CameraView>
      ) : (
        <View style={styles.webFallback}>
          <ScanLine size={64} color={Colors.text.secondary} />
          <Text style={styles.webFallbackTitle}>Barcode Scanner Not Available</Text>
          <Text style={styles.webFallbackText}>
            Barcode scanning is not available on web. Please use the mobile app for this feature.
          </Text>
          <Button 
            title="Go Back"
            onPress={() => router.back()}
            style={styles.webFallbackButton}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Colors.spacing.lg,
    paddingVertical: Colors.spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: Colors.radius.large,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.inverse,
  },
  flipButton: {
    width: 40,
    height: 40,
    borderRadius: Colors.radius.large,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 40,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 120,
    paddingBottom: 80,
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 180,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    width: '80%',
    height: 2,
    backgroundColor: Colors.primary,
    opacity: 0.8,
  },
  instructionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: Colors.spacing.xl,
    paddingVertical: Colors.spacing.lg,
    borderRadius: Colors.radius.large,
    marginHorizontal: Colors.spacing.lg,
    alignItems: 'center',
  },
  instructionText: {
    color: Colors.text.inverse,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600' as const,
    marginTop: Colors.spacing.md,
  },
  subInstructionText: {
    color: Colors.text.inverse,
    fontSize: 14,
    textAlign: 'center',
    marginTop: Colors.spacing.sm,
    opacity: 0.8,
  },
  lookupContainer: {
    alignItems: 'center',
  },
  lookupText: {
    color: Colors.text.inverse,
    fontSize: 16,
    marginTop: Colors.spacing.sm,
    fontWeight: '500' as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: Colors.spacing.md,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Colors.spacing.xl,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginTop: Colors.spacing.lg,
    marginBottom: Colors.spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Colors.spacing.xl,
  },
  permissionButton: {
    marginBottom: Colors.spacing.lg,
  },
  backButton: {
    paddingVertical: Colors.spacing.md,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  resultContainer: {
    flex: 1,
    padding: Colors.spacing.lg,
    justifyContent: 'center',
  },
  resultCard: {
    padding: Colors.spacing.xl,
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: Colors.spacing.lg,
  },
  productName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Colors.spacing.xs,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Colors.spacing.sm,
  },
  barcodeText: {
    fontSize: 14,
    color: Colors.text.tertiary,
    marginBottom: Colors.spacing.xl,
  },
  nutritionInfo: {
    width: '100%',
    marginBottom: Colors.spacing.xl,
  },
  nutritionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: Colors.spacing.lg,
    textAlign: 'center',
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: Colors.spacing.xs,
  },
  nutritionLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  actionButtons: {
    width: '100%',
    gap: Colors.spacing.md,
  },
  addButton: {
    marginBottom: 0,
  },
  retryButton: {
    paddingVertical: Colors.spacing.md,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Colors.spacing.xl,
  },
  webFallbackTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginTop: Colors.spacing.lg,
    marginBottom: Colors.spacing.md,
    textAlign: 'center',
  },
  webFallbackText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Colors.spacing.xl,
  },
  webFallbackButton: {
    marginBottom: 0,
  },
});