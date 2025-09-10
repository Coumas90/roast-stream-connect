import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Copy, 
  Mail, 
  MessageSquare, 
  Download, 
  QrCode,
  Link,
  Users,
  Send
} from "lucide-react";
import { Recipe } from "./RecipeCard";
import { useToast } from "@/hooks/use-toast";

interface ShareRecipeModalProps {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
}

export function ShareRecipeModal({ recipe, open, onClose }: ShareRecipeModalProps) {
  const { toast } = useToast();
  const [shareMethod, setShareMethod] = useState("link");
  const [emailList, setEmailList] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  if (!recipe) return null;

  const shareUrl = `${window.location.origin}/recipes/${recipe.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Enlace copiado",
        description: "El enlace de la receta se ha copiado al portapapeles",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar el enlace",
        variant: "destructive",
      });
    }
  };

  const handleEmailShare = async () => {
    setIsSharing(true);
    try {
      // Simulate email sharing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Receta compartida",
        description: `La receta se ha enviado por email a ${emailList.split(',').length} destinatarios`,
      });
      
      setEmailList("");
      setShareMessage("");
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar la receta por email",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleTeamShare = async () => {
    setIsSharing(true);
    try {
      // Simulate team sharing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Receta compartida",
        description: "La receta se ha compartido con tu equipo",
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo compartir la receta con el equipo",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  const defaultMessage = `¡Hola! Quiero compartir contigo esta receta de café: "${recipe.name}". Es un método ${recipe.method} que me ha dado excelentes resultados. ¡Espero que la disfrutes!`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Compartir Receta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipe Preview */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{recipe.name}</h3>
                <p className="text-sm text-muted-foreground">{recipe.method}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{recipe.type}</Badge>
                  <Badge variant="secondary">{recipe.status}</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Share Options */}
          <Tabs value={shareMethod} onValueChange={setShareMethod}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="link" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Enlace
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Equipo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="link" className="space-y-4">
              <div>
                <Label htmlFor="share-url">Enlace de la receta</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="share-url"
                    value={shareUrl}
                    readOnly
                    className="flex-1"
                  />
                  <Button onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Cualquier persona con este enlace podrá ver la receta
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Descargar QR
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="email" className="space-y-4">
              <div>
                <Label htmlFor="email-list">Direcciones de email</Label>
                <Input
                  id="email-list"
                  placeholder="ejemplo@email.com, otro@email.com..."
                  value={emailList}
                  onChange={(e) => setEmailList(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Separa múltiples emails con comas
                </p>
              </div>

              <div>
                <Label htmlFor="share-message">Mensaje personalizado</Label>
                <Textarea
                  id="share-message"
                  placeholder="Escribe un mensaje personal..."
                  value={shareMessage || defaultMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>

              <Button 
                onClick={handleEmailShare} 
                disabled={!emailList.trim() || isSharing}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSharing ? "Enviando..." : "Enviar por Email"}
              </Button>
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Compartir con el Equipo</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Esta receta se agregará a las recetas del equipo y estará disponible 
                  para todos los miembros de tu organización.
                </p>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Equipo actual:</span>
                    <span className="font-medium">TUPÁ Baristas</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Miembros:</span>
                    <span className="font-medium">12 personas</span>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="team-message">Nota para el equipo (opcional)</Label>
                <Textarea
                  id="team-message"
                  placeholder="Añade una nota para el equipo sobre esta receta..."
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  rows={3}
                  className="mt-2"
                />
              </div>

              <Button 
                onClick={handleTeamShare} 
                disabled={isSharing}
                className="w-full"
              >
                <Users className="h-4 w-4 mr-2" />
                {isSharing ? "Compartiendo..." : "Compartir con el Equipo"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}