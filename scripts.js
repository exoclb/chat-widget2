const state = {
    config: {
        maxMessages: 6,
        messageLifetime: 20,
        showAvatars: true,
        showBadges: true,
        showEmotes: true,
        showUsernameColor: true,
        compactMode: false,
        editorPreviewMessages: 2,
        hideCommands: true,
        commandPrefix: '!',
        hideBotAccounts: true,
        botKeywords: ['bot', 'streamlabs', 'streamelements'],
        highlightRoles: true,
        mergeConsecutiveMessages: true,
        groupWindowSeconds: 14,
        showRolePills: true,
        showReplies: true,
        highlightMentions: true,
        highlightKeywords: ['gg', 'important', 'raid'],
        themePreset: 'glass',
        showFirstChatterPill: true,
        showReturningPill: true,
        sessionReturnThreshold: 3,
        styleActionMessages: true,
        showDeletedPlaceholder: true,
        deletedPlaceholderLifetime: 3,
        bulkClearAnimation: true,
        showAnnouncementPill: true,
        showHighlightPill: true,
        emphasizeHighlightedMessages: true,
        persistSessionState: true,
        storeNamespace: 'twitch-chat-widget',
        animationPreset: 'smooth',
        densityPreset: 'comfortable',
        showIdleState: false,
        idleTitle: 'Chat is live',
        idleMessage: 'Waiting for the next message'
    },
    isEditorMode: false,
    messageCount: 0,
    removalTimers: new Map(),
    userMessageCounts: new Map(),
    persistKey: '',
    persistWriteTimer: null
};

const chatContainer = document.querySelector('.main-container');
const idleState = document.querySelector('.idle-state');
const idleStateTitle = document.querySelector('.idle-state__title');
const idleStateText = document.querySelector('.idle-state__text');

window.addEventListener('onWidgetLoad', function (obj) {
    state.config = readConfig(obj.detail.fieldData || {});
    state.persistKey = buildPersistKey(obj.detail);
    applyContainerMode();
    detectEditorMode(obj.detail);
});

window.addEventListener('onEventReceived', function (obj) {
    if (!obj.detail) {
        return;
    }

    const listener = obj.detail.listener;
    const event = obj.detail.event || {};

    if (listener === 'message') {
        appendMessage(normalizeMessage(event.data || event));
        return;
    }

    if (listener === 'kvstore:update') {
        syncPersistedState(event);
        return;
    }

    if (listener === 'delete-message') {
        removeByMessageId(event.msgId, { reason: 'moderated', preservePlaceholder: true });
        return;
    }

    if (listener === 'delete-messages') {
        removeByUserId(event.userId, { reason: 'bulk-moderated' });
    }
});

function readConfig(fieldData) {
    return {
        maxMessages: toNumber(fieldData.maxMessages, 6),
        messageLifetime: toNumber(fieldData.messageLifetime, 20),
        showAvatars: toBoolean(fieldData.showAvatars),
        showBadges: toBoolean(fieldData.showBadges),
        showEmotes: toBoolean(fieldData.showEmotes),
        showUsernameColor: toBoolean(fieldData.showUsernameColor),
        compactMode: toBoolean(fieldData.compactMode, false),
        editorPreviewMessages: toNumber(fieldData.editorPreviewMessages, 2),
        hideCommands: toBoolean(fieldData.hideCommands, true),
        commandPrefix: String(fieldData.commandPrefix || '!'),
        hideBotAccounts: toBoolean(fieldData.hideBotAccounts, true),
        botKeywords: parseKeywordList(fieldData.botKeywords, ['bot', 'streamlabs', 'streamelements']),
        highlightRoles: toBoolean(fieldData.highlightRoles, true),
        mergeConsecutiveMessages: toBoolean(fieldData.mergeConsecutiveMessages, true),
        groupWindowSeconds: toNumber(fieldData.groupWindowSeconds, 14),
        showRolePills: toBoolean(fieldData.showRolePills, true),
        showReplies: toBoolean(fieldData.showReplies, true),
        highlightMentions: toBoolean(fieldData.highlightMentions, true),
        highlightKeywords: parseKeywordList(fieldData.highlightKeywords, ['gg', 'important', 'raid']),
        themePreset: String(fieldData.themePreset || 'glass'),
        showFirstChatterPill: toBoolean(fieldData.showFirstChatterPill, true),
        showReturningPill: toBoolean(fieldData.showReturningPill, true),
        sessionReturnThreshold: toNumber(fieldData.sessionReturnThreshold, 3),
        styleActionMessages: toBoolean(fieldData.styleActionMessages, true),
        showDeletedPlaceholder: toBoolean(fieldData.showDeletedPlaceholder, true),
        deletedPlaceholderLifetime: toNumber(fieldData.deletedPlaceholderLifetime, 3),
        bulkClearAnimation: toBoolean(fieldData.bulkClearAnimation, true),
        showAnnouncementPill: toBoolean(fieldData.showAnnouncementPill, true),
        showHighlightPill: toBoolean(fieldData.showHighlightPill, true),
        emphasizeHighlightedMessages: toBoolean(fieldData.emphasizeHighlightedMessages, true),
        persistSessionState: toBoolean(fieldData.persistSessionState, true),
        storeNamespace: String(fieldData.storeNamespace || 'twitch-chat-widget'),
        animationPreset: String(fieldData.animationPreset || 'smooth'),
        densityPreset: String(fieldData.densityPreset || 'comfortable'),
        showIdleState: toBoolean(fieldData.showIdleState, false),
        idleTitle: String(fieldData.idleTitle || 'Chat is live'),
        idleMessage: String(fieldData.idleMessage || 'Waiting for the next message')
    };
}

