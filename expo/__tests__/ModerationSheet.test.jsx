// The Report / Block / Delete menu behind the three-dot button (components/ModerationSheet.jsx).
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { Ionicons: (props) => mockReact.createElement(mockRn.Text, null, `icon:${props.name}`) };
}, { virtual: true });
jest.mock('@/services/reportService', () => ({ submitReport: jest.fn() }));
jest.mock('@/store/blockStore', () => {
  const state = { blockUser: jest.fn() };
  const hook = (select) => select(state);
  hook.getState = () => state;
  return { useBlockStore: hook };
});

import ModerationSheet from '../components/ModerationSheet';
import { REPORT_REASONS, postTarget, commentTarget, messageTarget, personTarget } from '../lib/moderation';
import { submitReport } from '../services/reportService';
import { useBlockStore } from '../store/blockStore';

const post = { id: 'p1', authorId: 'u2', authorName: 'Dana Lee', authorAvatar: 'd.png', text: 'Buy my shake' };
const onClose = jest.fn();
const onBlocked = jest.fn();
const onDeleteComment = jest.fn();

const open = (target, extra = {}) => render(
  <ModerationSheet target={target} myUid="u1" onClose={onClose} onBlocked={onBlocked} onDeleteComment={onDeleteComment} {...extra} />,
);
const press = (utils, testID) => act(async () => { fireEvent.press(utils.getByTestId(testID)); });
/** Presses the button with this label in the alert that was last shown. */
const answerAlert = async (label) => {
  const buttons = Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1][2];
  await act(async () => { await buttons.find((b) => b.text === label).onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  submitReport.mockResolvedValue({ status: 'sent' });
  useBlockStore.getState().blockUser.mockResolvedValue(true);
});
afterEach(() => { Alert.alert.mockRestore(); });

describe('the menu', () => {
  it('shows nothing when there is nothing to report', () => {
    const utils = open(null);
    expect(utils.toJSON()).toBeNull();
  });

  it('on someone else\'s post offers Report and Block, with their name, and no Delete', () => {
    const utils = open(postTarget(post));
    expect(utils.getByText('Report post')).toBeTruthy();
    expect(utils.getByText('Block Dana Lee')).toBeTruthy();
    expect(utils.getByText('Cancel')).toBeTruthy();
    expect(utils.queryByTestId('mod-delete')).toBeNull();
  });

  it('calls a comment a comment and a message a message', () => {
    const c = open(commentTarget({ post, comment: { id: 'c1', authorId: 'u3', authorName: 'Wes', text: 'x' }, myUid: 'u9' }));
    expect(c.getByText('Report comment')).toBeTruthy();
    c.unmount();
    const m = open(messageTarget({ conversationId: 'u1_u2', message: { id: 'm1', senderId: 'u2', text: 'x' }, otherName: 'Dana', otherAvatar: '' }));
    expect(m.getByText('Report message')).toBeTruthy();
  });

  it('on a comment you can remove (the owner of the post) also offers Delete', () => {
    const utils = open(commentTarget({ post: { id: 'p1', authorId: 'u1' }, comment: { id: 'c1', authorId: 'u3', authorName: 'Wes', text: 'x' }, myUid: 'u1' }));
    expect(utils.getByText('Delete comment')).toBeTruthy();
    expect(utils.getByText('Report comment')).toBeTruthy();
    expect(utils.getByText('Block Wes')).toBeTruthy();
  });

  it('on your own comment offers only Delete: you cannot report or block yourself', () => {
    const utils = open(commentTarget({ post, comment: { id: 'c1', authorId: 'u1', authorName: 'Cj', text: 'x' }, myUid: 'u1' }));
    expect(utils.getByText('Delete comment')).toBeTruthy();
    expect(utils.queryByTestId('mod-report')).toBeNull();
    expect(utils.queryByTestId('mod-block')).toBeNull();
  });

  it('on a person (the thread\'s header) offers Block and nothing to report', () => {
    const utils = open(personTarget({ uid: 'u2', name: 'Dana Lee', avatar: '' }));
    expect(utils.getByText('Block Dana Lee')).toBeTruthy();
    expect(utils.queryByTestId('mod-report')).toBeNull();
  });

  it('closes from Cancel', () => {
    const utils = open(postTarget(post));
    fireEvent.press(utils.getByTestId('mod-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Report', () => {
  const choose = async (utils, key) => {
    await press(utils, 'mod-report');
    await press(utils, `mod-reason-${key}`);
  };

  it('asks why, with every reason the app offers and a way back', async () => {
    const utils = open(postTarget(post));
    await press(utils, 'mod-report');
    expect(utils.getByText('Why are you reporting this post?')).toBeTruthy();
    for (const reason of REPORT_REASONS) expect(utils.getByText(reason.label)).toBeTruthy();
    await press(utils, 'mod-back');
    expect(utils.getByText('Report post')).toBeTruthy();
    expect(submitReport).not.toHaveBeenCalled();
  });

  it('files the report with who, what, whose, why and a copy of the words, then says thanks and closes', async () => {
    const utils = open(postTarget(post));
    await choose(utils, 'spam');
    expect(submitReport).toHaveBeenCalledWith({
      reporterId: 'u1', kind: 'post', targetId: 'p1', targetPath: 'communityPosts/p1', targetAuthorId: 'u2', reason: 'spam', text: 'Buy my shake',
    });
    expect(Alert.alert).toHaveBeenCalledWith('Report sent', expect.stringMatching(/review every report/));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reports a comment with the place it is in', async () => {
    const utils = open(commentTarget({ post, comment: { id: 'c1', authorId: 'u3', authorName: 'Wes', text: 'rude' }, myUid: 'u1' }));
    await choose(utils, 'harassment');
    expect(submitReport).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'comment', targetId: 'c1', targetPath: 'communityPosts/p1/comments/c1', targetAuthorId: 'u3', reason: 'harassment', text: 'rude',
    }));
  });

  it('reports a message with the place it is in', async () => {
    const utils = open(messageTarget({ conversationId: 'u1_u2', message: { id: 'm1', senderId: 'u2', text: 'hey' }, otherName: 'Dana', otherAvatar: '' }));
    await choose(utils, 'hate');
    expect(submitReport).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'message', targetId: 'm1', targetPath: 'conversations/u1_u2/messages/m1', targetAuthorId: 'u2', reason: 'hate',
    }));
  });

  it('says so, and closes, when it was already reported', async () => {
    submitReport.mockResolvedValue({ status: 'already' });
    const utils = open(postTarget(post));
    await choose(utils, 'spam');
    expect(Alert.alert).toHaveBeenCalledWith('Already reported', expect.any(String));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says it did not go through, and stays open to try again, when it fails', async () => {
    submitReport.mockRejectedValue(new Error('offline'));
    const utils = open(postTarget(post));
    await choose(utils, 'spam');
    expect(Alert.alert).toHaveBeenCalledWith("Couldn't send the report", expect.stringMatching(/already have it/));
    expect(onClose).not.toHaveBeenCalled();
    expect(utils.getByText('Spam or a scam')).toBeTruthy();
  });

  it('does not send two reports for one tap that lands twice', async () => {
    let finish;
    submitReport.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const utils = open(postTarget(post));
    await press(utils, 'mod-report');
    await press(utils, 'mod-reason-spam');
    await press(utils, 'mod-reason-hate');
    expect(submitReport).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ status: 'sent' }); });
  });

  it('does not send a second report even when a press gets past the greyed-out rows', async () => {
    let finish;
    submitReport.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const utils = open(postTarget(post));
    await press(utils, 'mod-report');
    await press(utils, 'mod-reason-spam');
    // fireEvent respects `disabled`; this calls the row's own handler, as a press that lands in the same frame would.
    const row = utils.UNSAFE_getAllByProps({ testID: 'mod-reason-hate' }).find((node) => typeof node.props.onPress === 'function');
    await act(async () => { row.props.onPress(); });
    expect(submitReport).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ status: 'sent' }); });
  });

  it('starts at the menu each time it is opened on something else', async () => {
    const utils = open(postTarget(post));
    await press(utils, 'mod-report');
    utils.rerender(
      <ModerationSheet target={postTarget({ ...post, id: 'p2' })} myUid="u1" onClose={onClose} onBlocked={onBlocked} onDeleteComment={onDeleteComment} />,
    );
    expect(utils.getByText('Report post')).toBeTruthy();
    expect(utils.queryByText('Why are you reporting this post?')).toBeNull();
  });
});

