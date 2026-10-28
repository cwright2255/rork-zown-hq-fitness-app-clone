// The pieces the Recipes tab is drawn from (components/recipes/): the card, the top pick, the bookmark and the kitchen sheet.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }), { virtual: true });

import RecipeCard from '../components/recipes/RecipeCard';
import HeroPick from '../components/recipes/HeroPick';
import SaveButton from '../components/recipes/SaveButton';
import KitchenSheet from '../components/recipes/KitchenSheet';

const item = (over = {}) => ({
  id: '42', name: 'Chicken Rice Bowl', imageUrl: 'https://img/42.jpg', cal: '540 cal', time: '25 min',
  calories: 540, protein: 38.2, carbs: 52, fat: 14, reason: 'Fits the 900 cal you have left · 38 g protein',
  reasons: [{ kind: 'calories', text: 'Fits the 900 cal you have left' }, { kind: 'protein', text: '38 g protein' }],
  ...over,
});

describe('SaveButton', () => {
  it('is a bookmark you can press to save', () => {
    const onPress = jest.fn();
    const { getByTestId, getByLabelText } = render(<SaveButton id="42" name="Chili" state="idle" onPress={onPress} />);
    expect(getByLabelText('Save Chili')).toBeTruthy();
    fireEvent.press(getByTestId('save-42'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says it is saved, and offers to remove it', () => {
    const { getByLabelText, getByTestId } = render(<SaveButton id="42" name="Chili" state="saved" onPress={() => {}} />);
    expect(getByLabelText('Remove Chili from saved recipes')).toBeTruthy();
    expect(getByTestId('save-42').props.accessibilityState.selected).toBe(true);
  });

  it('does nothing while it is saving', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<SaveButton id="42" name="Chili" state="saving" onPress={onPress} />);
    expect(getByTestId('save-42').props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    fireEvent.press(getByTestId('save-42'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('RecipeCard', () => {
  it('shows the name, calories, time, protein / carbs / fat and why it was picked', () => {
    const { getByText, getByTestId } = render(<RecipeCard item={item()} />);
    expect(getByText('Chicken Rice Bowl')).toBeTruthy();
    expect(getByText('540 cal')).toBeTruthy();
    expect(getByText('25 min')).toBeTruthy();
    expect(getByText('P 38g')).toBeTruthy();
    expect(getByText('C 52g')).toBeTruthy();
    expect(getByText('F 14g')).toBeTruthy();
    expect(getByTestId('reason-42').props.children).toBe('Fits the 900 cal you have left · 38 g protein');
  });

  it('opens the recipe when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<RecipeCard item={item()} onPress={onPress} />);
    fireEvent.press(getByTestId('recipe-card-42'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('saves from the bookmark without opening the recipe', () => {
    const onPress = jest.fn();
    const onToggleSave = jest.fn();
    const { getByTestId } = render(<RecipeCard item={item()} onPress={onPress} onToggleSave={onToggleSave} />);
    fireEvent.press(getByTestId('save-42'));
    expect(onToggleSave).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('has no bookmark when it cannot be saved', () => {
    expect(render(<RecipeCard item={item()} />).queryByTestId('save-42')).toBeNull();
  });

  it('shows only what it knows: no macros, reason, time or calories when there are none', () => {
    const bare = item({ cal: '', time: '', calories: null, protein: null, carbs: null, fat: null, reason: '', reasons: [] });
    const { queryByText, queryByTestId, getByText } = render(<RecipeCard item={bare} />);
    expect(getByText('Chicken Rice Bowl')).toBeTruthy();
    expect(queryByText(/ cal$/)).toBeNull();
    expect(queryByText(/ min$/)).toBeNull();
    expect(queryByText(/^P /)).toBeNull();
    expect(queryByTestId('reason-42')).toBeNull();
  });

  it('shows how many of the typed ingredients an ingredient search result uses and what else it needs', () => {
    const { getByText } = render(<RecipeCard item={item({ reason: '' })} lines={{ uses: 'Uses 3 of your 4', needs: 'Needs: soy sauce, ginger' }} />);
    expect(getByText('Uses 3 of your 4')).toBeTruthy();
    expect(getByText('Needs: soy sauce, ginger')).toBeTruthy();
  });

  it('is described to a screen reader by its name', () => {
    const { getByLabelText } = render(<RecipeCard item={item()} />);
    expect(getByLabelText('Chicken Rice Bowl')).toBeTruthy();
  });
});

describe('HeroPick', () => {
  it('shows the top pick with its reasons', () => {
    const { getByText, getByTestId } = render(<HeroPick item={item()} eyebrow="Top pick for dinner" />);
    expect(getByTestId('hero-pick')).toBeTruthy();
    expect(getByText('Top pick for dinner')).toBeTruthy();
    expect(getByText('Chicken Rice Bowl')).toBeTruthy();
    expect(getByText('540 cal  ·  25 min')).toBeTruthy();
    expect(getByText('Fits the 900 cal you have left')).toBeTruthy();
    expect(getByText('38 g protein')).toBeTruthy();
    expect(getByText('P 38g')).toBeTruthy();
  });

  it('shows at most three reasons, and none when it has none', () => {
    const many = item({ reasons: ['a', 'b', 'c', 'd'].map((k) => ({ kind: k, text: `reason ${k}` })) });
    const first = render(<HeroPick item={many} />);
    expect(first.queryByText('reason c')).toBeTruthy();
    expect(first.queryByText('reason d')).toBeNull();
    const none = render(<HeroPick item={item({ reasons: [] })} />);
    expect(none.queryByText('Fits the 900 cal you have left')).toBeNull();
  });

  it('opens the recipe from the photo, saves from the bookmark and plans from the button', () => {
    const onPress = jest.fn();
    const onToggleSave = jest.fn();
    const onPlan = jest.fn();
    const { getByLabelText, getByTestId } = render(<HeroPick item={item()} onPress={onPress} onToggleSave={onToggleSave} onPlan={onPlan} />);
    fireEvent.press(getByLabelText('Chicken Rice Bowl. Open recipe'));
    expect(onPress).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('save-42'));
    expect(onToggleSave).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('hero-plan'));
    expect(onPlan).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has no plan button or bookmark when it cannot do either', () => {
    const { queryByTestId } = render(<HeroPick item={item()} />);
    expect(queryByTestId('hero-plan')).toBeNull();
    expect(queryByTestId('save-42')).toBeNull();
  });
});

describe('KitchenSheet', () => {
  const type = (utils, text) => fireEvent.changeText(utils.getByTestId('kitchen-input'), text);

  it('starts with the ingredients from last time', () => {
    const { getByTestId } = render(<KitchenSheet initial={['Chicken', 'rice']} onSubmit={() => {}} onClose={() => {}} />);
    expect(getByTestId('kitchen-chip-chicken')).toBeTruthy();
    expect(getByTestId('kitchen-chip-rice')).toBeTruthy();
  });

  it('adds what is typed, split on commas, and clears the box', () => {
    const utils = render(<KitchenSheet onSubmit={() => {}} onClose={() => {}} />);
    type(utils, 'Chicken, rice');
    fireEvent.press(utils.getByTestId('kitchen-add'));
    expect(utils.getByTestId('kitchen-chip-chicken')).toBeTruthy();
    expect(utils.getByTestId('kitchen-chip-rice')).toBeTruthy();
    expect(utils.getByTestId('kitchen-input').props.value).toBe('');
  });

  it('adds on the keyboard\'s done key too', () => {
    const utils = render(<KitchenSheet onSubmit={() => {}} onClose={() => {}} />);
    type(utils, 'eggs');
    fireEvent(utils.getByTestId('kitchen-input'), 'submitEditing');
    expect(utils.getByTestId('kitchen-chip-eggs')).toBeTruthy();
  });

  it('removes an ingredient from its chip', () => {
    const utils = render(<KitchenSheet initial={['chicken', 'rice']} onSubmit={() => {}} onClose={() => {}} />);
    fireEvent.press(utils.getByTestId('kitchen-remove-chicken'));
    expect(utils.queryByTestId('kitchen-chip-chicken')).toBeNull();
    expect(utils.getByTestId('kitchen-chip-rice')).toBeTruthy();
  });

  it('keeps five at most, and says so', () => {
    const utils = render(<KitchenSheet initial={['a', 'b', 'c', 'd']} onSubmit={() => {}} onClose={() => {}} />);
    expect(utils.queryByTestId('kitchen-limit')).toBeNull();
    type(utils, 'e, f');
    expect(utils.getByTestId('kitchen-limit')).toBeTruthy();
    fireEvent.press(utils.getByTestId('kitchen-add'));
    expect(utils.getByTestId('kitchen-chip-e')).toBeTruthy();
    expect(utils.queryByTestId('kitchen-chip-f')).toBeNull();
  });

  it('finds recipes for the list, including what was typed but not yet added', () => {
    const onSubmit = jest.fn();
    const utils = render(<KitchenSheet initial={['chicken']} onSubmit={onSubmit} onClose={() => {}} />);
    type(utils, 'rice');
    fireEvent.press(utils.getByTestId('kitchen-find'));
    expect(onSubmit).toHaveBeenCalledWith(['chicken', 'rice']);
  });

  it('cannot search with nothing in it', () => {
    const onSubmit = jest.fn();
    const utils = render(<KitchenSheet onSubmit={onSubmit} onClose={() => {}} />);
    expect(utils.getByTestId('kitchen-find').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(utils.getByTestId('kitchen-find'));
    expect(onSubmit).not.toHaveBeenCalled();
    type(utils, '   ,  ');
    expect(utils.getByTestId('kitchen-find').props.accessibilityState.disabled).toBe(true);
  });

  it('closes with Cancel', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<KitchenSheet onSubmit={() => {}} onClose={onClose} />);
    fireEvent.press(getByTestId('kitchen-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
