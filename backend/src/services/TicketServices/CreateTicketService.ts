import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import ShowContactService from "../ContactServices/ShowContactService";
import SyncChatHistoryService from "./SyncChatHistoryService";

interface Request {
  contactId: number;
  status: string;
  userId: number;
  queueId?: number;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  queueId
}: Request): Promise<Ticket> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(userId);

  let existingTicket = await Ticket.findOne({
    where: {
      contactId,
      whatsappId: defaultWhatsapp.id
    },
    order: [["updatedAt", "DESC"]],
    include: ["contact"]
  });

  if (existingTicket) {
    if (existingTicket.status === "closed") {
      await existingTicket.update({ status: "open", userId });
    }
    await SyncChatHistoryService(existingTicket);
    return existingTicket;
  }

  const { isGroup } = await ShowContactService(contactId);

  if (queueId === undefined) {
    const user = await User.findByPk(userId, { include: ["queues"] });
    queueId = user?.queues.length === 1 ? user.queues[0].id : undefined;
  }

  const { id }: Ticket = await defaultWhatsapp.$create("ticket", {
    contactId,
    status,
    isGroup,
    userId,
    queueId
  });

  const ticket = await Ticket.findByPk(id, { include: ["contact"] });

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  await SyncChatHistoryService(ticket);

  return ticket;
};

export default CreateTicketService;
