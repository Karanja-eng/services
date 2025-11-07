import React, { useState, useEffect, useRef} from 'react'
import paper from 'paper'
import axios from 'axios'

const DrawColumn = ({result}) => {
    
    const canvasRef = useRef(null)    
    const [dimensions, setDimensions] = useState({
        beamWidth: 300,
        beamHeight: 300,
        topBars: result,
        bottomBars: 4,    // number of bars along the bottom edge (max 8)
        barRadius: 8,
        cover:30,
    })
    
        

   
   
    const drawBars = (xStart, effectiveWidth, baseY, barRadius, totalBars) => {
        if (totalBars <= 0) return;
        const rows = totalBars > 4 ? 2 : 1;
        
    
        // For two rows, split the bars:
        const firstRowCount = rows === 2 ? Math.ceil(totalBars / 2) : totalBars;
        
    
        // Draw first row.
        for (let i = 0; i < firstRowCount; i++) {
          const spacing = firstRowCount > 1 ? (effectiveWidth - 2 * barRadius) / (firstRowCount - 1) : 0;
          const x = xStart + barRadius + i * spacing;
          // For a top side, the row is drawn from the top edge downward; for bottom, it’s drawn upward.
          const y = baseY;
          new paper.Path.Circle({
            center: [x, y],
            radius: barRadius,
            strokeColor: 'black'
          });
        }}
    
    useEffect(() => {
        paper.setup(canvasRef.current)
        paper.project.activeLayer.removeChildren()

        const startX = 100;
        const startY = 100;

    
        const { beamWidth, beamHeight, cover, topBars, bottomBars, barRadius } = dimensions;
        // Draw the outer rectangle.
        new paper.Path.Rectangle({
          point: [startX, startY],
          size: [beamWidth, beamHeight],
          strokeColor: 'black',
          strokeWidth: 2,
        });
        // Draw an inner dashed rectangle (cover).
        new paper.Path.Rectangle({
          point: [startX + cover, startY + cover],
          size: [beamWidth - 2 * cover, beamHeight - 2 * cover],
          strokeColor: 'black',
          strokeWidth: 2,
        });
  
        // Reinforcement bars:
        // Top bars along the top edge.
        const topEffectiveWidth = beamWidth - 2 * cover;
        const topXStart = startX + cover;
        const topY = startY + cover + barRadius;
        drawBars(topXStart, topEffectiveWidth, topY, barRadius, topBars, true);
  
        // Bottom bars along the bottom edge.
        const bottomEffectiveWidth = beamWidth - 2 * cover;
        const bottomXStart = startX + cover;
        const bottomY = startY + beamHeight - cover - barRadius;
        drawBars(bottomXStart, bottomEffectiveWidth, bottomY, barRadius, bottomBars, false);
  
    
    paper.view.draw();
    }, [dimensions]);
    const handleDimensionChange = (e) => {
        const { name, value } = e.target;
        setDimensions(prev => ({
          ...prev,
          [name]: parseFloat(value)
        }));
      };
    return(
        
        <>
                        <div>
                          <h1 className='bg-slate-500 font-semibold font-mono border-b-2'>CAD Drawing</h1>
                         
                          <canvas
                            ref={canvasRef}
                            width={600}
                            height={500}
                            className='bg-slate-400'
                          />
                          </div>
                          </>
                          
                       
    )

}


export default DrawColumn