import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

class RecipeExtractionService {
  constructor() {
    const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://us-central1-zown-3c512.cloudfunctions.net';
    this.AI_API_URL = `${apiBase}/text/llm/`;
    this.lastDiagnostic = null;
  }

  async extractRecipeFromUrl(url) {
    try {
      console.log('Extracting recipe from URL:', url);

      const platform = this.detectPlatform(url);

      // Real, structured extraction via Spoonacular's own "Extract
      // Recipe from Website" endpoint - tried first for every platform
      // except TikTok (already has a free, working oEmbed-based path
      // below) and Instagram (reliable extraction there would need
      // Spoonacular's extractFromVideo flag, which costs +50 points per
      // call on top of the base 1 - not taken on here; Instagram keeps
      // its existing free Cloud Function attempt and "From Text"
      // fallback instead). Falls through to the existing metadata/AI
      // flow below if Spoonacular doesn't recognize the page, so this
      // is an addition, not a replacement of existing coverage.
      if (platform !== 'tiktok' && platform !== 'instagram') {
        const spoonacularRecipe = await this.getSpoonacularExtraction(url);
        if (spoonacularRecipe) {
          console.log('Successfully extracted recipe via Spoonacular:', spoonacularRecipe.name);
          return { ...spoonacularRecipe, sourceUrl: url, sourcePlatform: platform };
        }
      }

      const metadata = await this.getUrlMetadata(url);
      console.log('URL metadata:', { ...metadata, jsonLdRecipe: metadata.jsonLdRecipe ? '(found)' : null });

      const extractedRecipe = await this.extractRecipeWithAI(metadata, url, platform);

      if (extractedRecipe) {
        console.log('Successfully extracted recipe:', extractedRecipe.name);
        return {
          ...extractedRecipe,
          sourceUrl: url,
          sourcePlatform: platform
        };
      }

      return null;
    } catch (error) {
      console.error('Error extracting recipe from URL:', error);
      return null;
    }
  }

