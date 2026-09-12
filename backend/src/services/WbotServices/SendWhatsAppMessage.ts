import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { whatsappProvider, ProviderMessage } from "../../providers/WhatsApp";

import formatBody from "../../helpers/Mustache";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<ProviderMessage> => {
  if (!ticket.whatsappId) {
    throw new AppError("ERR_TICKET_NO_WHATSAPP");
  }

  let chatId = "";
  if (ticket.contact.lid) {
    chatId = ticket.contact.lid;
  } else if (ticket.isGroup) {
    chatId = `${ticket.contact.number}@g.us`;
  } else {
    // If it's a long opaque ID from the recent bug, route it to @lid
    if (ticket.contact.number && ticket.contact.number.length >= 14 && ticket.contact.number.startsWith("70")) {
      chatId = `${ticket.contact.number}@lid`;
    } else {
      chatId = `${ticket.contact.number}@c.us`;
    }
  }

  try {
    const sentMessage = await whatsappProvider.sendMessage(
      ticket.whatsappId,
      chatId,
      formatBody(body, ticket.contact),
      {
        quotedMessageId: quotedMsg?.id,
        quotedMessageFromMe: quotedMsg?.fromMe,
        linkPreview: false
      }
    );

    await ticket.update({ lastMessage: body });
    return sentMessage;
  } catch (err) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
