import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import SyncChatHistoryService from "../TicketServices/SyncChatHistoryService";

interface Request {
  ticketId: string;
  pageNumber?: string;
}

interface Response {
  messages: Message[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

const ListMessagesService = async ({
  pageNumber = "1",
  ticketId
}: Request): Promise<Response> => {
  const ticket = await ShowTicketService(ticketId);

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  let ticketIds: number[] = [+ticketId];
  if (ticket.contactId) {
    const contactTickets = await Ticket.findAll({
      where: {
        contactId: ticket.contactId
      },
      attributes: ["id"]
    });
    ticketIds = contactTickets.map(t => t.id);
    if (!ticketIds.includes(+ticketId)) {
      ticketIds.push(+ticketId);
    }
  }

  // If no messages exist in DB for this contact and it's the first page, sync history from WhatsApp
  if (+pageNumber === 1) {
    const existingCount = await Message.count({
      where: { ticketId: { [Op.in]: ticketIds } }
    });
    if (existingCount === 0) {
      await SyncChatHistoryService(ticket);
    }
  }

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: messages } = await Message.findAndCountAll({
    where: { ticketId: { [Op.in]: ticketIds } },
    limit,
    include: [
      "contact",
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ],
    offset,
    order: [["createdAt", "DESC"]]
  });

  const hasMore = count > offset + messages.length;

  return {
    messages: messages.reverse(),
    ticket,
    count,
    hasMore
  };
};

export default ListMessagesService;
