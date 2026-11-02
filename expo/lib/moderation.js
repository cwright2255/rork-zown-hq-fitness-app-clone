// lib/moderation.js
//
// The shared pieces of Report, Block and the Terms line: what a person can report something for, the report that is saved, which
// people's posts and comments are hidden, and the words of the no-tolerance line on the Register screen.

/** What can be reported, and what each is called on screen. */
export const REPORT_KINDS = {
  post: 'post',
  comment: 'comment',
  message: 'message',
};

/**
 * The reasons offered when reporting. `key` is what is saved on the report (firestore.rules lists the same keys, and
 * __tests__/moderation.test.js checks that the two match), `label` is what the person reads.
 */
export const REPORT_REASONS = [
  { key: 'spam', label: 'Spam or a scam' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'hate', label: 'Hate or abusive language' },
  { key: 'sexual', label: 'Nudity or sexual content' },
  { key: 'violence', label: 'Violence or threats' },
  { key: 'self_harm', label: 'Self-harm' },
  { key: 'other', label: 'Something else' },
];

/** The most of a post, comment or message that is copied onto its report (firestore.rules allows 1000). */
export const REPORT_TEXT_MAX = 1000;

/**
 * The line on the Register screen, under the box that agrees to the Terms. This is the wording to approve: it is the whole of what
 * the screen promises, and the Terms of Service say the same (app/profile/terms.jsx, section 4).
 */
export const NO_TOLERANCE_LINE =
  'ZOWN HQ has no tolerance for objectionable content or abusive users. Posts, comments and messages that break the rules are removed, '
  + 'and people who abuse others lose their account. You can report anything you see and block anyone, at any time.';

/** The id of a report: one per person per thing reported (firestore.rules requires exactly this name). */
export function reportId(reporterId, kind, targetId) {
  return `${reporterId}_${kind}_${targetId}`;
}

/**
 * The report as it is saved. Returns null when something that has to be there is not. `now` is the time the report is made at, as
 * an ISO text (firestore.rules wants text no longer than 40 characters, the same as the calendar invites).
 */
export function buildReport({ reporterId, kind, targetId, targetPath, targetAuthorId, reason, text, now = new Date().toISOString() }) {
  if (!reporterId || !REPORT_KINDS[kind] || !targetId || !targetPath) return null;
  if (!REPORT_REASONS.some((r) => r.key === reason)) return null;
  const report = {
    reporterId,
    kind,
    targetId: String(targetId),
    targetPath: String(targetPath),
    targetAuthorId: targetAuthorId ? String(targetAuthorId) : '',
    reason,
    createdAt: now,
  };
  const copy = typeof text === 'string' ? text.trim().slice(0, REPORT_TEXT_MAX) : '';
  if (copy) report.text = copy;
  return report;
}

/** Whether this person has blocked this author. `blocked` is the map in store/blockStore.js: { [uid]: { ... } }. */
export function isBlocked(blocked, uid) {
  return !!uid && !!blocked && Object.prototype.hasOwnProperty.call(blocked, uid);
}

/**
 * The posts, comments or conversations left once the ones from blocked people are taken out. `getUid` says whose each one is
 * (the author of a post or comment, the other person in a conversation). Gives back the same list when nobody is blocked.
 */
export function withoutBlocked(items, blocked, getUid = (item) => item.authorId) {
  const list = Array.isArray(items) ? items : [];
  if (!blocked || Object.keys(blocked).length === 0) return list;
  return list.filter((item) => !isBlocked(blocked, getUid(item)));
}

/**
 * Who can delete a comment from the feed: its author, and the owner of the post it is on. (Admins can too, through the rules, from
 * the admin console; the app does not know who is an admin.)
 */
export function canDeleteComment({ comment, post, myUid }) {
  if (!myUid || !comment) return false;
  return comment.authorId === myUid || (!!post && post.authorId === myUid);
}

/*
 * What the Report / Block sheet (components/ModerationSheet.jsx) is opened with: the thing, whose it is, and where it is in the
 * database. `authorId` is who wrote it, `authorName` and `authorAvatar` are what the Blocked people list will show, `text` is copied
 * onto the report, and `canDelete` (comments only) is whether this person can remove it.
 */

export function postTarget(post) {
  return {
    kind: 'post',
    id: post.id,
    path: `communityPosts/${post.id}`,
    authorId: post.authorId,
    authorName: post.authorName,
    authorAvatar: post.authorAvatar || null,
    text: post.text || '',
    canDelete: false,
  };
}

export function commentTarget({ post, comment, myUid }) {
  return {
    kind: 'comment',
    id: comment.id,
    path: `communityPosts/${post.id}/comments/${comment.id}`,
    postId: post.id,
    authorId: comment.authorId,
    authorName: comment.authorName,
    authorAvatar: null,
    text: comment.text || '',
    canDelete: canDeleteComment({ comment, post, myUid }),
  };
}

/** A person, from the menu in a message thread's header: there is nothing to report on them, only to block. */
export function personTarget({ uid, name, avatar }) {
  return {
    kind: 'person',
    id: uid,
    path: `users/${uid}`,
    authorId: uid,
    authorName: name,
    authorAvatar: avatar || null,
    text: '',
    canDelete: false,
  };
}

export function messageTarget({ conversationId, message, otherName, otherAvatar }) {
  return {
    kind: 'message',
    id: message.id,
    path: `conversations/${conversationId}/messages/${message.id}`,
    authorId: message.senderId,
    authorName: otherName,
    authorAvatar: otherAvatar || null,
    text: message.text || '',
    canDelete: false,
  };
}