function applyContainerMode() {
    chatContainer.classList.toggle('is-compact', state.config.compactMode);
    chatContainer.dataset.themePreset = state.config.themePreset;
    chatContainer.dataset.animationPreset = state.config.animationPreset;
    chatContainer.dataset.densityPreset = state.config.densityPreset;
    if (idleStateTitle) {
        idleStateTitle.textContent = state.config.idleTitle;
    }
    if (idleStateText) {
        idleStateText.textContent = state.config.idleMessage;
    }
    updateIdleState();
}

function detectEditorMode(detail) {
    const fallbackStatus = detail.overlay && detail.overlay.isEditorMode === true;
    if (typeof SE_API !== 'undefined' && typeof SE_API.getOverlayStatus === 'function') {
        SE_API.getOverlayStatus().then(function (status) {
            state.isEditorMode = Boolean(status && status.isEditorMode);
            loadPersistedState();
            if (state.isEditorMode) {
                renderEditorPreview();
            }
            updateIdleState();
        }).catch(function () {
            state.isEditorMode = fallbackStatus;
            loadPersistedState();
            if (state.isEditorMode) {
                renderEditorPreview();
            }
            updateIdleState();
        });
        return;
    }

    state.isEditorMode = fallbackStatus;
    loadPersistedState();
    if (state.isEditorMode) {
        renderEditorPreview();
    }
    updateIdleState();
}

