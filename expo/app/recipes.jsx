import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import EmptyState from '@/src/components/EmptyState';
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, Pressable, Platform, TextInput, Modal, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRecipesStore } from '@/store/recipesStore';
import { useUserStore } from '@/store/userStore';

const CATS = ['All','High Protein','Low Carb','Vegan','Quick Meals','Post-Workout'];

const POST_WORKOUT = [
  {id:'pw1',name:'Protein Smoothie',cal:'180 cal',time:'5 min'},
  {id:'pw2',name:'Chicken & Rice',cal:'520 cal',time:'30 min'},
  {id:'pw3',name:'Greek Yogurt Bowl',cal:'280 cal',time:'5 min'},
  {id:'pw4',name:'Tuna Wrap',cal:'350 cal',time:'10 min'},
  {id:'pw5',name:'Egg White Omelette',cal:'220 cal',time:'15 min'},
];
const MEAL_PREP = [
  {id:'mp1',name:'Weekly Chicken Prep',cal:'',time:'2h'},
  {id:'mp2',name:'Overnight Oats x5',cal:'',time:'15 min'},
  {id:'mp3',name:'Veggie Stir Fry Batch',cal:'',time:'45 min'},
  {id:'mp4',name:'Turkey Meatballs',cal:'',time:'1h'},
  {id:'mp5',name:'Quinoa Salad Jars',cal:'',time:'30 min'},
];
const QUICK = [
  {id:'q1',name:'Avocado Toast',cal:'',time:'10 min'},
  {id:'q2',name:'Banana Pancakes',cal:'',time:'15 min'},
  {id:'q3',name:'Caprese Salad',cal:'',time:'5 min'},
  {id:'q4',name:'Shrimp Tacos',cal:'',time:'20 min'},
  {id:'q5',name:'Smoothie Bowl',cal:'',time:'10 min'},
];

const DEFAULT_RECIPES = [
  { id:'s1', source:'Pinterest', color:'#E60023', title:'High Protein Overnight Oats', cal:'380 cal', time:'10 min', servings:'2 servings', url:'pinterest.com' },
  { id:'s2', source:'Instagram', color:'#C13584', title:'Post-Workout Acai Bowl', cal:'320 cal', time:'5 min', servings:'1 serving', url:'instagram.com' },
  { id:'s3', source:'allrecipes.com', color:'#333', title:'Grilled Chicken with Quinoa Salad', cal:'520 cal', time:'35 min', servings:'4 servings', url:'allrecipes.com' },
];

function SectionHeader({ title, onViewAll, right }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {right}
        <Pressable onPress={onViewAll}><Text style={s.viewAll}>View All</Text></Pressable>
      </View>
    </View>
  );
}

function RecipeCard({ item }) {
  return (
    <Pressable style={s.recipeCard}>
      <View style={s.recipeImage}><Ionicons name="restaurant-outline" size={24} color="#CCC" /></View>
      <Text style={s.recipeName} numberOfLines={2}>{item.name}</Text>
      <View style={s.recipeMeta}>
        {item.cal ? <Text style={s.recipeMetaText}>{item.cal}</Text> : null}
        <Text style={s.recipeMetaText}>{item.time}</Text>
      </View>
    </Pressable>
  );
}

function SavedCard({ item, onLongPress }) {
  return (
    <Pressable style={s.savedCard} onLongPress={onLongPress}>
      <View style={s.savedImage}>
        <Ionicons name="restaurant-outline" size={28} color="#CCC" />
        <View style={[s.sourceBadge, { backgroundColor: item.color }]}>
          <Text style={s.sourceBadgeText}>{item.source}</Text>
        </View>
        <View style={s.bookmarkIcon}>
          <Ionicons name="bookmark" size={18} color="#FFD700" />
        </View>
      </View>
      <Text style={s.savedTitle} numberOfLines={2}>{item.title}</Text>
      <View style={s.savedMeta}>
        <Text style={s.savedMetaText}>{item.cal}</Text>
        <Text style={s.savedMetaText}>{item.time}</Text>
        <Text style={s.savedMetaText}>{item.servings}</Text>
      </View>
    </Pressable>
  );
}

