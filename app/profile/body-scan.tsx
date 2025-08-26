import React, { useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, TextInput } from 'react-native';
import { Stack, router } from 'expo-router';
import { Camera as CameraIcon, Scan, Save, Ruler, Aperture, RefreshCw } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { useProgressStore } from '@/store/progressStore';

export default function BodyScanScreen() {
  const { addEntry } = useProgressStore();
  const [step, setStep] = useState<number>(1);
  const [measurements, setMeasurements] = useState<{ weight: string; height: string; chest: string; waist: string; hips: string; inseam: string; shoulders: string; arms: string; }>({
    weight: '',
    height: '',
    chest: '',
    waist: '',
    hips: '',
    inseam: '',
    shoulders: '',
    arms: '',
  });
  const [scanComplete, setScanComplete] = useState<boolean>(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const poses = useMemo(() => ['Front', 'Side', 'Back'] as const, []);
  type Pose = typeof poses[number];
  const [currentPoseIndex, setCurrentPoseIndex] = useState<number>(0);
  const [photos, setPhotos] = useState<Record<Pose, string | null>>({ Front: null, Side: null, Back: null });
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  const handleNextStep = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleSaveProgress();
    }
  };

  const handlePreviousStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleStartScan = useCallback(async () => {
    try {
      console.log('[BodyScan] handleStartScan invoked');
      if (!permission?.granted) {
        const res = await requestPermission?.();
        console.log('[BodyScan] permission request result', res);
        if (!res?.granted) {
          Alert.alert('Camera permission needed', 'Please allow camera access to capture your scan.');
          return;
        }
      }
      setScanComplete(false);
      setPhotos({ Front: null, Side: null, Back: null });
      setCurrentPoseIndex(0);
    } catch (e) {
      console.error('[BodyScan] Error starting scan', e);
      Alert.alert('Error', 'Unable to start camera. Please try again.');
    }
  }, [permission?.granted, requestPermission]);

  const handleSaveProgress = useCallback(() => {
    try {
      console.log('[BodyScan] handleSaveProgress invoked');
      const numericMeasurements = {
        weight: parseFloat(measurements.weight) || 0,
        height: parseFloat(measurements.height) || 0,
        chest: parseFloat(measurements.chest) || 0,
        waist: parseFloat(measurements.waist) || 0,
        hips: parseFloat(measurements.hips) || 0,
        inseam: parseFloat(measurements.inseam) || 0,
        shoulders: parseFloat(measurements.shoulders) || 0,
        arms: parseFloat(measurements.arms) || 0,
      };

      addEntry({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        measurements: numericMeasurements,
        bodyFat: Math.floor(Math.random() * 10) + 15,
        photos: [photos.Front ?? '', photos.Side ?? '', photos.Back ?? ''].filter(Boolean) as string[],
        bodyScan: {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          measurements: numericMeasurements,
          modelUrl: photos.Front ?? undefined,
          thumbnailUrl: photos.Side ?? photos.Back ?? photos.Front ?? undefined,
          photos: { front: photos.Front ?? undefined, side: photos.Side ?? undefined, back: photos.Back ?? undefined }
        }
      } as any);

      Alert.alert(
        'Progress Saved',
        'Your body measurements and capture set have been saved.',
        [
          { text: 'OK', onPress: () => router.push('/profile/progress') }
        ]
      );
    } catch (e) {
      console.error('[BodyScan] Error saving progress', e);
      Alert.alert('Error', 'Failed to save progress.');
    }
  }, [addEntry, measurements, photos]);

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Step 1: Prepare for Scan</Text>
      <Text style={styles.stepDescription}>
        For the most accurate results, please follow these guidelines:
      </Text>

      <Card variant="elevated" style={styles.instructionsCard}>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>1</Text>
          <Text style={styles.instructionText}>
            Wear form-fitting clothing (like athletic wear)
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>2</Text>
          <Text style={styles.instructionText}>
            Stand in a well-lit area with a plain background
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>3</Text>
          <Text style={styles.instructionText}>
            Remove bulky clothing, shoes, and accessories
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>4</Text>
          <Text style={styles.instructionText}>
            Make sure your entire body is visible in the frame
          </Text>
        </View>
      </Card>

      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGZpdG5lc3MlMjBzY2FufGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60' }}
        style={styles.instructionImage}
        resizeMode="cover"
      />

      <Button
        title="Continue to Measurements"
        onPress={handleNextStep}
        style={styles.continueButton}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Step 2: Enter Measurements</Text>
      <Text style={styles.stepDescription}>
        Enter your current measurements to enhance the accuracy of your 3D model:
      </Text>

      <ScrollView style={styles.measurementsContainer}>
        <View style={styles.measurementItem}>
          <View style={styles.measurementLabelContainer}>
            <Ruler size={20} color={Colors.text.secondary} />
            <Text style={styles.measurementLabel}>Weight (kg)</Text>
          </View>
          <TextInput
            style={styles.measurementInput}
            value={measurements.weight}
            onChangeText={(text) => setMeasurements({ ...measurements, weight: text })}
            keyboardType="numeric"
            placeholder="0.0"
          />
        </View>

        <View style={styles.measurementItem}>
          <View style={styles.measurementLabelContainer}>
            <Ruler size={20} color={Colors.text.secondary} />
            <Text style={styles.measurementLabel}>Height (cm)</Text>
          </View>
          <TextInput
            style={styles.measurementInput}
            value={measurements.height}
            onChangeText={(text) => setMeasurements({ ...measurements, height: text })}
            keyboardType="numeric"
            placeholder="0.0"
          />
        </View>

        <View style={styles.measurementItem}>
          <View style={styles.measurementLabelContainer}>
            <Ruler size={20} color={Colors.text.secondary} />
            <Text style={styles.measurementLabel}>Chest (cm)</Text>
          </View>
          <TextInput
            style={styles.measurementInput}
            value={measurements.chest}
            onChangeText={(text) => setMeasurements({ ...measurements, chest: text })}
            keyboardType="numeric"
            placeholder="0.0"
          />
        </View>

        <View style={styles.measurementItem}>
          <View style={styles.measurementLabelContainer}>
            <Ruler size={20} color={Colors.text.secondary} />
            <Text style={styles.measurementLabel}>Waist (cm)</Text>
          </View>
          <TextInput
            style={styles.measurementInput}
            value={measurements.waist}
            onChangeText={(text) => setMeasurements({ ...measurements, waist: text })}
            keyboardType="numeric"
            placeholder="0.0"
          />
        </View>

        <View style={styles.measurementItem}>
          <View style={styles.measurementLabelContainer}>
            <Ruler size={20} color={Colors.text.secondary} />
            <Text style={styles.measurementLabel}>Hips (cm)</Text>
          </View>
          <TextInput
            style={styles.measurementInput}
            value={measurements.hips}
            onChangeText={(text) => setMeasurements({ ...measurements, hips: text })}
            keyboardType="numeric"
            placeholder="0.0"
          />
        </View>

        <View style={styles.measurementItem}>
          <View style={styles.measurementLabelContainer}>
            <Ruler size={20} color={Colors.text.secondary} />
            <Text style={styles.measurementLabel}>Inseam (cm)</Text>
          </View>
          <TextInput
            style={styles.measurementInput}
            value={measurements.inseam}
            onChangeText={(text) => setMeasurements({ ...measurements, inseam: text })}
            keyboardType="numeric"
            placeholder="0.0"
          />
        </View>

        <View style={styles.measurementItem}>
          <View style={styles.measurementLabelContainer}>
            <Ruler size={20} color={Colors.text.secondary} />
            <Text style={styles.measurementLabel}>Shoulders (cm)</Text>
          </View>
          <TextInput
            style={styles.measurementInput}
            value={measurements.shoulders}
            onChangeText={(text) => setMeasurements({ ...measurements, shoulders: text })}
            keyboardType="numeric"
            placeholder="0.0"
          />
        </View>

        <View style={styles.measurementItem}>
          <View style={styles.measurementLabelContainer}>
            <Ruler size={20} color={Colors.text.secondary} />
            <Text style={styles.measurementLabel}>Arms (cm)</Text>
          </View>
          <TextInput
            style={styles.measurementInput}
            value={measurements.arms}
            onChangeText={(text) => setMeasurements({ ...measurements, arms: text })}
            keyboardType="numeric"
            placeholder="0.0"
          />
        </View>
      </ScrollView>

      <View style={styles.navigationButtons}>
        <Button
          title="Back"
          onPress={handlePreviousStep}
          style={[styles.navigationButton, styles.backButton]}
          textStyle={styles.backButtonText}
        />
        <Button
          title="Continue to Scan"
          onPress={handleNextStep}
          style={[styles.navigationButton, styles.nextButton]}
        />
      </View>
    </View>
  );

  const takePhoto = useCallback(async () => {
    try {
      console.log('[BodyScan] takePhoto start');
      if (!cameraRef.current) {
        Alert.alert('Camera not ready', 'Please wait a moment and try again.');
        return;
      }
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync?.({ quality: 0.8, skipProcessing: false });
      console.log('[BodyScan] photo result', photo);
      const uri = (photo as { uri?: string } | undefined)?.uri ?? null;
      if (!uri) {
        throw new Error('No URI from camera');
      }
      const pose = poses[currentPoseIndex];
      setPhotos((prev) => ({ ...prev, [pose]: uri }));
      if (currentPoseIndex < poses.length - 1) {
        setCurrentPoseIndex(currentPoseIndex + 1);
      } else {
        setScanComplete(true);
      }
    } catch (e) {
      console.error('[BodyScan] takePhoto error', e);
      Alert.alert('Capture failed', 'Could not take photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [currentPoseIndex, poses]);

  const resetCapture = useCallback(() => {
    setPhotos({ Front: null, Side: null, Back: null });
    setCurrentPoseIndex(0);
    setScanComplete(false);
  }, []);

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Step 3: Capture Poses</Text>
      <Text style={styles.stepDescription}>
        Capture 3 poses in good lighting: Front, Side, Back. This works on web and mobile. You can integrate 3D processing later.
      </Text>

      <Card variant="elevated" style={styles.scanCard}>
        {!scanComplete ? (
          <View style={{ width: '100%' }}>
            {permission?.granted ? (
              <View>
                <View style={styles.cameraContainer}>
                  <CameraView
                    ref={(ref) => { cameraRef.current = ref as unknown as CameraView; }}
                    style={styles.camera}
                    facing={facing}
                    testID="camera-view"
                  />
                  <View style={styles.overlayGuide} pointerEvents="none">
                    <Text style={styles.overlayText}>{poses[currentPoseIndex]} pose</Text>
                  </View>
                </View>
                <View style={styles.captureControls}>
                  <Button
                    title={isCapturing ? 'Capturing...' : 'Capture'}
                    onPress={takePhoto}
                    style={styles.captureButton}
                    leftIcon={<Aperture size={20} color={Colors.text.inverse} />}
                    disabled={isCapturing}
                    testID="capture-button"
                  />
                  <Button
                    title="Flip"
                    onPress={() => setFacing((cur) => (cur === 'back' ? 'front' : 'back'))}
                    style={styles.flipButton}
                    testID="flip-button"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>Camera access is required to capture poses.</Text>
                <Button title="Grant Permission" onPress={() => requestPermission?.()} style={styles.permissionButton} testID="permission-button" />
              </View>
            )}
          </View>
        ) : (
          <View style={{ width: '100%' }}>
            <View style={styles.previewRow}>
              {poses.map((p) => (
                <View key={p} style={styles.previewItem}>
                  {photos[p] ? (
                    <Image source={{ uri: photos[p] ?? undefined }} style={styles.previewImage} />
                  ) : (
                    <View style={styles.previewPlaceholder}>
                      <Scan size={24} color={Colors.text.tertiary} />
                      <Text style={styles.previewLabel}>{p}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
            <View style={styles.scanInfoContainer}>
              <Text style={styles.scanInfoTitle}>Capture Complete</Text>
              <Text style={styles.scanInfoText}>Review your photos, then save or retake.</Text>
              <Button title="Retake" onPress={resetCapture} style={styles.retakeButton} textStyle={styles.retakeButtonText} leftIcon={<RefreshCw size={18} color={Colors.text.primary} />} />
            </View>
          </View>
        )}

        {!scanComplete && (
          <Button
            title={permission?.granted ? 'Restart Capture' : 'Start Capture'}
            onPress={handleStartScan}
            style={styles.scanButton}
            leftIcon={<CameraIcon size={20} color={Colors.text.inverse} />}
            testID="start-capture-btn"
          />
        )}
      </Card>

      <View style={styles.navigationButtons}>
        <Button
          title="Back"
          onPress={handlePreviousStep}
          style={[styles.navigationButton, styles.backButton]}
          textStyle={styles.backButtonText}
          testID="back-button"
        />
        <Button
          title="Save Progress"
          onPress={handleSaveProgress}
          style={[styles.navigationButton, styles.saveButton]}
          leftIcon={<Save size={20} color={Colors.text.inverse} />}
          disabled={!scanComplete}
          testID="save-progress-button"
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Body Scan" }} />

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressLabel, step >= 1 && styles.activeProgressLabel]}>
            Prepare
          </Text>
          <Text style={[styles.progressLabel, step >= 2 && styles.activeProgressLabel]}>
            Measurements
          </Text>
          <Text style={[styles.progressLabel, step >= 3 && styles.activeProgressLabel]}>
            3D Scan
          </Text>
        </View>
      </View>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  progressContainer: {
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  activeProgressLabel: {
    color: Colors.primary,
    fontWeight: '600',
  },
  stepContainer: {
    flex: 1,
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 24,
  },
  instructionsCard: {
    marginBottom: 24,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    color: Colors.text.inverse,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '600',
    marginRight: 12,
  },
  instructionText: {
    fontSize: 16,
    color: Colors.text.primary,
    flex: 1,
  },
  instructionImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 24,
  },
  continueButton: {
    marginTop: 'auto',
  },
  measurementsContainer: {
    flex: 1,
    marginBottom: 16,
  },
  measurementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  measurementLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  measurementLabel: {
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: 8,
  },
  measurementInput: {
    width: 80,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontSize: 16,
    color: Colors.text.primary,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  navigationButton: {
    flex: 1,
  },
  backButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  backButtonText: {
    color: Colors.text.primary,
  },
  nextButton: {
    marginLeft: 8,
  },
  saveButton: {
    marginLeft: 8,
    backgroundColor: Colors.success,
  },
  scanCard: {
    flex: 1,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  overlayGuide: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
  },
  overlayText: {
    color: Colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  captureControls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  captureButton: {
    flex: 1,
  },
  flipButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 90,
  },
  scanPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  scanPlaceholderText: {
    fontSize: 16,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: 16,
  },
  scanButton: {
    marginTop: 24,
    minWidth: 200,
  },
  scanImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  previewItem: {
    flex: 1,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    marginTop: 8,
    color: Colors.text.secondary,
    fontSize: 12,
  },
  scanInfoContainer: {
    padding: 16,
    alignItems: 'center',
  },
  scanInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  scanInfoText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  retakeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retakeButtonText: {
    color: Colors.text.primary,
  },
  permissionContainer: {
    width: '100%',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  permissionText: {
    color: Colors.text.secondary,
    fontSize: 14,
    marginBottom: 12,
  },
  permissionButton: {
    minWidth: 180,
  },
});