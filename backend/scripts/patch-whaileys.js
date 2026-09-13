const fs = require("fs");
const path = require("path");

function patchFile(filePath, search, replacement, patchName) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`[PATCH] File not found: ${filePath}`);
      return;
    }
    let content = fs.readFileSync(filePath, "utf8");
    if (content.includes(replacement)) {
      console.log(`[PATCH] ${patchName} already applied.`);
      return;
    }
    if (!content.includes(search)) {
      console.log(`[PATCH] Search target not found for ${patchName}`);
      return;
    }
    content = content.replace(search, replacement);
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[PATCH] Successfully applied ${patchName}`);
  } catch (err) {
    console.error(`[PATCH] Error applying ${patchName}:`, err);
  }
}

const basePath = path.resolve(__dirname, "..");
const historyJs = path.join(basePath, "node_modules", "whaileys", "lib", "Utils", "history.js");
const messagesSendJs = path.join(basePath, "node_modules", "whaileys", "lib", "Socket", "messages-send.js");
const makeInMemoryStoreJs = path.join(basePath, "node_modules", "whaileys", "lib", "Store", "make-in-memory-store.js");

patchFile(
  historyJs,
  `                for (const item of msgs) {\n                    const message = item.message;\n                    messages.push(message);`,
  `                for (const item of msgs) {\n                    const message = item.message;\n                    if (message && message.key && !message.key.remoteJid) {\n                        message.key.remoteJid = chat.id;\n                    }\n                    messages.push(message);`,
  "whaileys history.js chat.id to remoteJid"
);

patchFile(
  messagesSendJs,
  `        const meLid = (0, WABinary_1.jidNormalizedUser)(authState.creds.me.lid);`,
  `        const meLid = (0, WABinary_1.jidNormalizedUser)(authState.creds.me.lid || authState.creds.me.id);`,
  "whaileys messages-send.js meLid fallback to me.id"
);

patchFile(
  makeInMemoryStoreJs,
  `            for (const msg of newMessages) {\n                const jid = msg.key.remoteJid;\n                const list = assertMessageList(jid);`,
  `            for (const msg of newMessages) {\n                const rawJid = msg.key?.remoteJid || msg.chatId;\n                const jid = (0, WABinary_1.jidNormalizedUser)(rawJid);\n                const list = assertMessageList(jid);`,
  "whaileys make-in-memory-store.js normalize jid on messaging-history.set"
);

patchFile(
  makeInMemoryStoreJs,
  `        ev.on("contacts.update", updates => {\n            for (const update of updates) {\n                if (contacts[update.id]) {\n                    Object.assign(contacts[update.id], update);\n                }\n                else {\n                    logger.debug({ update }, "got update for non-existant contact");\n                }\n            }\n        });`,
  `        ev.on("contacts.upsert", newContacts => {\n            contactsUpsert(newContacts);\n        });\n        ev.on("contacts.update", updates => {\n            for (const update of updates) {\n                if (contacts[update.id]) {\n                    Object.assign(contacts[update.id], update);\n                }\n                else {\n                    contacts[update.id] = Object.assign({}, update);\n                }\n            }\n        });`,
  "whaileys make-in-memory-store.js listen to contacts.upsert"
);