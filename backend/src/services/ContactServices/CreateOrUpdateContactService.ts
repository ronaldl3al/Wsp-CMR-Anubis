import { Op } from "sequelize";
import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  lid?: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  isRegisteredName?: boolean;
}

const emitContact = (action: "update" | "create", contact: Contact) => {
  const io = getIO();

  io.emit("contact", { action, contact });
};

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  lid,
  profilePicUrl,
  isGroup,
  email = "",
  extraInfo = [],
  isRegisteredName = false
}: Request): Promise<Contact> => {
  const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");
  if (!number && !lid) throw new Error("Either number or lid must be provided");

  const isNameGarbage = !name || /^[.\-_*~,#@!?:;'"\\/\s]+$/.test(name.trim());
  const validName = isNameGarbage ? (number || lid || "") : name.trim();

  const orConditions: any[] = [];
  if (number) {
    orConditions.push({ number });
    if (number.length >= 8) {
      orConditions.push({ number: { [Op.like]: `%${number.slice(-8)}` } });
    }
    if (number.length === 10 && number.startsWith("4")) {
      orConditions.push({ number: `58${number}` });
    }
    if (number.length === 12 && number.startsWith("58")) {
      orConditions.push({ number: `0${number.slice(2)}` });
      orConditions.push({ number: number.slice(2) });
    }
  }

  const [contactByNumber, contactByLid] = await Promise.all([
    orConditions.length > 0 ? Contact.findOne({ where: { [Op.or]: orConditions } }) : null,
    lid ? Contact.findOne({ where: { lid } }) : null
  ]);

  const shouldMerge =
    contactByNumber && contactByLid && contactByNumber.id !== contactByLid.id;

  if (shouldMerge) {
    await Ticket.update(
      { contactId: contactByNumber.id },
      { where: { contactId: contactByLid.id } }
    );

    await contactByLid.destroy();

    const mergeUpdate: any = {
      lid: contactByLid.lid,
      profilePicUrl: profilePicUrl || contactByNumber.profilePicUrl
    };
    const shouldUpdateName = (currentName?: string): boolean => {
      if (!validName || validName === number || validName === lid) return false;
      if (isRegisteredName) return true;
      return (
        !currentName ||
        currentName === number ||
        currentName === lid ||
        /^[.\-_*~,#@!?:;'"\\/\s]+$/.test(currentName)
      );
    };

    if (shouldUpdateName(contactByNumber.name)) {
      mergeUpdate.name = validName;
    }
    await contactByNumber.update(mergeUpdate);

    logger.info({
      info: "Merged contacts by number and lid",
      primaryContactId: contactByNumber.id,
      mergedContactId: contactByLid.id
    });

    emitContact("update", contactByNumber);

    return contactByNumber;
  }

  const shouldUpdateName = (currentName?: string): boolean => {
    if (!validName || validName === number || validName === lid) return false;
    if (isRegisteredName) return true;
    return (
      !currentName ||
      currentName === number ||
      currentName === lid ||
      /^[.\-_*~,#@!?:;'"\\/\s]+$/.test(currentName)
    );
  };

  if (contactByNumber) {
    const updateData: any = {
      lid: lid || contactByNumber.lid,
      profilePicUrl: profilePicUrl || contactByNumber.profilePicUrl
    };
    if (shouldUpdateName(contactByNumber.name)) {
      updateData.name = validName;
    }
    await contactByNumber.update(updateData);

    emitContact("update", contactByNumber);

    return contactByNumber;
  }

  if (contactByLid) {
    const updateData: any = {
      number: number || contactByLid.number,
      profilePicUrl: profilePicUrl || contactByLid.profilePicUrl
    };
    if (shouldUpdateName(contactByLid.name)) {
      updateData.name = validName;
    }
    await contactByLid.update(updateData);

    emitContact("update", contactByLid);
    return contactByLid;
  }

  const created = await Contact.create({
    name: validName,
    number,
    lid,
    profilePicUrl,
    email,
    isGroup,
    extraInfo
  });

  emitContact("create", created);
  return created;
};

export default CreateOrUpdateContactService;
