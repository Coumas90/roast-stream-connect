import { Recipe } from "@/components/recipes/RecipeCard";

// Simple PDF generation utility
// In a real app, you'd use libraries like jsPDF, Puppeteer, or PDFKit
export class RecipePDFGenerator {
  static async generateRecipePDF(recipe: Recipe): Promise<void> {
    // Create a formatted HTML version of the recipe
    const htmlContent = this.generateRecipeHTML(recipe);
    
    // Open in a new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Wait for content to load then trigger print dialog
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    }
  }

  private static generateRecipeHTML(recipe: Recipe): string {
    const isActive = recipe.isActive ?? recipe.is_active ?? false;
    
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receta: ${recipe.name}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
          }
          
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #8B4513;
            padding-bottom: 20px;
          }
          
          .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            color: #8B4513;
          }
          
          .header .subtitle {
            font-size: 1.2em;
            color: #666;
            margin-bottom: 10px;
          }
          
          .badges {
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
          }
          
          .badge {
            background: #f0f0f0;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            color: #666;
            border: 1px solid #ddd;
          }
          
          .badge.active {
            background: #d4edda;
            color: #155724;
            border-color: #c3e6cb;
          }
          
          .badge.method {
            background: #fff3cd;
            color: #856404;
            border-color: #ffeaa7;
          }
          
          .section {
            margin-bottom: 30px;
            break-inside: avoid;
          }
          
          .section-title {
            font-size: 1.4em;
            margin-bottom: 15px;
            color: #8B4513;
            border-left: 4px solid #8B4513;
            padding-left: 12px;
          }
          
          .parameters-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
          }
          
          .parameter {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
          }
          
          .parameter-label {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 5px;
          }
          
          .parameter-value {
            font-size: 1.1em;
            font-weight: 600;
            color: #333;
          }
          
          .steps {
            counter-reset: step-counter;
          }
          
          .step {
            counter-increment: step-counter;
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            position: relative;
            padding-left: 60px;
          }
          
          .step::before {
            content: counter(step-counter);
            position: absolute;
            left: 15px;
            top: 15px;
            width: 30px;
            height: 30px;
            background: #8B4513;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 0.9em;
          }
          
          .step-title {
            font-weight: 600;
            margin-bottom: 8px;
            color: #333;
          }
          
          .step-description {
            color: #666;
            margin-bottom: 10px;
          }
          
          .step-meta {
            display: flex;
            gap: 15px;
            font-size: 0.9em;
            color: #888;
          }
          
          .notes {
            background: #fff3cd;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #ffc107;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #666;
            font-size: 0.9em;
          }
          
          @media print {
            body {
              padding: 0;
            }
            
            .header {
              margin-bottom: 30px;
            }
            
            .section {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${recipe.name}</h1>
          <div class="subtitle">Receta de Café ${recipe.method || ''}</div>
          <div class="badges">
            <span class="badge method">${recipe.method || 'Sin método'}</span>
            <span class="badge">${recipe.type || 'Personal'}</span>
            <span class="badge">${recipe.status || 'Draft'}</span>
            ${isActive ? '<span class="badge active">Activa</span>' : ''}
          </div>
        </div>

        ${recipe.description ? `
        <div class="section">
          <h2 class="section-title">Descripción</h2>
          <p>${recipe.description}</p>
        </div>
        ` : ''}

        <div class="section">
          <h2 class="section-title">Parámetros de Preparación</h2>
          <div class="parameters-grid">
            ${recipe.ratio ? `
            <div class="parameter">
              <div class="parameter-label">Ratio</div>
              <div class="parameter-value">${recipe.ratio}</div>
            </div>
            ` : ''}
            
            ${recipe.coffee ? `
            <div class="parameter">
              <div class="parameter-label">Café</div>
              <div class="parameter-value">${recipe.coffee}</div>
            </div>
            ` : ''}
            
            ${recipe.time ? `
            <div class="parameter">
              <div class="parameter-label">Tiempo</div>
              <div class="parameter-value">${recipe.time}</div>
            </div>
            ` : ''}
            
            ${recipe.temperature ? `
            <div class="parameter">
              <div class="parameter-label">Temperatura</div>
              <div class="parameter-value">${recipe.temperature}</div>
            </div>
            ` : ''}
            
            ${recipe.grind ? `
            <div class="parameter">
              <div class="parameter-label">Molienda</div>
              <div class="parameter-value">${recipe.grind}</div>
            </div>
            ` : ''}
          </div>
        </div>

        ${recipe.steps && recipe.steps.length > 0 ? `
        <div class="section">
          <h2 class="section-title">Pasos de Preparación</h2>
          <div class="steps">
            ${recipe.steps.map(step => `
            <div class="step">
              <div class="step-title">${step.title}</div>
              <div class="step-description">${step.description}</div>
              ${step.time || step.water ? `
              <div class="step-meta">
                ${step.time ? `<span>⏱️ ${step.time} min</span>` : ''}
                ${step.water ? `<span>☕ ${step.water} ml</span>` : ''}
              </div>
              ` : ''}
            </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        ${recipe.notes ? `
        <div class="section">
          <h2 class="section-title">Notas</h2>
          <div class="notes">
            ${recipe.notes}
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <p>Generado desde TUPÁ Hub - ${new Date().toLocaleDateString('es-ES')}</p>
          <p>Receta creada: ${new Date(recipe.created_at || '').toLocaleDateString('es-ES')}</p>
        </div>
      </body>
      </html>
    `;
  }

  // Alternative method for generating downloadable PDF blob
  static async generatePDFBlob(recipe: Recipe): Promise<Blob> {
    // This would be implemented with a proper PDF library
    // For now, we'll create a simple text version
    const content = this.generateTextVersion(recipe);
    return new Blob([content], { type: 'text/plain' });
  }

  private static generateTextVersion(recipe: Recipe): string {
    const isActive = recipe.isActive ?? recipe.is_active ?? false;
    
    return `
RECETA: ${recipe.name.toUpperCase()}
${'='.repeat(50)}

Método: ${recipe.method || 'No especificado'}
Tipo: ${recipe.type || 'Personal'}
Estado: ${recipe.status || 'Borrador'}${isActive ? ' (ACTIVA)' : ''}

${recipe.description ? `DESCRIPCIÓN:
${recipe.description}

` : ''}PARÁMETROS:
${'-'.repeat(20)}
${recipe.ratio ? `Ratio: ${recipe.ratio}` : ''}
${recipe.coffee ? `Café: ${recipe.coffee}` : ''}
${recipe.time ? `Tiempo: ${recipe.time}` : ''}
${recipe.temperature ? `Temperatura: ${recipe.temperature}` : ''}
${recipe.grind ? `Molienda: ${recipe.grind}` : ''}

${recipe.steps && recipe.steps.length > 0 ? `PASOS DE PREPARACIÓN:
${'-'.repeat(30)}
${recipe.steps.map((step, index) => `
${index + 1}. ${step.title}
   ${step.description}${step.time ? `
   Tiempo: ${step.time} min` : ''}${step.water ? `
   Agua: ${step.water} ml` : ''}
`).join('')}` : ''}

${recipe.notes ? `NOTAS:
${'-'.repeat(10)}
${recipe.notes}

` : ''}Generado desde TUPÁ Hub - ${new Date().toLocaleDateString('es-ES')}
Receta creada: ${new Date(recipe.created_at || '').toLocaleDateString('es-ES')}
    `.trim();
  }
}