import { MessageCircle } from "lucide-react";

const WhatsAppWidget = () => {
  const phoneNumber = "5491125145969"; // +54 9 11 2514-5969 formatted for WhatsApp
  const message = encodeURIComponent("¡Hola! Me interesa conocer más sobre TUPÁ Hub");
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl animate-pulse-soft"
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle size={28} fill="currentColor" />
    </a>
  );
};

export default WhatsAppWidget;