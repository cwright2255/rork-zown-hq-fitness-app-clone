// lib/diaryNav.js
//
// Getting back to the food diary after logging from a screen that was opened
// on top of the search screen (quick add, create food): the search screen
// sits between, so one step back would land on it. Dismisses both.

export function backToDiary(router) {
  if (router && typeof router.dismiss === 'function') {
    router.dismiss(2);
    return;
  }
  router.replace('/nutrition');
}
