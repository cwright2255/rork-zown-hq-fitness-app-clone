import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, SafeAreaView } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { X, Camera, RotateCcw, Loader2, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';

interface FoodAnalysisResult {
  name: string;
  confidence: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
}

export default function FoodScanScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResult | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const toggleCameraFacing = useCallback(() => {
    setFacing((current: CameraType) => (current === 'back' ? 'front' : 'back'));
  }, []);

  const analyzeFood = useCallback(async (imageUri: string) => {
    setIsAnalyzing(true);
    
    try {
      console.log('Analyzing food image:', imageUri);
      
      // Convert image to base64 for AI analysis
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        const base64Image = base64Data.split(',')[1];
        
        try {
          // Call AI service for food recognition
          const aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
                {
                  role: 'system',
                  content: 'You are a nutrition expert. Analyze the food in the image and provide detailed nutritional information. Return ONLY a JSON object with: name, confidence (0-1), calories, protein, carbs, fat (all per 100g), and servingSize. If you cannot identify food, return null.'
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Analyze this food image and provide nutritional information.'
                    },
                    {
                      type: 'image',
                      image: base64Image
                    }
                  ]
                }
              ]
            })
          });
          
          const aiResult = await aiResponse.json();
          console.log('AI Analysis Result:', aiResult);
          
          try {
            const foodData = JSON.parse(aiResult.completion);
            if (foodData && foodData.name) {
              setAnalysisResult(foodData);
            } else {
              throw new Error('No food detected');
            }
          } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            Alert.alert('Analysis Failed', 'Could not identify food in the image. Please try again with a clearer photo.');
          }
        } catch (error) {
          console.error('AI analysis error:', error);
          Alert.alert('Analysis Failed', 'Failed to analyze the image. Please check your connection and try again.');
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Image processing error:', error);
      Alert.alert('Error', 'Failed to process the image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;
    
    try {
      console.log('Taking picture...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      
      if (photo?.uri) {
        console.log('Photo taken:', photo.uri);
        await analyzeFood(photo.uri);
      }
    } catch (error) {
      console.error('Failed to take picture:', error);
      Alert.alert('Camera Error', 'Failed to take picture. Please try again.');
    }
  }, [analyzeFood]);

  const addToMeal = useCallback(() => {
    if (!analysisResult) return;
    
    // Navigate back to nutrition page with the analyzed food data
    router.push({
      pathname: '/nutrition/search' as any,
      params: {
        scannedFood: JSON.stringify(analysisResult)
      }
    });
  }, [analysisResult]);

  const retryAnalysis = useCallback(() => {
    setAnalysisResult(null);
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
          <Camera size={64} color={Colors.text.secondary} />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need access to your camera to scan and identify food items for nutrition tracking.
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

  if (analysisResult) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <X size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Food Identified</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.resultContainer}>
          <Card variant="elevated" style={styles.resultCard}>
            <View style={styles.successIcon}>
              <CheckCircle size={48} color={Colors.success} />
            </View>
            
            <Text style={styles.foodName}>{analysisResult.name}</Text>
            <Text style={styles.confidence}>
              Confidence: {Math.round(analysisResult.confidence * 100)}%
            </Text>
            
            <View style={styles.nutritionInfo}>
              <Text style={styles.nutritionTitle}>Nutrition (per {analysisResult.servingSize})</Text>
              
              <View style={styles.nutritionGrid}>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{analysisResult.calories}</Text>
                  <Text style={styles.nutritionLabel}>Calories</Text>
                </View>
                
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{analysisResult.protein}g</Text>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                </View>
                
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{analysisResult.carbs}g</Text>
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                </View>
                
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{analysisResult.fat}g</Text>
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
                onPress={retryAnalysis}
              >
                <Text style={styles.retryButtonText}>Scan Again</Text>
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
        <Text style={styles.headerTitle}>Scan Food</Text>
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
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.scanFrame} />
            
            <View style={styles.instructionContainer}>
              <Text style={styles.instructionText}>
                Point your camera at food and tap the capture button
              </Text>
            </View>
            
            <View style={styles.cameraControls}>
              {isAnalyzing ? (
                <View style={styles.analyzingContainer}>
                  <Loader2 size={32} color={Colors.text.inverse} />
                  <Text style={styles.analyzingText}>Analyzing food...</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.captureButton}
                  onPress={takePicture}
                >
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </CameraView>
      ) : (
        <View style={styles.webFallback}>
          <Camera size={64} color={Colors.text.secondary} />
          <Text style={styles.webFallbackTitle}>Camera Not Available</Text>
          <Text style={styles.webFallbackText}>
            Food scanning is not available on web. Please use the mobile app for this feature.
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
    paddingTop: 100,
    paddingBottom: 50,
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Colors.radius.large,
    backgroundColor: 'transparent',
  },
  instructionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: Colors.spacing.lg,
    paddingVertical: Colors.spacing.md,
    borderRadius: Colors.radius.large,
    marginHorizontal: Colors.spacing.lg,
  },
  instructionText: {
    color: Colors.text.inverse,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  cameraControls: {
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.text.inverse,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: Colors.primary,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
  },
  analyzingContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: Colors.spacing.lg,
    paddingVertical: Colors.spacing.md,
    borderRadius: Colors.radius.large,
  },
  analyzingText: {
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
  foodName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Colors.spacing.sm,
  },
  confidence: {
    fontSize: 16,
    color: Colors.text.secondary,
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