export default function RecipesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { savedRecipes, loadRecipes } = useRecipesStore();
  const { user } = useUserStore();

  const onRefresh = async () => {
    setRefreshing(true);
    setIsLoading(true);
    try {
      if (user?.uid) {
        await loadRecipes(user.uid);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };
return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }>
        <Text style={s.pageTitle}>Recipes</Text>

        {/* Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom: 20 }}>
          {CATS.map(c => (
            <Pressable key={c} style={[s.catPill, cat === c && s.catPillActive]} onPress={() => setCat(c)}>
              <Text style={[s.catPillText, cat === c && s.catPillTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Loading and Empty States */}
        {isLoading ? (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <LoadingSkeleton width="100%" height={160} borderRadius={12} />
          </View>
        ) : (savedRecipes || []).length === 0 ? (
          <EmptyState
            icon="BookOpen"
            title="No saved recipes"
            subtitle="Import a recipe from any URL to get started"
            buttonText="Import Recipe"
            onPress={() => {}}
          />
        ) : null}
        {/* Saved Recipes Carousel */}
        <SectionHeader
          title="Saved Recipes"
          onViewAll={() => {}}
          right={<Text style={s.savedCount}>{displayRecipes.length} saved</Text>}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom: 24 }}>
          {displayRecipes.map(item => <SavedCard key={item.id} item={item} onLongPress={() => {
            Alert.alert('Remove Recipe', 'Remove this recipe from saved?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => removeRecipe(item.id, uid) },
            ]);
          }} />)}
        </ScrollView>

        {/* Featured Recipe */}
        <SectionHeader title="Featured" onViewAll={() => {}} />
        <Pressable style={s.featuredCard}>
          <View style={s.featuredImage}><Ionicons name="flame-outline" size={32} color="#CCC" /></View>
          <View style={s.featuredContent}>
            <Text style={s.featuredTitle}>Protein-Packed Buddha Bowl</Text>
            <Text style={s.featuredMeta}>480 cal  \u00B7  25 min  \u00B7  High Protein</Text>
          </View>
        </Pressable>

        {/* Post-Workout */}
        <SectionHeader title="Post-Workout" onViewAll={() => {}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom: 24 }}>
          {POST_WORKOUT.map(item => <RecipeCard key={item.id} item={item} />)}
        </ScrollView>

        {/* Meal Prep */}
        <SectionHeader title="Meal Prep" onViewAll={() => {}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom: 24 }}>
          {MEAL_PREP.map(item => <RecipeCard key={item.id} item={item} />)}
        </ScrollView>

        {/* Quick & Easy */}
        <SectionHeader title="Quick & Easy" onViewAll={() => {}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 6, marginBottom: 12 }}>
          {QUICK.map(item => <RecipeCard key={item.id} item={item} />)}
        </ScrollView>

        {/* Add Recipe Button */}
        <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 24 }}>
          <Pressable style={s.addRecipeBtn} onPress={() => setShowImportModal(true)}>
            <Ionicons name="link-outline" size={18} color="#FFF" />
            <Text style={s.addRecipeBtnText}>Add Recipe</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Import Modal */}
      <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={closeModal}>
        <Pressable style={s.modalOverlay} onPress={closeModal}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <View style={s.dragBar} />
            <Text style={s.modalTitle}>Import Recipe</Text>
            <Text style={s.modalSub}>Paste a link from any recipe source</Text>

            {/* Source Icons */}
            <View style={s.sourceRow}>
              <View style={[s.sourceCircle, { backgroundColor: '#E60023' }]}><Text style={s.sourceP}>P</Text></View>
              <View style={[s.sourceCircle, { backgroundColor: '#C13584' }]}><Ionicons name="camera-outline" size={18} color="#FFF" /></View>
              <View style={[s.sourceCircle, { backgroundColor: '#333' }]}><Ionicons name="globe-outline" size={18} color="#FFF" /></View>
              <View style={[s.sourceCircle, { backgroundColor: '#FF0000' }]}><Ionicons name="logo-youtube" size={18} color="#FFF" /></View>
            </View>

            {!importedRecipe ? (
              <>
                {/* URL Input */}
                <View style={s.urlRow}>
                  <Ionicons name="link-outline" size={18} color="#999" />
                  <TextInput
                    style={s.urlInput}
                    placeholder="Paste recipe URL here..."
                    placeholderTextColor="#999"
                    value={importUrl}
                    onChangeText={setImportUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  <Pressable onPress={handlePaste}><Ionicons name="clipboard-outline" size={18} color="#666" /></Pressable>
                </View>
                {importError ? <Text style={s.errText}>{importError}</Text> : null}
                <Pressable style={s.importBtn} onPress={triggerImport} disabled={isImporting}>
                  {isImporting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.importBtnText}>Import Recipe</Text>}
                </Pressable>
              </>
            ) : (
              <>
                {/* Preview Card */}
                <View style={s.previewCard}>
                  <View style={s.previewImage}>
                    <Ionicons name="restaurant-outline" size={28} color="#CCC" />
                    <View style={[s.sourceBadge, { backgroundColor: importedRecipe.color }]}>
                      <Text style={s.sourceBadgeText}>{importedRecipe.source}</Text>
                    </View>
                  </View>
                  <Text style={s.previewTitle}>{importedRecipe.title}</Text>
                  {importedRecipe.description ? <Text style={s.previewDesc} numberOfLines={3}>{importedRecipe.description}</Text> : null}
                  <View style={s.previewMeta}>
                    {importedRecipe.cal ? <Text style={s.previewMetaText}>{importedRecipe.cal}</Text> : null}
                    {importedRecipe.time ? <Text style={s.previewMetaText}>{importedRecipe.time}</Text> : null}
                    {importedRecipe.servings ? <Text style={s.previewMetaText}>{importedRecipe.servings}</Text> : null}
                  </View>
                  {!importedRecipe.cal && !importedRecipe.time ? <Text style={s.limitedNote}>Limited recipe data found \u2014 you can edit details after saving</Text> : null}
                </View>
                <Pressable style={s.importBtn} onPress={saveImportedRecipe}>
                  <Text style={s.importBtnText}>Save Recipe</Text>
                </Pressable>
                <Pressable style={s.cancelLink} onPress={() => { setImportedRecipe(null); setImportUrl(''); }}>
                  <Text style={s.cancelText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#000', paddingHorizontal: 20, marginTop: 8, marginBottom: 16 },

  /* Category Pills */
  catPill: { backgroundColor: '#F0F0F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  catPillActive: { backgroundColor: '#000' },
  catPillText: { fontSize: 13, fontWeight: '700', color: '#333' },
  catPillTextActive: { color: '#FFF' },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  viewAll: { fontSize: 14, fontWeight: '600', color: '#000' },
  savedCount: { fontSize: 12, color: '#999', backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },

  /* Recipe Card */
  recipeCard: { width: 140, marginRight: 12 },
  recipeImage: { width: 140, height: 100, borderRadius: 12, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  recipeName: { fontSize: 13, fontWeight: '600', color: '#000', marginTop: 6 },
  recipeMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  recipeMetaText: { fontSize: 11, color: '#999' },

  /* Saved Card */
  savedCard: { width: 180, marginRight: 14 },
  savedImage: { width: 180, height: 140, borderRadius: 14, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  sourceBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sourceBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  bookmarkIcon: { position: 'absolute', top: 8, right: 8 },
  savedTitle: { fontSize: 14, fontWeight: '600', color: '#000', marginTop: 8 },
  savedMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  savedMetaText: { fontSize: 11, color: '#999' },

  /* Featured */
  featuredCard: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', marginBottom: 24, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 }, default: {} }) },
  featuredImage: { height: 160, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  featuredContent: { padding: 14, backgroundColor: '#FFF' },
  featuredTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  featuredMeta: { fontSize: 13, color: '#999', marginTop: 4 },

  /* Add Recipe */
  addRecipeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#000', height: 52, borderRadius: 26 },
  addRecipeBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, minHeight: 400 },
  dragBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#000' },
  modalSub: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 20 },

  sourceRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20 },
  sourceCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sourceP: { fontSize: 18, fontWeight: '800', color: '#FFF' },

  urlRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  urlInput: { flex: 1, fontSize: 15, color: '#000', marginLeft: 8 },
  errText: { fontSize: 12, color: '#FF3B30', marginTop: 8 },

  importBtn: { marginTop: 16, backgroundColor: '#000', height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  importBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  /* Preview */
  previewCard: { backgroundColor: '#F8F8F8', borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  previewImage: { height: 160, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  previewTitle: { fontSize: 16, fontWeight: '700', color: '#000', padding: 12, paddingBottom: 4 },
  previewDesc: { fontSize: 13, color: '#666', paddingHorizontal: 12, paddingBottom: 8, lineHeight: 18 },
  previewMeta: { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingBottom: 12 },
  previewMetaText: { fontSize: 12, color: '#999', backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  limitedNote: { fontSize: 11, color: '#999', fontStyle: 'italic', paddingHorizontal: 12, paddingBottom: 12 },
  cancelLink: { alignItems: 'center', marginTop: 12 },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#999' },
});
