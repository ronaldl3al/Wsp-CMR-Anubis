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
  extraInfo = []
}: Request): Promise<Contact> => {
  const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");
  if (!number && !lid) throw new Error("Either number or lid must be provided");

  const isNameGarbage = !name || /^[.\-_*~,#@!?:;'"\\/\s]+$/.test(name.trim());
  const validName = isNameGarbage ? (number || lid || "") : name.trim();

  const [contactByNumber, contactByLid] = await Promise.all([
    number ? Contact.findOne({ where: { number } }) : null,
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
    if (
      validName &&
      validName !== number &&
      (contactByNumber.name === contactByNumber.number ||
        !contactByNumber.name ||
        /^[.\-_*~,#@!?:;'"\\/\s]+$/.test(contactByNumber.name))
    ) {
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

  if (contactByNumber) {
    const updateData: any = {
      lid: lid || contactByNumber.lid,
      profilePicUrl: profilePicUrl || contactByNumber.profilePicUrl
    };
    if (
      validName &&
      (contactByNumber.name === contactByNumber.number ||
        contactByNumber.name === contactByNumber.lid ||
        !contactByNumber.name ||
        /^[.\-_*~,#@!?:;'"\\/\s]+$/.test(contactByNumber.name))
    ) {
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
    if (
      validName &&
      (contactByLid.name === contactByLid.number ||
        contactByLid.name === contactByLid.lid ||
        !contactByLid.name ||
        /^[.\-_*~,#@!?:;'"\\/\s]+$/.test(contactByLid.name))
    ) {
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
