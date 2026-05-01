const UIUtils = require('./ui_utils.js');
const UIDialogs = require('./ui_dialogs.js');
const UIMessages = require('./ui_messages.js');
const UIContextMenu = require('./ui_context_menu.js');

const UIManager = {
    ...UIUtils,
    ...UIDialogs,
    ...UIMessages,
    ...UIContextMenu,
}

module.exports = UIManager;
