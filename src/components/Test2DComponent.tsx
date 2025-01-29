import React, { useEffect, useRef } from 'react';

interface CanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

const Test2DComponent: React.FC<CanvasProps> = ({
  width = 800,
  height = 256,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    // Récupération du canvas
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) return;

    // Configuration du canvas pour une meilleure résolution sur les écrans haute densité
    const dpr: number = window.devicePixelRatio || 1;
    const rect: DOMRect = canvas.getBoundingClientRect();

    // Configuration de la taille du canvas
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Récupération du contexte
    const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!context) return;

    // Mise à l'échelle du contexte pour les écrans haute densité
    context.scale(dpr, dpr);
    contextRef.current = context;

    // Configuration initiale du contexte
    const setupContext = (ctx: CanvasRenderingContext2D): void => {
      // Exemple de dessin
      ctx.fillStyle = '#3498db';
      ctx.fillRect(10, 10, 100, 100);

      ctx.beginPath();
      ctx.arc(160, 60, 50, 0, Math.PI * 2);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();

      ctx.font = '20px Arial';
      ctx.fillStyle = '#2c3e50';
      ctx.fillText('Canvas 2D avec TypeScript', 250, 70);
    };

    setupContext(context);

    // Fonction de nettoyage
    return (): void => {
      if (contextRef.current && canvas) {
        contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, []);

  // Gestionnaire d'événements pour le clic (exemple)
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Dessiner un petit cercle à l'endroit du clic
    context.beginPath();
    context.arc(x, y, 5, 0, Math.PI * 2);
    context.fillStyle = '#27ae60';
    context.fill();
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Canvas 2D Demo TypeScript</h2>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className={`border border-gray-300 rounded ${className}`}
        style={{ 
          width: `${width}px`,
          height: `${height}px`
        }}
      />
    </div>
  );
};

export default Test2DComponent;