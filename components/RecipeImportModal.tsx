import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { X, Link, FileText } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import recipeExtractionService from '@/services/recipeExtractionService';
import { useRecipeStore } from '@/store/recipeStore';

interface RecipeImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RecipeImportModal({ visible, onClose, onSuccess }: RecipeImportModalProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'text'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { addRecipe } = useRecipeStore();

  const handleImportFromUrl = async () => {
    if (!urlInput.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    setIsLoading(true);
    try {
      const extractedRecipe = await recipeExtractionService.extractRecipeFromUrl(urlInput.trim());
      
      if (extractedRecipe) {
        await addRecipe(extractedRecipe);
        Alert.alert('Success', 'Recipe imported successfully!');
        setUrlInput('');
        onSuccess?.();
        onClose();
      } else {
        Alert.alert('No Recipe Found', 'Could not extract a recipe from this URL. Please try a different link or enter the recipe manually.');
      }
    } catch (error) {
      console.error('Error importing recipe:', error);
      Alert.alert('Error', 'Failed to import recipe. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportFromText = async () => {
    if (!textInput.trim()) {
      Alert.alert('Error', 'Please enter recipe text');
      return;
    }

    setIsLoading(true);
    try {
      const extractedRecipe = await recipeExtractionService.extractRecipeFromText(textInput.trim());
      
      if (extractedRecipe) {
        await addRecipe(extractedRecipe);
        Alert.alert('Success', 'Recipe imported successfully!');
        setTextInput('');
        onSuccess?.();
        onClose();
      } else {
        Alert.alert('No Recipe Found', 'Could not extract a recipe from this text. Please make sure it contains ingredients and instructions.');
      }
    } catch (error) {
      console.error('Error importing recipe:', error);
      Alert.alert('Error', 'Failed to import recipe. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardContent = await recipeExtractionService.handleSharedContent();
      if (clipboardContent) {
        if (activeTab === 'url') {
          setUrlInput(clipboardContent);
        } else {
          setTextInput(clipboardContent);
        }
      }
    } catch (error) {
      console.error('Error pasting from clipboard:', error);
      Alert.alert('Error', 'Failed to paste from clipboard');
    }
  };

  const resetModal = () => {
    setUrlInput('');
    setTextInput('');
    setActiveTab('url');
    setIsLoading(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Import Recipe</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'url' && styles.activeTab]}
            onPress={() => setActiveTab('url')}
          >
            <Link size={20} color={activeTab === 'url' ? Colors.primary : Colors.text.secondary} />
            <Text style={[styles.tabText, activeTab === 'url' && styles.activeTabText]}>
              From URL
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'text' && styles.activeTab]}
            onPress={() => setActiveTab('text')}
          >
            <FileText size={20} color={activeTab === 'text' ? Colors.primary : Colors.text.secondary} />
            <Text style={[styles.tabText, activeTab === 'text' && styles.activeTabText]}>
              From Text
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {activeTab === 'url' ? (
            <View style={styles.inputSection}>
              <Text style={styles.label}>Social Media URL</Text>
              <Text style={styles.description}>
                Paste a link from Instagram, TikTok, YouTube, Pinterest, or any recipe website
              </Text>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://instagram.com/p/recipe-post..."
                  value={urlInput}
                  onChangeText={setUrlInput}
                  placeholderTextColor={Colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <TouchableOpacity 
                  style={styles.pasteButton}
                  onPress={handlePasteFromClipboard}
                >
                  <Text style={styles.pasteButtonText}>Paste</Text>
                </TouchableOpacity>
              </View>

              <Button
                title={isLoading ? 'Extracting Recipe...' : 'Import Recipe'}
                onPress={handleImportFromUrl}
                disabled={isLoading || !urlInput.trim()}
                style={styles.importButton}
              />
            </View>
          ) : (
            <View style={styles.inputSection}>
              <Text style={styles.label}>Recipe Text</Text>
              <Text style={styles.description}>
                Paste or type the recipe text including ingredients and instructions
              </Text>
              
              <View style={styles.textAreaContainer}>
                <TextInput
                  style={styles.textArea}
                  placeholder="Ingredients:&#10;- 2 cups flour&#10;- 1 cup sugar&#10;&#10;Instructions:&#10;1. Mix ingredients..."
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholderTextColor={Colors.text.tertiary}
                  multiline
                  numberOfLines={10}
                  textAlignVertical="top"
                />
                <TouchableOpacity 
                  style={styles.pasteButtonText}
                  onPress={handlePasteFromClipboard}
                >
                  <Text style={styles.pasteButtonText}>Paste</Text>
                </TouchableOpacity>
              </View>

              <Button
                title={isLoading ? 'Extracting Recipe...' : 'Import Recipe'}
                onPress={handleImportFromText}
                disabled={isLoading || !textInput.trim()}
                style={styles.importButton}
              />
            </View>
          )}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>
                Analyzing content and extracting recipe...
              </Text>
            </View>
          )}
        </View>

        <View style={styles.supportedPlatforms}>
          <Text style={styles.supportedTitle}>Supported Platforms</Text>
          <Text style={styles.supportedText}>
            Instagram • TikTok • YouTube • Pinterest • Facebook • Recipe Websites
          </Text>
        </View>
      </View>
    </Modal>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text.secondary,
  },
  activeTabText: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputSection: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  textInput: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pasteButton: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  pasteButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text.inverse,
  },
  textAreaContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  textArea: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 200,
  },
  importButton: {
    marginTop: 'auto',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 12,
    textAlign: 'center',
  },
  supportedPlatforms: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  supportedTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  supportedText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
});