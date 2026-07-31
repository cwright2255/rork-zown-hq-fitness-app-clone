// app/recipes/import-from-share.jsx
//
// The one and only destination for anything shared into Zown from another
// app (Instagram, Safari, etc.  see the expo-sharing config in app.json
// and app/+native-intent.js). Scoped deliberately narrowly:
//
//   - The OS-level share config only offers Zown as a share target for
//     URLs/text (app.json: ios.activationRule has no image/file/video/
//     attachment support enabled; android.singleShareMimeTypes is
//     ["text/plain"] only)  Zown literally cannot receive a shared photo,
//     video, or file. This isn't a UI choice, it's enforced by the OS
//     share sheet itself.
//   - This screen re-validates that anyway (defense in depth) before
//     doing anything with the shared content.
//   - The shared content only ever flows into the existing recipe
//     extraction pipeline (services/recipeExtractionService.js  the same
//     one the in-app "paste a link" import already uses). There is no
//     generic "shared content" inbox and no other code path that consumes
//     what gets shared here.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { colors, typography, spacing, radius, shadows } from '@/constants/theme';
import { useUserStore } from '@/store/userStore';
import { useRecipeStore } from '@/store/recipeStore';
import recipeExtractionService from '@/services/recipeExtractionService';

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function ImportFromShareScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { addRecipe } = useRecipeStore();

  const [status, setStatus] = useState('reading'); // reading | extracting | preview | notFound | rejected | error | saved
  const [sharedUrl, setSharedUrl] = useState(null);
  const [recipe, setRecipe] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    (async () => {
      let payloads = [];
      try {
        payloads = Sharing.getSharedPayloads?.() ?? [];
      } catch (e) {
        console.error('[ImportFromShare] failed to read shared payload', e);
      }

      // Only ever look at text/url payloads  even though the OS-level
      // config already prevents anything else from reaching this screen,
      // this re-check means a future config change can't silently widen
      // what this screen is willing to act on.
      const candidate = payloads.find((p) => p.shareType === 'url' || p.shareType === 'text');
      const value = candidate?.value?.trim();

      if (!value || !isHttpUrl(value)) {
        setStatus('rejected');
        Sharing.clearSharedPayloads?.();
        return;
      }

      setSharedUrl(value);
      setStatus('extracting');

      try {
        const extracted = await recipeExtractionService.extractRecipeFromUrl(value);
        Sharing.clearSharedPayloads?.();
        if (extracted && extracted.name && extracted.ingredients?.length) {
          setRecipe(extracted);
          setStatus('preview');
        } else {
          setStatus('notFound');
        }
      } catch (e) {
        console.error('[ImportFromShare] extraction failed', e);
        setErrorMessage(e?.message || 'Something went wrong.');
        setStatus('error');
      }
    })();
  }, []);

  const handleSave = async () => {
    setStatus('saving');
    try {
      await addRecipe(recipe, user?.uid);
      setStatus('saved');
    } catch (e) {
      console.error('[ImportFromShare] save failed', e);
      setErrorMessage(e?.message || 'Could not save this recipe.');
      setStatus('error');
    }
  };

  const goToRecipes = () => router.replace('/recipes');
  const dismiss = () => (router.canGoBack() ? router.back() : router.replace('/recipes'));

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Import Recipe" showBack onBack={dismiss} />

      <View style={styles.content}>
        {(status === 'reading' || status === 'extracting') && (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={colors.text} />
            <Text style={styles.statusText}>
              {status === 'reading' ? 'Reading shared link' : 'Extracting the recipe'}
            </Text>
            {sharedUrl && <Text style={styles.urlText} numberOfLines={1}>{sharedUrl}</Text>}
          </View>
        )}

        {status === 'rejected' && (
          <View style={styles.centerBlock}>
            <Ionicons name="close-circle-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.statusText}>Zown only accepts shared links for recipe import.</Text>
            <Text style={styles.statusSubtext}>
              Share a recipe post or link from Instagram, a recipe site, or anywhere else that lets you share a link.
            </Text>
            <PrimaryButton title="Close" onPress={dismiss} style={{ marginTop: spacing.lg }} />
          </View>
        )}

        {status === 'notFound' && (
          <View style={styles.centerBlock}>
            <Ionicons name="restaurant-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.statusText}>Couldn't find a recipe at that link.</Text>
            <Text style={styles.statusSubtext}>
              The page might not contain a recipe, or the format wasn't recognized. You can also paste the link
              manually from the Recipes tab.
            </Text>
            <PrimaryButton title="Close" onPress={dismiss} style={{ marginTop: spacing.lg }} />
          </View>
        )}

        {status === 'error' && (
          <View style={styles.centerBlock}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.orange} />
            <Text style={styles.statusText}>Something went wrong.</Text>
            <Text style={styles.statusSubtext}>{errorMessage}</Text>
            <PrimaryButton title="Close" onPress={dismiss} style={{ marginTop: spacing.lg }} />
          </View>
        )}

        {status === 'preview' && recipe && (
          <View style={styles.previewCard}>
            {!!recipe.imageUrl && (
              <Image source={{ uri: recipe.imageUrl }} style={styles.previewImage} />
            )}
            <View style={styles.previewBody}>
              <Text style={styles.previewName}>{recipe.name}</Text>
              {!!recipe.description && (
                <Text style={styles.previewDescription} numberOfLines={3}>{recipe.description}</Text>
              )}
              <View style={styles.previewMetaRow}>
                <MetaChip icon="time-outline" label={`${(recipe.prepTime || 0) + (recipe.cookTime || 0)} min`} />
                <MetaChip icon="people-outline" label={`${recipe.servings || 4} servings`} />
                <MetaChip icon="list-outline" label={`${recipe.ingredients?.length || 0} ingredients`} />
              </View>
              {recipe.nutrition && (
                <Text style={styles.nutritionNote}>
                  ~{recipe.nutrition.calories} cal, {recipe.nutrition.protein}g protein per serving (AI estimate)
                </Text>
              )}
              <PrimaryButton title="Save to My Recipes" onPress={handleSave} style={{ marginTop: spacing.lg }} />
              <Pressable onPress={dismiss} style={{ marginTop: spacing.sm, alignItems: 'center' }}>
                <Text style={styles.discardText}>Discard</Text>
              </Pressable>
            </View>
          </View>
        )}

        {status === 'saving' && (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={colors.text} />
            <Text style={styles.statusText}>Saving</Text>
          </View>
        )}

        {status === 'saved' && (
          <View style={styles.centerBlock}>
            <Ionicons name="checkmark-circle" size={48} color={colors.green} />
            <Text style={styles.statusText}>Saved to your recipes</Text>
            <PrimaryButton title="View My Recipes" onPress={goToRecipes} style={{ marginTop: spacing.lg }} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function MetaChip({ icon, label }) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={13} color={colors.textSecondary} />
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: spacing.base, paddingTop: spacing.lg },
  centerBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  statusText: { ...typography.h4, color: colors.text, textAlign: 'center' },
  statusSubtext: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  urlText: { ...typography.caption, color: colors.textSecondary, maxWidth: '90%' },
  previewCard: { borderRadius: radius.lg, backgroundColor: colors.card, overflow: 'hidden', ...shadows.card },
  previewImage: { width: '100%', height: 180, backgroundColor: colors.border },
  previewBody: { padding: spacing.base },
  previewName: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  previewDescription: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  previewMetaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bg, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  metaChipText: { ...typography.caption, color: colors.textSecondary },
  nutritionNote: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic' },
  discardText: { ...typography.bodySmall, color: colors.textSecondary },
});
