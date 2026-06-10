import { useState, useEffect } from 'react';
import { gameStore } from '../store';
import { generateTrackCurve } from '../utils/trackGenerator';

export function GeneratorMenu() {
  const [isOpen, setIsOpen] = useState(gameStore.getMenuOpen());
  
  const [segments, setSegments] = useState(15);
  const [generations, setGenerations] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    return gameStore.subscribe(() => {
      setIsOpen(gameStore.getMenuOpen());
    });
  }, []);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg('');
    
    // Slight timeout to let UI update to "Generating..."
    setTimeout(() => {
      try {
        const result = generateTrackCurve({
          segmentsPerTrack: segments,
          generations: generations
        });

        if (result.failureReason) {
          setErrorMsg(result.failureReason);
        } else {
          // Success!
          gameStore.setTrackData(result);
          gameStore.setMenuOpen(false); // Close menu
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Unknown error during generation.');
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: 'Inter, sans-serif',
      color: '#fff',
      pointerEvents: 'auto'
    }}>
      <div style={{
        background: '#1a1a1a',
        padding: '30px',
        borderRadius: '16px',
        width: '400px',
        boxShadow: '0 0 40px rgba(0, 229, 255, 0.2)',
        border: '1px solid #333'
      }}>
        <h2 style={{ margin: '0 0 20px 0', textAlign: 'center', color: '#00e5ff' }}>Track Generator</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Track Length (Segments)</span>
            <span style={{ color: '#00e5ff' }}>{segments}</span>
          </label>
          <input 
            type="range" 
            min="5" 
            max="50" 
            value={segments} 
            onChange={e => setSegments(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Evolution Generations</span>
            <span style={{ color: '#00e5ff' }}>{generations}</span>
          </label>
          <input 
            type="range" 
            min="5" 
            max="100" 
            value={generations} 
            onChange={e => setGenerations(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>Higher = Smoother / more optimized</small>
        </div>

        {errorMsg && (
          <div style={{ 
            background: 'rgba(255, 50, 50, 0.1)', 
            border: '1px solid #ff3232', 
            padding: '10px', 
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#ffaaaa'
          }}>
            <strong>Validation Failed:</strong> {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => gameStore.setMenuOpen(false)}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: '1px solid #555',
              color: '#fff',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Cancel
          </button>
          
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              flex: 2,
              padding: '12px',
              background: isGenerating ? '#333' : '#00e5ff',
              border: 'none',
              color: isGenerating ? '#888' : '#000',
              borderRadius: '8px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              transition: 'background 0.2s'
            }}
          >
            {isGenerating ? 'Generating & Validating...' : 'Generate New Track'}
          </button>
        </div>
      </div>
    </div>
  );
}