describe('Block', () => {
  it('asks first, in plain words about what it does and how to undo it', async () => {
    const utils = open(postTarget(post));
    await press(utils, 'mod-block');
    const [title, message, buttons] = Alert.alert.mock.calls[0];
    expect(title).toBe('Block Dana Lee?');
    expect(message).toMatch(/won't see their posts or comments/);
    expect(message).toMatch(/message the other/);
    expect(message).toMatch(/Settings, under Blocked people/);
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Block']);
    expect(useBlockStore.getState().blockUser).not.toHaveBeenCalled();
  });

  it('blocks the author, with their name and picture for the list in Settings, then closes and tells the screen', async () => {
    const target = postTarget(post);
    const utils = open(target);
    await press(utils, 'mod-block');
    await answerAlert('Block');
    expect(useBlockStore.getState().blockUser).toHaveBeenCalledWith({ myUid: 'u1', uid: 'u2', name: 'Dana Lee', avatar: 'd.png' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onBlocked).toHaveBeenCalledWith(target);
  });

  it('stays open, and says so, when the block does not go through', async () => {
    useBlockStore.getState().blockUser.mockResolvedValue(false);
    const utils = open(postTarget(post));
    await press(utils, 'mod-block');
    await answerAlert('Block');
    expect(Alert.alert).toHaveBeenLastCalledWith("Couldn't block", expect.any(String));
    expect(onClose).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('blocks a person from the thread\'s header the same way', async () => {
    const utils = open(personTarget({ uid: 'u2', name: 'Dana Lee', avatar: '' }));
    await press(utils, 'mod-block');
    await answerAlert('Block');
    expect(useBlockStore.getState().blockUser).toHaveBeenCalledWith({ myUid: 'u1', uid: 'u2', name: 'Dana Lee', avatar: null });
  });
});

describe('Delete', () => {
  const removable = () => commentTarget({ post: { id: 'p1', authorId: 'u1' }, comment: { id: 'c1', authorId: 'u3', authorName: 'Wes', text: 'x' }, myUid: 'u1' });

  it('asks first', async () => {
    const utils = open(removable());
    await press(utils, 'mod-delete');
    expect(Alert.alert.mock.calls[0][0]).toBe('Delete comment?');
    expect(onDeleteComment).not.toHaveBeenCalled();
  });

  it('hands the comment to the screen to delete, and closes', async () => {
    const target = removable();
    const utils = open(target);
    await press(utils, 'mod-delete');
    await answerAlert('Delete');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDeleteComment).toHaveBeenCalledWith(target);
  });

  it('does nothing when the person says Cancel', async () => {
    const utils = open(removable());
    await press(utils, 'mod-delete');
    const buttons = Alert.alert.mock.calls[0][2];
    expect(buttons.find((b) => b.text === 'Cancel').onPress).toBeUndefined();
    expect(onDeleteComment).not.toHaveBeenCalled();
  });
});
