import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { whatsappProvider } from "../../providers/WhatsApp";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

const ImportContactsService = async (userId: number): Promise<void> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(userId);

  let phoneContacts;

  try {
    phoneContacts = await whatsappProvider.getContacts(defaultWhatsapp.id);
  } catch (err) {
    logger.error(`Could not get whatsapp contacts from phone. Err: ${err}`);
  }

  if (phoneContacts) {
    const io = getIO();
    await Promise.all(
      phoneContacts.map(async ({ number, name }) => {
        if (!number) {
          return null;
        }
        if (!name) {
          name = number;
        }

        const numberExists = await Contact.findOne({
          where: { number }
        });

        if (numberExists) {
          if (name && name !== number && numberExists.name !== name) {
            await numberExists.update({ name });
            io.emit("contact", { action: "update", contact: numberExists });
          }
          return null;
        }

        const created = await Contact.create({ number, name });
        io.emit("contact", { action: "create", contact: created });
        return created;
      })
    );
  }
};

export default ImportContactsService;
