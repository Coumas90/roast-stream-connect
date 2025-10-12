import html2canvas from "html2canvas";

export async function exportRecipeAsImage(
  recipeName: string,
  recipeElement: HTMLElement
): Promise<void> {
  try {
    const canvas = await html2canvas(recipeElement, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      useCORS: true,
    });

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${recipeName.replace(/\s+/g, "_")}_receta.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error("Error al exportar imagen:", error);
    throw error;
  }
}