function renderEditorPreview() {
    if (countRenderedMessages() > 0) {
        return;
    }

    const previews = [
        {
            msgId: 'preview-1',
            userId: 'preview-user-1',
            displayName: 'Streamer',
            displayColor: '#7dd3fc',
            text: 'Welcome in chat Kappa Keepo',
            emotes: [
                buildPreviewEmote('Kappa', 'https://static-cdn.jtvnw.net/emoticons/v1/25/2.0', 16, 20),
                buildPreviewEmote('Keepo', 'https://static-cdn.jtvnw.net/emoticons/v1/1902/2.0', 22, 26)
            ],
            badges: [
                { description: 'Broadcaster', type: 'broadcaster', url: 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3' }
            ],
            avatar: 'https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png',
            channel: 'streamer',
            firstMessage: true
        },
        {
            msgId: 'preview-2',
            userId: 'preview-user-2',
            displayName: 'Moderator',
            displayColor: '#86efac',
            text: '@Streamer please pin this important note.',
            emotes: [],
            badges: [
                { description: 'Moderator', type: 'moderator', url: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3' }
            ],
            avatar: 'https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png',
            channel: 'streamer',
            isAction: true,
            isAnnouncement: true,
            announcementColor: 'PRIMARY'
        },
        {
            msgId: 'preview-3',
            userId: 'preview-user-3',
            displayName: 'Viewer123',
            displayColor: '#f9a8d4',
            text: 'gg this widget looks clean.',
            emotes: [],
            badges: [
                { description: 'Subscriber', type: 'subscriber', url: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3' }
            ],
            avatar: 'https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png',
            channel: 'streamer',
            reply: {
                displayName: 'Streamer',
                text: 'Welcome in chat Kappa Keepo'
            },
            isReturningChatter: true,
            isHighlightedMessage: true
        }
    ];

    previews.slice(0, state.config.editorPreviewMessages).forEach(function (preview) {
        appendMessage(preview, true);
    });
    updateIdleState();
}

function buildPreviewEmote(name, url, start, end) {
    return {
        type: 'twitch',
        name: name,
        urls: {
            1: url,
            2: url,
            4: url
        },
        start: start,
        end: end
    };
}

function normalizeMessage(event) {
    const normalizedBadges = Array.isArray(event.badges) ? event.badges : [];
    const role = detectPrimaryRole(event, normalizedBadges);

    return {
        msgId: event.msgId || createMessageId(),
        userId: event.userId || '',
        displayName: event.displayName || event.nick || 'Unknown',
        displayColor: event.displayColor || '',
        text: event.text || '',
        emotes: Array.isArray(event.emotes) ? event.emotes : [],
        badges: normalizedBadges,
        avatar: event.avatar || '',
        role: role,
        roleLabel: formatRoleLabel(role),
        timestamp: Date.now(),
        channel: event.channel || '',
        reply: normalizeReply(event),
        isAction: Boolean(event.isAction),
        firstMessage: isFirstChatter(event),
        isReturningChatter: false,
        isAnnouncement: isAnnouncementMessage(event),
        announcementColor: normalizeAnnouncementColor(event),
        isHighlightedMessage: isHighlightedMessage(event)
    };
}

function appendMessage(message, skipAutoHide) {
    if (!message || !message.msgId) {
        return;
    }

    message.isReturningChatter = detectReturningChatter(message);

    if (!shouldRenderMessage(message)) {
        return;
    }

    removeByMessageId(message.msgId);

    const groupedMessage = findGroupTarget(message);
    if (groupedMessage) {
        appendMessageLine(groupedMessage, message);
        scheduleAutoHide(message, skipAutoHide);
        enforceMaxMessages();
        return;
    }

    const element = createMessageElement(message);
    chatContainer.appendChild(element);

    scheduleAutoHide(message, skipAutoHide);
    enforceMaxMessages();
    updateIdleState();
}

function createMessageElement(message) {
    const element = document.createElement('div');
    element.className = 'chat-message';
    element.dataset.groupUserId = message.userId || '';
    element.dataset.groupRole = message.role || 'viewer';
    element.dataset.groupDisplayName = message.displayName || '';
    element.dataset.lastTimestamp = String(message.timestamp || Date.now());

    if (!message.avatar || !state.config.showAvatars) {
        element.classList.add('chat-message--no-avatar');
    }

    const avatar = document.createElement('div');
    avatar.className = 'chat-message__avatar';

    if (message.avatar && state.config.showAvatars) {
        const avatarImage = document.createElement('img');
        avatarImage.className = 'chat-message__avatar-image';
        avatarImage.src = message.avatar;
        avatarImage.alt = message.displayName;
        avatar.appendChild(avatarImage);
    } else {
        avatar.textContent = getInitials(message.displayName);
        avatar.classList.add('chat-message__avatar--fallback');
    }

    const bubble = document.createElement('div');
    bubble.className = 'chat-message__bubble';
    if (state.config.highlightRoles && message.role) {
        bubble.classList.add('chat-message__bubble--' + message.role);
    }
    if (state.config.styleActionMessages && message.isAction) {
        bubble.classList.add('chat-message__bubble--action');
    }
    if (message.isAnnouncement) {
        bubble.classList.add('chat-message__bubble--announcement');
        if (message.announcementColor) {
            bubble.classList.add('chat-message__bubble--announcement-' + message.announcementColor.toLowerCase());
        }
    }

    const meta = document.createElement('div');
    meta.className = 'chat-message__meta';

    if (state.config.showBadges && message.badges.length > 0) {
        meta.appendChild(buildBadges(message.badges));
    }

    const username = document.createElement('span');
    username.className = 'chat-message__username';
    username.textContent = message.displayName;
    if (state.config.showUsernameColor && message.displayColor) {
        username.style.color = message.displayColor;
    }
    meta.appendChild(username);

    if (state.config.highlightRoles && state.config.showRolePills && message.role !== 'viewer') {
        meta.appendChild(buildRolePill(message.role, message.roleLabel));
    }
    if (message.firstMessage && state.config.showFirstChatterPill) {
        meta.appendChild(buildMetaPill('first', 'First chat'));
    }
    if (message.isReturningChatter && state.config.showReturningPill) {
        meta.appendChild(buildMetaPill('returning', 'Back'));
    }
    if (message.isAnnouncement && state.config.showAnnouncementPill) {
        meta.appendChild(buildMetaPill('announcement', 'Announcement'));
    }
    if (message.isHighlightedMessage && state.config.showHighlightPill) {
        meta.appendChild(buildMetaPill('highlight', 'Highlight'));
    }

    const lines = document.createElement('div');
    lines.className = 'chat-message__lines';
    lines.appendChild(buildMessageLine(message));

    bubble.appendChild(meta);
    bubble.appendChild(lines);
    element.appendChild(avatar);
    element.appendChild(bubble);
    return element;
}

function appendMessageLine(groupElement, message) {
    const lines = groupElement.querySelector('.chat-message__lines');
    if (!lines) {
        return;
    }

    lines.appendChild(buildMessageLine(message));
    groupElement.dataset.lastTimestamp = String(message.timestamp || Date.now());
}

function buildMessageLine(message) {
    const line = document.createElement('div');
    line.className = 'chat-message__line';
    line.dataset.msgId = message.msgId;
    line.dataset.userId = message.userId || '';
    line.dataset.timestamp = String(message.timestamp || Date.now());

    const text = document.createElement('div');
    text.className = 'chat-message__text';
    if (state.config.styleActionMessages && message.isAction) {
        text.classList.add('chat-message__text--action');
    }
    text.appendChild(buildMessageText(message.text, message.emotes));

    if (shouldHighlightMessage(message)) {
        line.classList.add('chat-message__line--highlighted');
    }
    if (message.isHighlightedMessage && state.config.emphasizeHighlightedMessages) {
        line.classList.add('chat-message__line--highlighted-strong');
    }
    if (message.isAnnouncement) {
        line.classList.add('chat-message__line--announcement');
    }

    if (state.config.showReplies && message.reply) {
        line.appendChild(buildReplyContext(message.reply));
    }
    line.appendChild(text);

    return line;
}

function buildReplyContext(reply) {
    const replyElement = document.createElement('div');
    replyElement.className = 'chat-message__reply';

    const label = document.createElement('span');
    label.className = 'chat-message__reply-label';
    label.textContent = 'Replying to ' + (reply.displayName || 'message');

    const excerpt = document.createElement('span');
    excerpt.className = 'chat-message__reply-text';
    excerpt.textContent = trimText(reply.text || '', 72);

    replyElement.appendChild(label);
    if (reply.text) {
        replyElement.appendChild(excerpt);
    }

    return replyElement;
}

function buildRolePill(role, label) {
    const pill = document.createElement('span');
    pill.className = 'chat-message__role chat-message__role--' + role;
    pill.textContent = label;
    return pill;
}

function buildMetaPill(kind, label) {
    const pill = document.createElement('span');
    pill.className = 'chat-message__role chat-message__role--meta chat-message__role--meta-' + kind;
    pill.textContent = label;
    return pill;
}

function shouldRenderMessage(message) {
    if (state.config.hideCommands && message.text && state.config.commandPrefix && message.text.trim().indexOf(state.config.commandPrefix) === 0) {
        return false;
    }

    if (state.config.hideBotAccounts && isLikelyBot(message)) {
        return false;
    }

    return true;
}

function shouldHighlightMessage(message) {
    if (message.isHighlightedMessage) {
        return true;
    }

    if (state.config.highlightMentions) {
        const mentionTargets = [
            message.channel,
            message.displayName
        ].filter(Boolean).map(function (value) {
            return '@' + String(value).toLowerCase();
        });
        const normalizedText = String(message.text || '').toLowerCase();
        if (mentionTargets.some(function (target) { return normalizedText.indexOf(target) !== -1; })) {
            return true;
        }
    }

    return state.config.highlightKeywords.some(function (keyword) {
        return keyword && String(message.text || '').toLowerCase().indexOf(keyword) !== -1;
    });
}

function isLikelyBot(message) {
    const normalizedName = String(message.displayName || '').toLowerCase();
    return state.config.botKeywords.some(function (keyword) {
        return keyword && normalizedName.indexOf(keyword) !== -1;
    });
}

function findGroupTarget(message) {
    if (!state.config.mergeConsecutiveMessages) {
        return null;
    }

    const previousGroup = chatContainer.lastElementChild;
    if (!previousGroup) {
        return null;
    }

    const sameUser = previousGroup.dataset.groupUserId === (message.userId || '');
    const sameRole = previousGroup.dataset.groupRole === (message.role || 'viewer');
    const withinWindow = (message.timestamp - Number(previousGroup.dataset.lastTimestamp || 0)) <= (state.config.groupWindowSeconds * 1000);

    if (sameUser && sameRole && withinWindow) {
        return previousGroup;
    }

    return null;
}

function scheduleAutoHide(message, skipAutoHide) {
    state.messageCount += 1;
    trackSeenUser(message);
    if (!skipAutoHide && state.config.messageLifetime > 0) {
        scheduleRemoval(message.msgId, state.config.messageLifetime * 1000);
    }
}

function buildBadges(badges) {
    const badgeList = document.createElement('span');
    badgeList.className = 'chat-message__badges';

    badges.forEach(function (badge) {
        if (!badge || !badge.url) {
            return;
        }

        const badgeImage = document.createElement('img');
        badgeImage.className = 'chat-message__badge';
        badgeImage.src = badge.url;
        badgeImage.alt = badge.description || badge.type || 'Badge';
        badgeImage.title = badge.description || badge.type || 'Badge';
        badgeList.appendChild(badgeImage);
    });

    return badgeList;
}

function buildMessageText(text, emotes) {
    const fragment = document.createDocumentFragment();

    if (!state.config.showEmotes || !Array.isArray(emotes) || emotes.length === 0) {
        fragment.appendChild(document.createTextNode(text));
        return fragment;
    }

    const sortedEmotes = emotes
        .filter(isValidEmoteRange)
        .sort(function (a, b) {
            return a.start - b.start;
        });

    let cursor = 0;
    sortedEmotes.forEach(function (emote) {
        if (emote.start > cursor) {
            fragment.appendChild(document.createTextNode(text.slice(cursor, emote.start)));
        }

        if (emote.start < cursor) {
            return;
        }

        const emoteUrl = resolveEmoteUrl(emote);
        if (!emoteUrl) {
            fragment.appendChild(document.createTextNode(text.slice(emote.start, emote.end + 1)));
            cursor = emote.end + 1;
            return;
        }

        const emoteImage = document.createElement('img');
        emoteImage.className = 'chat-message__emote';
        emoteImage.src = emoteUrl;
        emoteImage.alt = emote.name || text.slice(emote.start, emote.end + 1);
        emoteImage.title = emote.name || emoteImage.alt;
        fragment.appendChild(emoteImage);
        cursor = emote.end + 1;
    });

    if (cursor < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }

    return fragment;
}

function isValidEmoteRange(emote) {
    return emote &&
        typeof emote.start === 'number' &&
        typeof emote.end === 'number' &&
        emote.end >= emote.start;
}

function resolveEmoteUrl(emote) {
    if (emote.urls) {
        return emote.urls[2] || emote.urls[4] || emote.urls[1] || '';
    }
    return '';
}

function enforceMaxMessages() {
    while (countRenderedMessages() > state.config.maxMessages) {
        const oldestLine = chatContainer.querySelector('.chat-message__line');
        if (!oldestLine) {
            return;
        }
        clearScheduledRemoval(oldestLine.dataset.msgId);
        removeLineElement(oldestLine);
    }
    updateIdleState();
}

function scheduleRemoval(msgId, delay) {
    clearScheduledRemoval(msgId);
    state.removalTimers.set(msgId, window.setTimeout(function () {
        removeByMessageId(msgId);
    }, delay));
}

function clearScheduledRemoval(msgId) {
    const timer = state.removalTimers.get(msgId);
    if (timer) {
        window.clearTimeout(timer);
        state.removalTimers.delete(msgId);
    }
}

function removeByMessageId(msgId, options) {
    if (!msgId) {
        return;
    }

    clearScheduledRemoval(msgId);
    const line = chatContainer.querySelector('.chat-message__line[data-msg-id="' + cssEscape(msgId) + '"]');
    if (line) {
        removeLineElement(line, true, options || {});
    }
}

function removeByUserId(userId, options) {
    if (!userId) {
        return;
    }

    Array.from(chatContainer.querySelectorAll('.chat-message__line[data-user-id="' + cssEscape(userId) + '"]')).forEach(function (line) {
        clearScheduledRemoval(line.dataset.msgId);
        removeLineElement(line, true, options || {});
    });
}

function removeElement(element) {
    if (!element || element.dataset.removing === 'true') {
        return;
    }

    element.dataset.removing = 'true';
    clearScheduledRemoval(element.dataset.msgId);
    element.classList.add('is-removing');

    window.setTimeout(function () {
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
        updateIdleState();
    }, 220);
}

function removeLineElement(line, animate, options) {
    if (!line) {
        return;
    }

    const group = line.closest('.chat-message');
    if (!group) {
        return;
    }

    const removalOptions = options || {};
    if (removalOptions.reason === 'moderated' && removalOptions.preservePlaceholder && state.config.showDeletedPlaceholder) {
        convertLineToPlaceholder(line);
        return;
    }

    if (removalOptions.reason === 'bulk-moderated' && state.config.bulkClearAnimation) {
        line.classList.add('chat-message__line--bulk-removing');
    }

    if (animate) {
        line.classList.add('chat-message__line--removing');
        window.setTimeout(function () {
            detachLine(line, group);
        }, 160);
        return;
    }

    detachLine(line, group);
}

function convertLineToPlaceholder(line) {
    line.classList.remove('chat-message__line--highlighted');
    line.classList.add('chat-message__line--placeholder');
    line.removeAttribute('data-msg-id');
    line.removeAttribute('data-user-id');
    line.innerHTML = '';

    const placeholder = document.createElement('div');
    placeholder.className = 'chat-message__placeholder';
    placeholder.textContent = 'Message deleted by moderation';
    line.appendChild(placeholder);

    window.setTimeout(function () {
        removeLineElement(line, true, { reason: 'placeholder-expire' });
    }, Math.max(1, state.config.deletedPlaceholderLifetime) * 1000);
}

function detachLine(line, group) {
    if (line.parentNode) {
        line.parentNode.removeChild(line);
    }

    if (!group.querySelector('.chat-message__line')) {
        removeElement(group);
        return;
    }

    const lastLine = group.querySelector('.chat-message__line:last-child');
    if (lastLine) {
        group.dataset.lastTimestamp = lastLine.dataset.timestamp || String(Date.now());
    }
    updateIdleState();
}

function countRenderedMessages() {
    return chatContainer.querySelectorAll('.chat-message__line').length;
}

function updateIdleState() {
    if (!idleState) {
        return;
    }

    const shouldShow = state.config.showIdleState &&
        !state.isEditorMode &&
        countRenderedMessages() === 0;

    chatContainer.classList.toggle('has-idle-state', shouldShow);
    idleState.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
}

function detectPrimaryRole(event, badges) {
    const roleSources = []
        .concat(badges)
        .concat(event.tags ? Object.keys(event.tags).map(function (key) {
            return { type: key, description: String(event.tags[key]) };
        }) : []);

    if (hasRoleMatch(roleSources, 'broadcaster')) {
        return 'broadcaster';
    }
    if (hasRoleMatch(roleSources, 'moderator') || event.isModerator) {
        return 'moderator';
    }
    if (hasRoleMatch(roleSources, 'vip')) {
        return 'vip';
    }
    if (hasRoleMatch(roleSources, 'subscriber') || event.subscriber) {
        return 'subscriber';
    }
    return 'viewer';
}

function isFirstChatter(event) {
    const tags = event.tags || {};
    return tags['first-msg'] === '1' || tags.firstMsg === '1' || event.firstMessage === true;
}

function detectReturningChatter(message) {
    if (!message.userId) {
        return Boolean(message.isReturningChatter);
    }

    const priorCount = state.userMessageCounts.get(message.userId) || 0;
    return priorCount >= Math.max(1, state.config.sessionReturnThreshold);
}

function isAnnouncementMessage(event) {
    const tags = event.tags || {};
    return event.isAnnouncement === true ||
        tags['msg-id'] === 'announcement' ||
        tags['message-type'] === 'announcement';
}

function normalizeAnnouncementColor(event) {
    const tags = event.tags || {};
    const color = event.announcementColor || tags['announcement-color'] || tags.announcementColor;
    if (!color) {
        return '';
    }
    return String(color).toUpperCase();
}

function isHighlightedMessage(event) {
    const tags = event.tags || {};
    return event.isHighlightedMessage === true ||
        tags['msg-id'] === 'highlighted-message' ||
        tags['custom-reward-id'] !== undefined;
}

function trackSeenUser(message) {
    if (!message.userId) {
        return;
    }

    const priorCount = state.userMessageCounts.get(message.userId) || 0;
    state.userMessageCounts.set(message.userId, priorCount + 1);
    schedulePersistState();
}

function normalizeReply(event) {
    const tags = event.tags || {};
    const parentDisplayName = event.reply && event.reply.displayName ? event.reply.displayName : tags['reply-parent-display-name'];
    const parentText = event.reply && event.reply.body ? event.reply.body : tags['reply-parent-msg-body'];

    if (!parentDisplayName && !parentText) {
        return null;
    }

    return {
        displayName: parentDisplayName || 'message',
        text: parentText || ''
    };
}

function buildPersistKey(detail) {
    const namespace = sanitizeStoreSegment(state.config.storeNamespace || 'twitch-chat-widget');
    const channelData = detail.channel || {};
    const channelName = sanitizeStoreSegment(channelData.username || channelData.name || channelData.displayName || 'global');
    return namespace + '.' + channelName + '.session';
}

function sanitizeStoreSegment(value) {
    return String(value || 'default').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'default';
}

function loadPersistedState() {
    if (!state.config.persistSessionState || state.isEditorMode || !state.persistKey) {
        return;
    }

    if (typeof SE_API === 'undefined' || !SE_API.store || typeof SE_API.store.get !== 'function') {
        return;
    }

    SE_API.store.get(state.persistKey).then(function (obj) {
        applyPersistedState(obj);
    }).catch(function () {
    });
}

function applyPersistedState(obj) {
    if (!obj || typeof obj !== 'object') {
        return;
    }

    const counts = obj.userMessageCounts;
    if (!counts || typeof counts !== 'object') {
        return;
    }

    state.userMessageCounts = new Map(Object.keys(counts).map(function (key) {
        return [key, Number(counts[key]) || 0];
    }));
}

function schedulePersistState() {
    if (!state.config.persistSessionState || state.isEditorMode || !state.persistKey) {
        return;
    }

    if (typeof SE_API === 'undefined' || !SE_API.store || typeof SE_API.store.set !== 'function') {
        return;
    }

    if (state.persistWriteTimer) {
        window.clearTimeout(state.persistWriteTimer);
    }

    state.persistWriteTimer = window.setTimeout(function () {
        state.persistWriteTimer = null;
        SE_API.store.set(state.persistKey, serializePersistedState());
    }, 250);
}

function serializePersistedState() {
    return {
        version: 1,
        userMessageCounts: Object.fromEntries(state.userMessageCounts)
    };
}

function syncPersistedState(event) {
    if (!state.config.persistSessionState || !event || !event.data || !state.persistKey) {
        return;
    }

    const data = event.data;
    const expectedKeys = [
        state.persistKey,
        'customWidget.' + state.persistKey
    ];

    if (expectedKeys.indexOf(data.key) === -1) {
        return;
    }

    applyPersistedState(data.value);
}

function hasRoleMatch(sources, roleName) {
    return sources.some(function (source) {
        const haystack = [
            source && source.type,
            source && source.description,
            source && source.name,
            source && source.id
        ].join(' ').toLowerCase();
        return haystack.indexOf(roleName) !== -1;
    });
}

function formatRoleLabel(role) {
    if (role === 'broadcaster') {
        return 'Host';
    }
    if (role === 'moderator') {
        return 'Mod';
    }
    if (role === 'subscriber') {
        return 'Sub';
    }
    if (role === 'vip') {
        return 'VIP';
    }
    return 'Viewer';
}

function getInitials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(function (part) {
        return part.charAt(0).toUpperCase();
    }).join('') || '?';
}

function createMessageId() {
    state.messageCount += 1;
    return 'message-' + state.messageCount;
}

function toBoolean(value, defaultValue) {
    if (typeof value === 'undefined') {
        return typeof defaultValue === 'boolean' ? defaultValue : true;
    }
    return value === true || value === 'true' || value === 'yes';
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseKeywordList(value, fallback) {
    if (typeof value !== 'string' || value.trim() === '') {
        return fallback.slice();
    }

    return value.split(',').map(function (item) {
        return item.trim().toLowerCase();
    }).filter(Boolean);
}

function trimText(value, maxLength) {
    const text = String(value || '');
    if (text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength - 1).trimEnd() + '…';
}

function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(String(value));
    }
    return String(value).replace(/["\\]/g, '\\$&');
}
