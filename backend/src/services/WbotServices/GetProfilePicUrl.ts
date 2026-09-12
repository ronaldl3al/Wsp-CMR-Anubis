import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { whatsappProvider } from "../../providers/WhatsApp";

const GetProfilePicUrl = async (number: string): Promise<string> => {
  const defaultWhatsapp = await GetDefaultWhatsApp();

  try {
    const profilePicUrl = await whatsappProvider.getProfilePicUrl(
      defaultWhatsapp.id,
      number
    );
    return profilePicUrl;
  } catch (error) {
    return "";
  }
};

export default GetProfilePicUrl;