  // Real, structured recipe extraction via Spoonacular's own "Extract
  // Recipe from Website" endpoint. Confirmed directly against
  // Spoonacular's current docs (spoonacular.com/food-api/docs) - this
  // returns the same shape as their "Get Recipe Information" endpoint:
  // real extendedIngredients already split into name/amount/unit (no
  // manual quantity-parsing needed, unlike the JSON-LD path below), real
  // analyzedInstructions, and, with includeNutrition=true, a real,
  // computed nutrition profile even when the source page has none.
  //
  // Deliberately never sets extractFromVideo (defaults to false) - that
  // flag is what's needed to extract a caption from an Instagram/TikTok/
  // video-Pinterest-pin, but costs +50 points per call on top of the
  // base 1, a cost this integration does not take on. For a plain
  // recipe website, or a Pinterest pin that links out to one, this
  // isn't needed at all.
  async getSpoonacularExtraction(url) {
    const apiKey = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY;
    if (!apiKey) {
      this.lastDiagnostic = 'Spoonacular: no API key configured (EXPO_PUBLIC_SPOONACULAR_API_KEY)';
      return null;
    }
    try {
      const extractUrl = `https://api.spoonacular.com/recipes/extract?url=${encodeURIComponent(url)}&includeNutrition=true&apiKey=${apiKey}`;
      const response = await fetch(extractUrl);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        this.lastDiagnostic = `Spoonacular: HTTP ${response.status}${data?.message ? ` - ${data.message}` : ''}`;
        return null;
      }
      if (!data?.title || !data?.extendedIngredients?.length) {
        this.lastDiagnostic = 'Spoonacular: response OK but missing a title or ingredients for this URL';
        return null;
      }

      return this.mapSpoonacularRecipe(data);
    } catch (error) {
      this.lastDiagnostic = `Spoonacular call failed: ${error?.message}`;
      return null;
    }
  }

  // Converts Spoonacular's real response into this app's own recipe
  // shape. See getSpoonacularExtraction above for field-by-field
  // reasoning on the trickier mappings (time split, nutrition lookup).
  mapSpoonacularRecipe(r) {
    const ingredients = (r.extendedIngredients || []).map((ing, i) => ({
      id: String(ing.id ?? i + 1),
      name: ing.name || ing.originalName || ing.original,
      amount: ing.measures?.us?.amount ?? ing.measures?.metric?.amount ?? null,
      unit: ing.measures?.us?.unitShort || ing.measures?.metric?.unitShort || undefined,
    }));

    const instructions = [];
    for (const section of r.analyzedInstructions || []) {
      if (section.name) instructions.push(`${section.name}:`);
      for (const step of section.steps || []) instructions.push(step.step);
    }
    if (!instructions.length && typeof r.instructions === 'string' && r.instructions.trim()) {
      // Real fallback: analyzedInstructions can come back empty even
      // when Spoonacular's plain instructions string has real content.
      instructions.push(...this.stripHtml(r.instructions).split(/\n+/).map((s) => s.trim()).filter(Boolean));
    }

    const dietaryTags = [];
    if (r.vegan) dietaryTags.push('vegan');
    else if (r.vegetarian) dietaryTags.push('vegetarian');
    if (r.glutenFree) dietaryTags.push('gluten-free');
    if (r.dairyFree) dietaryTags.push('dairy-free');
    if (r.ketogenic) dietaryTags.push('ketogenic');
    if (r.whole30) dietaryTags.push('whole30');

    const CATEGORY_MAP = {
      breakfast: 'breakfast', 'morning meal': 'breakfast',
      lunch: 'lunch', dinner: 'dinner', 'main course': 'dinner', 'main dish': 'dinner', 'side dish': 'dinner',
      snack: 'snack', appetizer: 'snack', dessert: 'dessert'
    };
    const category = (r.dishTypes || []).map((d) => CATEGORY_MAP[d.toLowerCase()]).find(Boolean) || 'dinner';

    let nutrition = null;
    if (r.nutrition?.nutrients?.length) {
      const find = (name) => r.nutrition.nutrients.find((n) => n.name === name)?.amount ?? null;
      const mapped = {
        calories: find('Calories'),
        protein: find('Protein'),
        carbs: find('Carbohydrates'),
        fat: find('Fat'),
        fiber: find('Fiber'),
      };
      if (Object.values(mapped).some((v) => v != null)) nutrition = mapped;
    }

    return {
      name: r.title,
      description: this.stripHtml(r.summary).slice(0, 400),
      ingredients,
      instructions,
      prepTime: r.preparationMinutes || undefined,
      cookTime: r.preparationMinutes ? (r.cookingMinutes || undefined) : (r.readyInMinutes || undefined),
      servings: r.servings || 4,
      difficulty: 'medium',
      category,
      tags: r.cuisines || [],
      dietaryTags,
      imageUrl: r.image || '',
      author: r.sourceName || r.creditsText || undefined,
      nutrition,
    };
  }

  stripHtml(s) {
    return typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : '';
  }


  async extractRecipeFromText(text) {
    try {
      console.log('Extracting recipe from text');

      const extractedRecipe = await this.extractRecipeWithAI({
        url: '',
        platform: 'other',
        description: text
      }, '', 'other');

      if (extractedRecipe) {
        console.log('Successfully extracted recipe from text:', extractedRecipe.name);
        return extractedRecipe;
      }

      return null;
    } catch (error) {
      console.error('Error extracting recipe from text:', error);
      return null;
    }
  }

  async handleSharedContent() {
    try {
      if (Platform.OS === 'web') {
        const clipboardContent = await Clipboard.getStringAsync();
        if (this.isValidUrl(clipboardContent)) {
          return clipboardContent;
        }
        return clipboardContent;
      } else {
        const clipboardContent = await Clipboard.getStringAsync();
        if (this.isValidUrl(clipboardContent)) {
          return clipboardContent;
        }
        return clipboardContent;
      }
    } catch (error) {
      console.error('Error handling shared content:', error);
      return null;
    }
  }

  detectPlatform(url) {
    const domain = url.toLowerCase();

    if (domain.includes('instagram.com') || domain.includes('instagr.am')) {
      return 'instagram';
    } else if (domain.includes('tiktok.com')) {
      return 'tiktok';
    } else if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      return 'youtube';
    } else if (domain.includes('facebook.com') || domain.includes('fb.com')) {
      return 'facebook';
    } else if (domain.includes('pinterest.com') || domain.includes('pin.it')) {
      return 'pinterest';
    } else {
      return 'other';
    }
  }

  // Real, public oEmbed lookup - works well for TikTok specifically:
  // its oEmbed "title" field returns the full caption, hashtags
  // included, confirmed directly. Only used for TikTok now - see
  // getInstagramEmbedData below for why Instagram needs a different
  // approach entirely (oEmbed's response for Instagram has no caption
  // field at all, confirmed directly against a real post).
  async getOEmbedMetadata(url, platform) {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
      const response = await fetch(oembedUrl);
      if (!response.ok) return null;

      const data = await response.json();
      const caption = typeof data.title === 'string' ? data.title : null;
      if (!caption) return null;

      return {
        caption,
        authorName: typeof data.author_name === 'string' ? data.author_name : null,
        thumbnailUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null,
      };
    } catch (error) {
      console.error(`Error fetching ${platform} oEmbed:`, error?.message);
      return null;
    }
  }

  // Real fix: confirmed directly via in-app diagnostics that fetching
  // Instagram's /embed/captioned/ page straight from the device gets
  // served a generic blocked/login-wall page (HTTP 200, title=
  // "Instagram", login/error markers present) - even though the exact
  // same request via curl from a dev/datacenter environment succeeds
  // and returns the real post, unchanged. This now calls this app's
  // own instagramEmbed Cloud Function (functions/src/index.js) instead,
  // which performs that same fetch server-side, from Google Cloud's
  // own network - matching the network profile confirmed to work -
  // rather than from the device directly.
  async getInstagramEmbedData(url) {
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://us-central1-zown-3c512.cloudfunctions.net';
      const response = await fetch(`${apiBase}/instagramEmbed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        this.lastDiagnostic = data?.error || `Instagram proxy returned HTTP ${response.status}`;
        return null;
      }
      if (!data?.caption) {
        this.lastDiagnostic = 'Instagram proxy responded OK but returned no caption';
        return null;
      }

      return { caption: data.caption, username: data.username || null, thumbnail: data.thumbnail || null };
    } catch (error) {
      this.lastDiagnostic = `Instagram proxy call failed: ${error?.message}`;
      console.error('Error calling Instagram proxy:', error?.message);
      return null;
    }
  }

  // Real fix for Pinterest specifically: pin.it short links (and
  // Pinterest's own in-app share button) redirect through a "/sent/"
  // tracking variant with invite_code/sender query params - confirmed
  // directly, that page returns a genuinely empty response (HTTP 200,
  // but content-length: 1), not blocked, just nothing there. The
  // plain, canonical /pin/{id}/ URL for the exact same pin DOES return
  // real og:title/og:description content, confirmed directly. Since
  // fetch() follows redirects by default, the existing fetch below
  // would land on the empty /sent/ page automatically - this resolves
  // the redirect chain first and rebuilds the canonical URL from
  // whatever pin ID it lands on, rather than using the raw redirected
  // URL as-is.
  async resolvePinterestUrl(url) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
      });
      const finalUrl = response.url || url;
      const match = finalUrl.match(/\/pin\/(\d+)/);
      if (!match) {
        this.lastDiagnostic = `Pinterest: redirect resolved to "${finalUrl}" (response.url may not reflect the real redirect chain on this platform) - no pin ID found in it, falling back to the original URL`;
      }
      return match ? `https://www.pinterest.com/pin/${match[1]}/` : finalUrl;
    } catch (error) {
      this.lastDiagnostic = `Pinterest redirect resolution threw: ${error?.message}`;
      console.error('Error resolving Pinterest URL:', error?.message);
      return url;
    }
  }

  // Exposes whatever the most recent Instagram/Pinterest extraction
  // attempt actually found or failed on, for surfacing directly in the
  // UI (see components/RecipeImportModal.jsx) - since these paths
  // scrape undocumented, non-public page internals rather than an
  // official API, a real, in-app-only failure needs to say exactly
  // what happened rather than a generic "didn't work", so it can
  // actually be diagnosed without a remote debugger attached.
  getLastDiagnostic() {
    return this.lastDiagnostic || null;
  }

  // Real, live recipe discovery via Spoonacular's complexSearch
  // endpoint - powers the Featured/Post-Workout/Meal Prep/Quick & Easy
  // sections on the main Recipes screen with real recipes instead of
  // hardcoded mock data. Deliberately fetches only a lightweight
  // preview (title, image, calories, time) here, not the full
  // ingredient/instruction detail - most browsed recipes are never
  // saved, so that detail is only fetched via getSpoonacularById below,
  // at the point a user actually taps to save one, rather than
  // spending points on every recipe shown whether it's saved or not.
  async getSpoonacularBrowse(params, number = 12) {
    const apiKey = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY;
    if (!apiKey) {
      this.lastDiagnostic = 'Spoonacular: no API key configured (EXPO_PUBLIC_SPOONACULAR_API_KEY)';
      return [];
    }
    try {
      const query = new URLSearchParams({
        ...params,
        number: String(number),
        addRecipeInformation: 'true',
        addRecipeNutrition: 'true',
        apiKey,
      });
      const response = await fetch(`https://api.spoonacular.com/recipes/complexSearch?${query}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data?.results)) {
        this.lastDiagnostic = `Spoonacular browse: HTTP ${response.status}${data?.message ? ` - ${data.message}` : ''}`;
        return [];
      }
      return data.results.map((r) => {
        const calories = r.nutrition?.nutrients?.find((n) => n.name === 'Calories')?.amount;
        return {
          id: String(r.id),
          name: r.title,
          imageUrl: r.image || '',
          cal: calories ? `${Math.round(calories)} cal` : '',
          time: r.readyInMinutes ? `${r.readyInMinutes} min` : '',
        };
      });
    } catch (error) {
      this.lastDiagnostic = `Spoonacular browse call failed: ${error?.message}`;
      return [];
    }
  }

  // Fetches full detail for one Spoonacular recipe by its numeric id -
  // used when a user taps to save a recipe surfaced by
  // getSpoonacularBrowse above, since that lightweight preview doesn't
  // include the real ingredients/instructions needed to actually save
  // a usable recipe. Reuses mapSpoonacularRecipe since "Get Recipe
  // Information" (this endpoint) returns the same shape as
  // getSpoonacularExtraction's "Extract Recipe from Website" does.
  async getSpoonacularById(id) {
    const apiKey = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY;
    if (!apiKey) {
      this.lastDiagnostic = 'Spoonacular: no API key configured (EXPO_PUBLIC_SPOONACULAR_API_KEY)';
      return null;
    }
    try {
      const response = await fetch(`https://api.spoonacular.com/recipes/${id}/information?includeNutrition=true&apiKey=${apiKey}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.title) {
        this.lastDiagnostic = `Spoonacular: HTTP ${response.status}${data?.message ? ` - ${data.message}` : ''}`;
        return null;
      }
      return this.mapSpoonacularRecipe(data);
    } catch (error) {
      this.lastDiagnostic = `Spoonacular getById call failed: ${error?.message}`;
      return null;
    }
  }

  async getUrlMetadata(url) {
    const platform = this.detectPlatform(url);

    if (platform === 'tiktok') {
      const oembed = await this.getOEmbedMetadata(url, platform);
      if (oembed) {
        return {
          url,
          platform,
          title: oembed.authorName ? `${oembed.authorName}'s recipe` : undefined,
          description: oembed.caption,
          imageUrl: oembed.thumbnailUrl,
          videoUrl: url,
          jsonLdRecipe: null,
          isVideoCaption: true,
        };
      }
    } else if (platform === 'instagram') {
      const embed = await this.getInstagramEmbedData(url);
      if (embed) {
        return {
          url,
          platform,
          title: embed.username ? `${embed.username}'s recipe` : undefined,
          description: embed.caption,
          imageUrl: embed.thumbnail || undefined,
          videoUrl: url,
          jsonLdRecipe: null,
          isVideoCaption: true,
        };
      }
    }

    // Fallback for everything else, and for tiktok/instagram if the
    // above genuinely returned nothing usable. Pinterest URLs are
    // resolved to their canonical form first (see resolvePinterestUrl
    // above); every other platform fetches the URL exactly as given.
    const fetchUrl = platform === 'pinterest' ? await this.resolvePinterestUrl(url) : url;
    try {
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)'
        }
      });

      const html = await response.text();

      const title = this.extractMetaTag(html, 'og:title') || this.extractTitle(html);
      const description = this.extractMetaTag(html, 'og:description') || this.extractMetaTag(html, 'description');
      const imageUrl = this.extractMetaTag(html, 'og:image');
      const videoUrl = this.extractMetaTag(html, 'og:video');

      // Real structured recipe data, when the site provides it - most
      // real recipe sites (WordPress recipe plugins, AllRecipes, food
      // blogs, etc.) embed a schema.org/Recipe JSON-LD block with the
      // actual ingredient list and actual step-by-step instructions,
      // not just a title and teaser description.
      const jsonLdRecipe = this.extractJsonLdRecipe(html);

      return {
        url,
        platform,
        title,
        description,
        imageUrl,
        videoUrl,
        jsonLdRecipe
      };
    } catch (error) {
      console.error('Error getting URL metadata:', error);
      return {
        url,
        platform
      };
    }
  }

  extractMetaTag(html, property) {
    const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
    const match = html.match(regex);
    return match ? match[1] : undefined;
  }

  extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? match[1] : undefined;
  }

  // Real schema.org/Recipe parsing. JSON-LD can appear as a single
  // object, an array of objects, or nested under a top-level @graph
  // array (a common pattern for sites that emit multiple structured
  // data types on one page) - this checks all three shapes rather than
  // assuming the simplest one.
  extractJsonLdRecipe(html) {
    try {
      const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const block of blocks) {
        let parsed;
        try {
          parsed = JSON.parse(block[1].trim());
        } catch {
          continue;
        }

        const candidates = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
        const recipeNode = candidates.find((node) => {
          const type = node?.['@type'];
          return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
        });

        if (recipeNode) return this.normalizeJsonLdRecipe(recipeNode);
      }
      return null;
    } catch (error) {
      console.error('Error parsing JSON-LD recipe:', error);
      return null;
    }
  }

  // Converts real schema.org/Recipe fields into this app's own shape.
  // Deliberately does NOT invent amount/unit split for ingredients -
  // schema.org's recipeIngredient is just a plain string per item
  // ("2 cups flour"), and guessing where the number ends and the unit
  // begins would risk corrupting a real, correctly-stated ingredient.
  normalizeJsonLdRecipe(node) {
    const ingredients = Array.isArray(node.recipeIngredient)
      ? node.recipeIngredient.filter(Boolean)
      : [];

    let instructions = [];
    if (Array.isArray(node.recipeInstructions)) {
      instructions = node.recipeInstructions
        .map((step) => (typeof step === 'string' ? step : step?.text || step?.name))
        .filter(Boolean);
    } else if (typeof node.recipeInstructions === 'string') {
      instructions = node.recipeInstructions.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    }

    const servings = this.parseYield(node.recipeYield);
    const nutrition = node.nutrition ? {
      calories: this.parseNumber(node.nutrition.calories),
      protein: this.parseNumber(node.nutrition.proteinContent),
      carbs: this.parseNumber(node.nutrition.carbohydrateContent),
      fat: this.parseNumber(node.nutrition.fatContent),
      fiber: this.parseNumber(node.nutrition.fiberContent),
    } : null;

    return {
      name: node.name || undefined,
      description: typeof node.description === 'string' ? node.description : undefined,
      ingredients,
      instructions,
      prepTime: this.parseIsoDuration(node.prepTime),
      cookTime: this.parseIsoDuration(node.cookTime),
      servings,
      imageUrl: this.extractJsonLdImage(node.image),
      author: typeof node.author === 'string' ? node.author : (node.author?.name || undefined),
      nutrition: nutrition && Object.values(nutrition).some((v) => v != null) ? nutrition : null,
    };
  }

  extractJsonLdImage(image) {
    if (typeof image === 'string') return image;
    if (Array.isArray(image)) return typeof image[0] === 'string' ? image[0] : image[0]?.url;
    return image?.url || undefined;
  }

  parseYield(value) {
    if (typeof value === 'number') return value;
    if (Array.isArray(value)) value = value[0];
    if (typeof value === 'string') {
      const match = value.match(/\d+/);
      return match ? parseInt(match[0], 10) : undefined;
    }
    return undefined;
  }

  parseNumber(value) {
    if (value == null) return null;
    const match = String(value).match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  }

  // Real ISO 8601 duration parsing (e.g. "PT30M" -> 30, "PT1H30M" -> 90).
  parseIsoDuration(iso) {
    if (!iso || typeof iso !== 'string') return undefined;
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return undefined;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const total = hours * 60 + minutes;
    return total > 0 ? total : undefined;
  }

  async extractRecipeWithAI(metadata, url, platform) {
    try {
      const real = metadata.jsonLdRecipe;
      const missingPieces = [];
      if (!real?.ingredients?.length) missingPieces.push('ingredients (with amount and unit)');
      if (!real?.instructions?.length) missingPieces.push('step-by-step instructions');
      if (!real?.name) missingPieces.push('a recipe name');
      const needsNutrition = !real?.nutrition;
      const needsAI = missingPieces.length > 0 || needsNutrition || !real;

      if (real && real.ingredients?.length && real.instructions?.length && !needsNutrition) {
        return {
          name: real.name || metadata.title || 'Imported Recipe',
          description: real.description || metadata.description || '',
          ingredients: this.structureIngredientsLocally(real.ingredients),
          instructions: real.instructions,
          prepTime: real.prepTime,
          cookTime: real.cookTime,
          servings: real.servings || 4,
          difficulty: 'medium',
          category: 'dinner',
          tags: [],
          dietaryTags: [],
          imageUrl: real.imageUrl || metadata.imageUrl || '',
          author: real.author,
          nutrition: real.nutrition,
        };
      }

      // Real, video-caption-specific instruction: a social caption mixes
      // genuine recipe content (ingredients, method) with hashtags,
      // engagement bait, and unrelated commentary in the same block of
      // text - unlike a recipe blog's og:description, which is usually
      // just a short, clean teaser. Told explicitly to isolate only the
      // recipe-relevant portion rather than treating the whole caption,
      // hashtags included, as recipe content.
      const captionNote = metadata.isVideoCaption
        ? `\nThis description is a social media video caption, not a recipe blog summary - it may mix real recipe content (ingredients, steps) together with hashtags, emoji, "like and follow" calls to action, or unrelated commentary in the same text. Extract ONLY the genuine recipe content from within it; ignore hashtags and anything that isn't actually part of the recipe itself.\n`
        : '';

      const prompt = `Analyze the following content and extract a complete recipe if one exists. The content is from ${platform}.

Content:
Title: ${metadata.title || 'N/A'}
Description: ${metadata.description || 'N/A'}
URL: ${url}
${captionNote}${real ? `
Real structured data already found on this page - use these values EXACTLY as given, do not paraphrase or alter them:
${real.name ? `Real name: ${real.name}` : ''}
${real.ingredients?.length ? `Real ingredients (verbatim from the page):\n${real.ingredients.map((i) => `- ${i}`).join('\n')}` : ''}
${real.instructions?.length ? `Real instructions (verbatim from the page):\n${real.instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : ''}
${real.servings ? `Real servings: ${real.servings}` : ''}
` : ''}
${missingPieces.length ? `The following genuinely was NOT found on the page and needs to be generated: ${missingPieces.join(', ')}. Generate these based on standard, reasonable cooking practice for this type of dish.` : ''}

Please return a JSON object with the following structure:
{
  "name": "Recipe name",
  "description": "Brief description",
  "ingredients": [
    {
      "id": "1",
      "name": "ingredient name with amount",
      "amount": number,
      "unit": "unit of measurement"
    }
  ],
  "instructions": ["step 1", "step 2", ...],
  "prepTime": minutes (number),
  "cookTime": minutes (number),
  "servings": number,
  "difficulty": "easy|medium|hard",
  "category": "breakfast|lunch|dinner|snack|dessert",
  "tags": ["tag1", "tag2"],
  "dietaryTags": ["vegetarian", "vegan", "gluten-free", etc],
  "imageUrl": "${real?.imageUrl || metadata.imageUrl || ''}",
  "author": "author name if available",
  "nutrition": {
    "calories": estimated calories per serving (number),
    "protein": estimated grams of protein per serving (number),
    "carbs": estimated grams of carbohydrates per serving (number),
    "fat": estimated grams of fat per serving (number),
    "fiber": estimated grams of fiber per serving (number)
  }
}

If real ingredients/instructions were provided above, reproduce them faithfully in the JSON rather than rewriting them. Estimate the nutrition object from the actual ingredients and serving count - do not return placeholder or generic values. If the ingredients don't give you enough information to estimate confidently, omit the "nutrition" field entirely rather than guessing.

If no recipe is found at all (not even in the real structured data above, and not within a video caption if this was a video), return null. Only return valid JSON.
`;

      const response = await fetch(this.AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
          {
            role: 'user',
            content: prompt
          }]

        })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const completion = data.completion;

      try {
        const jsonMatch = completion.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const recipeData = JSON.parse(jsonMatch[0]);

          if (recipeData && recipeData.name && recipeData.ingredients && recipeData.instructions) {
            return recipeData;
          }
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
      }

      return null;
    } catch (error) {
      console.error('Error extracting recipe with AI:', error);
      return null;
    }
  }

  // Real quantity parsing, ordered explicitly rather than one regex
  // trying to do everything at once.
  splitLeadingQuantity(raw) {
    const trimmed = raw.trim();
    let m = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)\s+([a-zA-Z]+)?\s*(.*)$/);
    if (m) {
      return { amount: parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10), unitWord: m[4], rest: m[5] };
    }
    m = trimmed.match(/^(\d+)\/(\d+)\s+([a-zA-Z]+)?\s*(.*)$/);
    if (m) {
      return { amount: parseInt(m[1], 10) / parseInt(m[2], 10), unitWord: m[3], rest: m[4] };
    }
    m = trimmed.match(/^(\d+\.?\d*)\s+([a-zA-Z]+)?\s*(.*)$/);
    if (m) {
      return { amount: parseFloat(m[1]), unitWord: m[2], rest: m[3] };
    }
    return null;
  }

  structureIngredientsLocally(rawIngredients) {
    const UNIT_WORDS = ['cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
      'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams', 'kg',
      'ml', 'l', 'liter', 'liters', 'pinch', 'clove', 'cloves', 'can', 'cans', 'slice', 'slices'];
    return rawIngredients.map((raw, i) => {
      const split = this.splitLeadingQuantity(raw);
      if (split) {
        const unit = split.unitWord && UNIT_WORDS.includes(split.unitWord.toLowerCase()) ? split.unitWord.toLowerCase() : undefined;
        const name = unit ? split.rest : `${split.unitWord || ''} ${split.rest}`.trim();
        return { id: String(i + 1), name, amount: split.amount, unit };
      }
      return { id: String(i + 1), name: raw, amount: null, unit: undefined };
    });
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (error) {
      return false;
    }
  }

  generateGroceryList(recipes) {
    const groceryMap = new Map();

    recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ingredient) => {
        const key = ingredient.name.toLowerCase().trim();

        if (groceryMap.has(key)) {
          const existing = groceryMap.get(key);
          if (existing.unit === ingredient.unit) {
            existing.amount += ingredient.amount;
          }
          existing.recipes.add(recipe.name);
        } else {
          groceryMap.set(key, {
            amount: ingredient.amount,
            unit: ingredient.unit,
            recipes: new Set([recipe.name])
          });
        }
      });
    });

    return Array.from(groceryMap.entries()).map(([ingredient, data]) => ({
      ingredient,
      amount: data.amount,
      unit: data.unit,
      recipes: Array.from(data.recipes)
    }));
  }
}

export default new RecipeExtractionService();
