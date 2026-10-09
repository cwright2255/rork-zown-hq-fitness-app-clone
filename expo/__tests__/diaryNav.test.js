import { backToDiary } from '../lib/diaryNav';

describe('backToDiary', () => {
  it('closes both screens on top of the diary (the search screen and the one opened from it)', () => {
    const router = { dismiss: jest.fn(), replace: jest.fn() };
    backToDiary(router);
    expect(router.dismiss).toHaveBeenCalledTimes(1);
    expect(router.dismiss).toHaveBeenCalledWith(2);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('goes to the diary directly when the router cannot dismiss screens', () => {
    const router = { replace: jest.fn() };
    backToDiary(router);
    expect(router.replace).toHaveBeenCalledWith('/nutrition');
  });

  it('does not treat a non-function dismiss as usable', () => {
    const router = { dismiss: 'nope', replace: jest.fn() };
    backToDiary(router);
    expect(router.replace).toHaveBeenCalledWith('/nutrition');
  });
});
