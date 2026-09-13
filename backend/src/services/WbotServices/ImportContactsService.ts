import { Op } from "sequelize";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { whatsappProvider } from "../../providers/WhatsApp";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

const ImportContactsService = async (
  userId: number
): Promise<{ total: number; updatedCount: number; createdCount: number }> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(userId);

  let phoneContacts: any[] = [];

  try {
    phoneContacts = await whatsappProvider.getContacts(defaultWhatsapp.id);
  } catch (err) {
    logger.error(`Could not get whatsapp contacts from phone. Err: ${err}`);
  }

  let updatedCount = 0;
  let createdCount = 0;

  if (phoneContacts && Array.isArray(phoneContacts)) {
    const io = getIO();
    for (const { number: rawNumber, name: rawName } of phoneContacts) {
      if (!rawNumber) continue;

      const cleanNumber = rawNumber.replace(/\D/g, "");
      if (!cleanNumber || cleanNumber.length < 7) continue;

      const isValidName =
        rawName &&
        rawName.trim().length > 0 &&
        rawName !== rawNumber &&
        rawName !== cleanNumber &&
        !/^[.\-_*~,#@!?:;'"\\/\s]+$/.test(rawName.trim());

      const finalName = isValidName ? rawName.trim() : cleanNumber;

      const orConditions: any[] = [
        { number: cleanNumber }
      ];
      if (cleanNumber.length >= 8) {
        orConditions.push({ number: { [Op.like]: `%${cleanNumber.slice(-8)}` } });
      }
      if (cleanNumber.length === 10 && cleanNumber.startsWith("4")) {
        orConditions.push({ number: `58${cleanNumber}` });
      }
      if (cleanNumber.length === 12 && cleanNumber.startsWith("58")) {
        orConditions.push({ number: `0${cleanNumber.slice(2)}` });
        orConditions.push({ number: cleanNumber.slice(2) });
      }

      try {
        const numberExists = await Contact.findOne({
          where: { [Op.or]: orConditions }
        });

        if (numberExists) {
          if (isValidName && numberExists.name !== finalName) {
            await numberExists.update({ name: finalName });
            updatedCount++;
            io.emit("contact", { action: "update", contact: numberExists });
          }
        } else {
          const created = await Contact.create({
            number: cleanNumber,
            name: finalName,
            isGroup: false
          });
          createdCount++;
          io.emit("contact", { action: "create", contact: created });
        }
      } catch (e) {
        logger.error({ info: "Error importing contact from whatsapp", err: e, cleanNumber });
      }
    }
  }

  logger.info(
    `[WSP_IMPORT] Finished importing: ${createdCount} created, ${updatedCount} updated, ${phoneContacts?.length || 0} total.`
  );

  return {
    total: phoneContacts?.length || 0,
    updatedCount,
    createdCount
  };
};

export default ImportContactsService;
