import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Contact from "../../models/Contact";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import { whatsappProvider } from "../../providers/WhatsApp/whatsappProvider";

interface SyncResult {
  syncedCount: number;
}

export const SyncChatHistoryService = async (
  ticket: Ticket
): Promise<SyncResult> => {
  if (!ticket || !ticket.whatsappId) return { syncedCount: 0 };

  const contact =
    ticket.contact || (await Contact.findByPk(ticket.contactId));
  if (!contact) return { syncedCount: 0 };

  try {
    const rawNumber = (contact.number || "").replace(/\D/g, "");
    const targetNumbers = new Set<string>();

    if (rawNumber) {
      targetNumbers.add(rawNumber);
      if (rawNumber.startsWith("0") && rawNumber.length === 11) {
        targetNumbers.add(`58${rawNumber.slice(1)}`);
        targetNumbers.add(rawNumber.slice(1));
      } else if (rawNumber.startsWith("4") && rawNumber.length === 10) {
        targetNumbers.add(`58${rawNumber}`);
        targetNumbers.add(`0${rawNumber}`);
      } else if (rawNumber.startsWith("58")) {
        targetNumbers.add(rawNumber.slice(2));
        targetNumbers.add(`0${rawNumber.slice(2)}`);
      }
    }

    const candidateIds: string[] = [];
    if (ticket.isGroup) {
      candidateIds.push(`${rawNumber || contact.number}@g.us`);
    } else {
      for (const num of targetNumbers) {
        if (num) {
          candidateIds.push(`${num}@s.whatsapp.net`);
          candidateIds.push(`${num}@c.us`);
        }
      }
      if (contact.lid) {
        candidateIds.push(
          contact.lid.includes("@") ? contact.lid : `${contact.lid}@lid`
        );
      }
    }

    const uniqueCandidates = [...new Set(candidateIds)];
    let rawMessages: any[] = [];

    for (const chatId of uniqueCandidates) {
      try {
        const msgs = await whatsappProvider.fetchChatMessages(
          ticket.whatsappId,
          chatId,
          100
        );
        if (msgs && msgs.length > 0) {
          rawMessages = msgs;
          break;
        }
      } catch (e) {
        // ignore error for this candidate
      }
    }

    if (!rawMessages || rawMessages.length === 0) {
      const last8 = rawNumber.length >= 8 ? rawNumber.slice(-8) : "";
      if (last8) {
        try {
          const msgs = await whatsappProvider.fetchChatMessages(
            ticket.whatsappId,
            last8,
            100
          );
          if (msgs && msgs.length > 0) {
            rawMessages = msgs;
          }
        } catch {}
      }
    }

    let syncedCount = 0;
    let latestMessageBody = ticket.lastMessage;

    // Retrieve all ticket IDs belonging to this contact for broadcast
    const contactTickets = await Ticket.findAll({
      where: { contactId: contact.id },
      attributes: ["id"]
    });
    const ticketIdsToBroadcast = contactTickets.map(t => t.id.toString());
    if (!ticketIdsToBroadcast.includes(ticket.id.toString())) {
      ticketIdsToBroadcast.push(ticket.id.toString());
    }

    for (const rawMsg of rawMessages) {
      if (!rawMsg.id) continue;

      const existing = await Message.findByPk(rawMsg.id);
      if (existing) continue;

      const rawTs = Number(rawMsg.timestamp);
      const timestampMs = rawTs > 1000000000000 ? rawTs : rawTs * 1000;
      const messageDate = new Date(timestampMs || Date.now());

      const created = await Message.create({
        id: rawMsg.id,
        ticketId: ticket.id,
        contactId: rawMsg.fromMe ? null : contact.id,
        body: rawMsg.body || "",
        fromMe: Boolean(rawMsg.fromMe),
        read: true,
        mediaType: rawMsg.type || "chat",
        mediaUrl: null,
        ack: rawMsg.ack || 0,
        createdAt: messageDate,
        updatedAt: messageDate
      });

      syncedCount++;
      latestMessageBody = rawMsg.body || latestMessageBody;

      for (const tId of ticketIdsToBroadcast) {
        getIO().to(tId).emit("appMessage", {
          action: "create",
          message: created
        });
      }
    }

    if (syncedCount > 0) {
      await ticket.update({ lastMessage: latestMessageBody });
      for (const tId of ticketIdsToBroadcast) {
        getIO()
          .to(ticket.status)
          .to("notification")
          .to(tId)
          .emit("ticket", {
            action: "update",
            ticket
          });
      }
      logger.info(
        `[SYNC] Loaded ${syncedCount} history messages for ticket #${ticket.id}`
      );
    }

    return { syncedCount };
  } catch (err) {
    logger.error({ err }, `Error syncing chat history for ticket #${ticket.id}`);
    return { syncedCount: 0 };
  }
};

export default SyncChatHistoryService;
