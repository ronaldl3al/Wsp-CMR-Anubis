import { Pool } from 'pg';
import { config } from './config';
import { Contact, Chat, Message, MessageAck, QuickNote } from './types';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 8,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

export async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('[DB] Initializing PostgreSQL wsp_ schema...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wsp_contacts (
        jid VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255),
        push_name VARCHAR(255),
        number VARCHAR(50) NOT NULL,
        profile_pic_url TEXT,
        is_saved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS wsp_chats (
        jid VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255),
        number VARCHAR(50),
        is_group BOOLEAN DEFAULT FALSE,
        unread_count INT DEFAULT 0,
        last_message_text TEXT,
        last_message_type VARCHAR(50) DEFAULT 'chat',
        last_message_time BIGINT,
        last_message_from_me BOOLEAN DEFAULT FALSE,
        last_message_status VARCHAR(20) DEFAULT 'delivered',
        is_pinned BOOLEAN DEFAULT FALSE,
        is_archived BOOLEAN DEFAULT FALSE,
        profile_pic_url TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS wsp_messages (
        id VARCHAR(150) PRIMARY KEY,
        chat_jid VARCHAR(100) REFERENCES wsp_chats(jid) ON DELETE CASCADE,
        sender_jid VARCHAR(100),
        sender_name VARCHAR(255),
        from_me BOOLEAN NOT NULL,
        body TEXT,
        type VARCHAR(50) DEFAULT 'chat',
        media_url TEXT,
        media_mimetype VARCHAR(100),
        media_filename VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        quoted_id VARCHAR(150),
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_wsp_messages_chat_jid_timestamp ON wsp_messages(chat_jid, timestamp DESC);

      CREATE TABLE IF NOT EXISTS wsp_quick_notes (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'General',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE wsp_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
      ALTER TABLE wsp_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
      ALTER TABLE wsp_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
    `);

    // Seed initial quick notes if none exist
    const noteCountRes = await client.query('SELECT COUNT(*) FROM wsp_quick_notes');
    if (parseInt(noteCountRes.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO wsp_quick_notes (title, content, category) VALUES
        ('Saludo Inicial', '¡Hola! Bienvenido a ANUBIS STORE. ¿En qué podemos ayudarte hoy?', 'General'),
        ('Horario de Atención', 'Nuestro horario de atención es de Lunes a Sábado de 9:00 AM a 6:00 PM.', 'Información'),
        ('Métodos de Pago', 'Aceptamos transferencias bancarias nacionales, Pago Móvil, Zelle y USDT Binance Pay.', 'Ventas'),
        ('Confirmación de Pedido', '¡Tu pedido ha sido procesado con éxito! En breve te enviaremos el comprobante y los detalles de entrega.', 'Ventas');
      `);
    }

    console.log('[DB] PostgreSQL wsp_ tables successfully verified and initialized.');
  } catch (err: any) {
    console.error('[DB] Error initializing database schema:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// Contacts CRUD
export async function getContacts(): Promise<Contact[]> {
  const res = await pool.query('SELECT * FROM wsp_contacts ORDER BY name ASC NULLS LAST, number ASC');
  return res.rows;
}

export async function upsertContact(contact: Partial<Contact> & { jid: string }): Promise<Contact> {
  const number = contact.number || contact.jid.split('@')[0];
  const query = `
    INSERT INTO wsp_contacts (jid, name, push_name, number, profile_pic_url, is_saved, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (jid) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, wsp_contacts.name),
      push_name = COALESCE(EXCLUDED.push_name, wsp_contacts.push_name),
      number = EXCLUDED.number,
      profile_pic_url = COALESCE(EXCLUDED.profile_pic_url, wsp_contacts.profile_pic_url),
      is_saved = COALESCE(EXCLUDED.is_saved, wsp_contacts.is_saved),
      updated_at = NOW()
    RETURNING *;
  `;
  const values = [
    contact.jid,
    contact.name || null,
    contact.push_name || null,
    number,
    contact.profile_pic_url || null,
    contact.is_saved ?? false
  ];
  const res = await pool.query(query, values);
  return res.rows[0];
}

// Chats CRUD
export async function getChats(): Promise<Chat[]> {
  const query = `
    SELECT c.*, COALESCE(con.profile_pic_url, c.profile_pic_url) as profile_pic_url,
           COALESCE(con.name, c.name) as display_name
    FROM wsp_chats c
    LEFT JOIN wsp_contacts con ON c.jid = con.jid
    ORDER BY c.updated_at DESC
  `;
  const res = await pool.query(query);
  return res.rows.map(row => ({
    ...row,
    name: row.display_name || row.name || row.number || row.jid.split('@')[0]
  }));
}

export async function getChat(jid: string): Promise<Chat | null> {
  const query = `
    SELECT c.*, COALESCE(con.profile_pic_url, c.profile_pic_url) as profile_pic_url,
           COALESCE(con.name, c.name) as display_name
    FROM wsp_chats c
    LEFT JOIN wsp_contacts con ON c.jid = con.jid
    WHERE c.jid = $1
  `;
  const res = await pool.query(query, [jid]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    ...row,
    name: row.display_name || row.name || row.number || row.jid.split('@')[0]
  };
}

export async function upsertChat(chat: Partial<Chat> & { jid: string }): Promise<Chat> {
  const number = chat.number || chat.jid.split('@')[0];
  const isGroup = chat.is_group ?? chat.jid.includes('@g.us');

  const query = `
    INSERT INTO wsp_chats (
      jid, name, number, is_group, unread_count,
      last_message_text, last_message_type, last_message_time,
      last_message_from_me, last_message_status, profile_pic_url, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (jid) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, wsp_chats.name),
      number = EXCLUDED.number,
      is_group = EXCLUDED.is_group,
      unread_count = COALESCE(EXCLUDED.unread_count, wsp_chats.unread_count),
      last_message_text = COALESCE(EXCLUDED.last_message_text, wsp_chats.last_message_text),
      last_message_type = COALESCE(EXCLUDED.last_message_type, wsp_chats.last_message_type),
      last_message_time = COALESCE(EXCLUDED.last_message_time, wsp_chats.last_message_time),
      last_message_from_me = COALESCE(EXCLUDED.last_message_from_me, wsp_chats.last_message_from_me),
      last_message_status = COALESCE(EXCLUDED.last_message_status, wsp_chats.last_message_status),
      profile_pic_url = COALESCE(EXCLUDED.profile_pic_url, wsp_chats.profile_pic_url),
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    chat.jid,
    chat.name || null,
    number,
    isGroup,
    chat.unread_count ?? 0,
    chat.last_message_text || null,
    chat.last_message_type || 'chat',
    chat.last_message_time || Math.floor(Date.now() / 1000),
    chat.last_message_from_me ?? false,
    chat.last_message_status || 'delivered',
    chat.profile_pic_url || null
  ];

  const res = await pool.query(query, values);
  return res.rows[0];
}

export async function markChatAsRead(jid: string): Promise<void> {
  await pool.query('UPDATE wsp_chats SET unread_count = 0 WHERE jid = $1', [jid]);
}

// Messages CRUD
export async function getMessages(chatJid: string, limit = 100): Promise<Message[]> {
  const query = `
    SELECT * FROM wsp_messages
    WHERE chat_jid = $1
    ORDER BY timestamp ASC
    LIMIT $2
  `;
  const res = await pool.query(query, [chatJid, limit]);
  return res.rows;
}

export async function addMessage(msg: Message): Promise<{ message: Message; chat: Chat }> {
  // Ensure chat exists
  let chat = await getChat(msg.chat_jid);
  if (!chat) {
    chat = await upsertChat({
      jid: msg.chat_jid,
      name: msg.sender_name || msg.chat_jid.split('@')[0],
      number: msg.chat_jid.split('@')[0],
      is_group: msg.chat_jid.includes('@g.us')
    });
  }

  // Insert or update message
  const msgQuery = `
    INSERT INTO wsp_messages (
      id, chat_jid, sender_jid, sender_name, from_me,
      body, type, media_url, media_mimetype, media_filename,
      status, quoted_id, quoted_body, quoted_sender, timestamp, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
    ON CONFLICT (id) DO UPDATE SET
      status = CASE 
        WHEN wsp_messages.status = 'read' THEN 'read'
        WHEN wsp_messages.status = 'delivered' AND EXCLUDED.status = 'sent' THEN 'delivered'
        ELSE EXCLUDED.status 
      END,
      body = COALESCE(EXCLUDED.body, wsp_messages.body),
      media_url = COALESCE(EXCLUDED.media_url, wsp_messages.media_url),
      quoted_id = COALESCE(EXCLUDED.quoted_id, wsp_messages.quoted_id),
      quoted_body = COALESCE(EXCLUDED.quoted_body, wsp_messages.quoted_body),
      quoted_sender = COALESCE(EXCLUDED.quoted_sender, wsp_messages.quoted_sender)
    RETURNING *;
  `;

  const msgValues = [
    msg.id,
    msg.chat_jid,
    msg.sender_jid || null,
    msg.sender_name || null,
    msg.from_me,
    msg.body || '',
    msg.type || 'chat',
    msg.media_url || null,
    msg.media_mimetype || null,
    msg.media_filename || null,
    msg.status || 'sent',
    msg.quoted_id || null,
    msg.quoted_body || null,
    msg.quoted_sender || null,
    msg.timestamp || Math.floor(Date.now() / 1000)
  ];

  const msgRes = await pool.query(msgQuery, msgValues);
  const savedMsg = msgRes.rows[0];

  // Update chat summary
  const unreadIncrement = !msg.from_me ? 1 : 0;
  const updateChatQuery = `
    UPDATE wsp_chats SET
      last_message_text = $2,
      last_message_type = $3,
      last_message_time = $4,
      last_message_from_me = $5,
      last_message_status = $6,
      unread_count = unread_count + $7,
      updated_at = NOW()
    WHERE jid = $1
    RETURNING *;
  `;

  const previewText = msg.body || (msg.type !== 'chat' ? `[${msg.type}]` : '');
  const updatedChatRes = await pool.query(updateChatQuery, [
    msg.chat_jid,
    previewText,
    msg.type,
    msg.timestamp,
    msg.from_me,
    msg.status,
    unreadIncrement
  ]);

  const updatedChat = updatedChatRes.rows[0] || chat;
  return { message: savedMsg, chat: updatedChat };
}

export async function updateMessageStatus(id: string, status: MessageAck): Promise<Message | null> {
  const query = 'UPDATE wsp_messages SET status = $2 WHERE id = $1 RETURNING *';
  const res = await pool.query(query, [id, status]);
  if (res.rows.length === 0) return null;

  const msg = res.rows[0];
  await pool.query(
    'UPDATE wsp_chats SET last_message_status = $2 WHERE jid = $1 AND last_message_time = $3',
    [msg.chat_jid, status, msg.timestamp]
  );

  return msg;
}

export async function updateMessageBody(id: string, newBody: string): Promise<Message | null> {
  const query = 'UPDATE wsp_messages SET body = $1, is_edited = TRUE WHERE id = $2 RETURNING *';
  const res = await pool.query(query, [newBody, id]);
  return res.rows[0] || null;
}

export async function deleteMessage(id: string): Promise<Message | null> {
  const query = "UPDATE wsp_messages SET body = '🚫 Este mensaje fue eliminado', is_deleted = TRUE WHERE id = $1 RETURNING *";
  const res = await pool.query(query, [id]);
  return res.rows[0] || null;
}

export async function toggleMessagePin(id: string, pinned?: boolean): Promise<Message | null> {
  let query = 'UPDATE wsp_messages SET is_pinned = NOT is_pinned WHERE id = $1 RETURNING *';
  let values: any[] = [id];
  if (typeof pinned === 'boolean') {
    query = 'UPDATE wsp_messages SET is_pinned = $1 WHERE id = $2 RETURNING *';
    values = [pinned, id];
  }
  const res = await pool.query(query, values);
  return res.rows[0] || null;
}

// Quick Notes CRUD
export async function getQuickNotes(): Promise<QuickNote[]> {
  const res = await pool.query('SELECT * FROM wsp_quick_notes ORDER BY category ASC, id ASC');
  return res.rows;
}

export async function createQuickNote(title: string, content: string, category = 'General'): Promise<QuickNote> {
  const res = await pool.query(
    'INSERT INTO wsp_quick_notes (title, content, category) VALUES ($1, $2, $3) RETURNING *',
    [title, content, category]
  );
  return res.rows[0];
}

export async function deleteQuickNote(id: number): Promise<boolean> {
  const res = await pool.query('DELETE FROM wsp_quick_notes WHERE id = $1', [id]);
  return (res.rowCount ?? 0) > 0;
}
