import { Op } from "sequelize";
import Contact from "../../models/Contact";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";

const GOOGLE_CSV_HEADER =
  "First Name,Middle Name,Last Name,Phonetic First Name,Phonetic Middle Name,Phonetic Last Name,Name Prefix,Name Suffix,Nickname,File As,Organization Name,Organization Title,Organization Department,Birthday,Notes,Photo,Labels,Phone 1 - Label,Phone 1 - Value";

const escapeCsv = (str: string | null | undefined): string => {
  if (!str) return "";
  const cleaned = String(str).replace(/"/g, '""');
  if (cleaned.includes(",") || cleaned.includes('"') || cleaned.includes("\n")) {
    return `"${cleaned}"`;
  }
  return cleaned;
};

export const ExportGoogleContactsService = async (
  filterType: "all" | "unregistered" = "all"
): Promise<string> => {
  const contacts = await Contact.findAll({
    order: [["name", "ASC"]]
  });

  const lines: string[] = [GOOGLE_CSV_HEADER];

  for (const contact of contacts) {
    if (contact.isGroup) continue;

    const isUnregistered =
      !contact.name ||
      contact.name === contact.number ||
      contact.name === contact.lid ||
      /^[.\-_* ]+$/.test(contact.name);

    if (filterType === "unregistered" && !isUnregistered) {
      continue;
    }

    const cleanNumber = contact.number ? contact.number.replace(/\D/g, "") : "";
    if (!cleanNumber) continue;

    const phone = `+${cleanNumber}`;
    const firstName = isUnregistered ? phone : contact.name;

    const row = [
      escapeCsv(firstName), // First Name
      "", // Middle Name
      "", // Last Name
      "", // Phonetic First Name
      "", // Phonetic Middle Name
      "", // Phonetic Last Name
      "", // Name Prefix
      "", // Name Suffix
      "", // Nickname
      "", // File As
      "", // Organization Name
      "", // Organization Title
      "", // Organization Department
      "", // Birthday
      escapeCsv(isUnregistered ? "Unregistered WhatsApp" : "Whaticket"), // Notes
      "", // Photo
      escapeCsv("* myContacts"), // Labels
      "Mobile", // Phone 1 - Label
      escapeCsv(phone) // Phone 1 - Value
    ];

    lines.push(row.join(","));
  }

  return lines.join("\r\n");
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const ImportGoogleContactsService = async (
  csvData: string
): Promise<{ createdCount: number; updatedCount: number; total: number }> => {
  const lines = csvData
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { createdCount: 0, updatedCount: 0, total: 0 };
  }

  const header = parseCsvLine(lines[0]);

  let firstNameIdx = header.findIndex(h =>
    /first\s*name/i.test(h) || /^nombre/i.test(h)
  );
  let middleNameIdx = header.findIndex(h => /middle\s*name/i.test(h));
  let lastNameIdx = header.findIndex(h =>
    /last\s*name/i.test(h) || /^apellido/i.test(h)
  );
  let phoneIdx = header.findIndex(h =>
    /phone\s*1\s*-\s*value/i.test(h) || /phone|tel[eé]fono|celular|mobile/i.test(h)
  );

  // Default fallback if header indices weren't matched
  if (firstNameIdx === -1) firstNameIdx = 0;
  if (lastNameIdx === -1) lastNameIdx = 2;
  if (phoneIdx === -1) phoneIdx = header.length - 1;

  let createdCount = 0;
  let updatedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (!row || row.length === 0) continue;

    const firstName = row[firstNameIdx] || "";
    const middleName = middleNameIdx !== -1 ? row[middleNameIdx] || "" : "";
    const lastName = lastNameIdx !== -1 ? row[lastNameIdx] || "" : "";

    const fullName = [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const rawPhone = row[phoneIdx] || "";
    if (!rawPhone) continue;

    // Handle multiple numbers separated by ':::' or '/'
    const phoneCandidates = rawPhone.split(/:::|\//);

    for (const cand of phoneCandidates) {
      const cleanNumber = cand.replace(/\D/g, "");
      if (!cleanNumber || cleanNumber.length < 7) continue;

      try {
        const whereClause: any = {
          [Op.or]: [
            { number: cleanNumber },
            cleanNumber.length >= 8
              ? { number: { [Op.like]: `%${cleanNumber.slice(-8)}` } }
              : { number: cleanNumber }
          ]
        };

        const existing = await Contact.findOne({ where: whereClause });

        if (existing) {
          if (fullName && fullName !== cleanNumber && existing.name !== fullName) {
            await existing.update({ name: fullName });
            updatedCount++;
            getIO().emit("contact", { action: "update", contact: existing });
          }
        } else {
          const created = await Contact.create({
            name: fullName || cleanNumber,
            number: cleanNumber,
            isGroup: false
          });
          createdCount++;
          getIO().emit("contact", { action: "create", contact: created });
        }
      } catch (err) {
        logger.error({ info: "Error importing google contact row", err, cleanNumber });
      }
    }
  }

  logger.info(
    `[GOOGLE_SYNC] Processed: ${createdCount} created, ${updatedCount} updated.`
  );

  return {
    createdCount,
    updatedCount,
    total: createdCount + updatedCount
  };
};
