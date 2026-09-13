import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import WppKey from "../../models/WppKey";

const DeleteWhatsAppService = async (id: string): Promise<void> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  try {
    await WppKey.destroy({ where: { connectionId: id } });
  } catch (err) {
    // Ignore if table or key cleanup fails
  }

  await whatsapp.destroy();
};

export default DeleteWhatsAppService;
