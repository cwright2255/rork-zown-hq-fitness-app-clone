// How long a post, a comment and a message can be, and how long the name and picture address on them can be. The rules
// (firestore.rules) refuse anything longer, and the screens stop typing at the same numbers, so nobody types a long message and
// finds it refused when they press send. __tests__/communityLimits.test.js checks that the rules say the same numbers.
export const MAX_POST_LENGTH = 2000;
export const MAX_COMMENT_LENGTH = 1000;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_NAME_LENGTH = 100;
export const MAX_PICTURE_LENGTH = 2000;
