// components/StarRating.jsx
//
// A food's rating as five stars, in half steps (the rating is worked out in lib/foodRating.js): whole stars filled, a half star
// half filled, the rest empty. Shown on the Nutrition tab (food and meal), in the food search and on a food's page. Renders
// nothing for a food with no stars, rather than a misleading default.
import React from 'react';
import { View } from 'react-native';
import { Star, StarHalf } from 'lucide-react-native';

export const STAR_FILLED = '#F59E0B';
export const STAR_EMPTY = '#DDDDDD';

/** "3.5 out of 5 stars", for the screen reader. */
export const starsLabel = (stars) => `${stars} out of 5 stars`;

export default function StarRating({ stars, size = 12, gap = 1 }) {
  if (!stars) return null;
  return (
    <View testID="star-rating" accessible accessibilityRole="image" accessibilityLabel={starsLabel(stars)} style={{ flexDirection: 'row', gap }}>
      {[1, 2, 3, 4, 5].map((i) => {
        if (i <= stars) return <Star key={i} size={size} color={STAR_FILLED} fill={STAR_FILLED} />;
        if (i - 0.5 <= stars) {
          // A half star: the empty star with the filled left half on top of it.
          return (
            <View key={i} testID="star-half" style={{ width: size, height: size }}>
              <Star size={size} color={STAR_EMPTY} fill="transparent" />
              <View style={{ position: 'absolute', left: 0, top: 0 }}>
                <StarHalf size={size} color={STAR_FILLED} fill={STAR_FILLED} />
              </View>
            </View>
          );
        }
        return <Star key={i} size={size} color={STAR_EMPTY} fill="transparent" />;
      })}
    </View>
  );
}
