import whatsappLogo from "@/assets/whatsapp-logo.png";

const WhatsAppWidget = () => {
  const phoneNumber = "5491125145969"; // +54 9 11 2514-5969 formatted for WhatsApp
  const message = encodeURIComponent("¡Hola! Me interesa conocer más sobre TUPÁ Hub");
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 left-6 z-50 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl animate-pulse-soft"
      aria-label="Contactar por WhatsApp"
    >
      <img 
        src={whatsappLogo} 
        alt="WhatsApp" 
        className="h-12 w-12 object-contain"
      />
    </a>
  );
};

export default WhatsAppWidget;