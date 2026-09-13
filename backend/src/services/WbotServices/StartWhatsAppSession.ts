import Whatsapp from "../../models/Whatsapp";
import { whatsappProvider } from "../../providers/WhatsApp";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp
): Promise<void> => {
  await whatsapp.update({ status: "OPENING" });

  const io = getIO();
  io.emit("whatsappSession", {
    action: "update",
    session: whatsapp
  });
  io.emit("whatsapp", {
    action: "update",
    whatsapp
  });

  try {
    await whatsappProvider.init(whatsapp);
  } catch (err) {
    logger.error(err);
    await whatsapp.update({ status: "DISCONNECTED" });
    io.emit("whatsappSession", {
      action: "update",
      session: whatsapp
    });
    io.emit("whatsapp", {
      action: "update",
      whatsapp
    });
  }
};
