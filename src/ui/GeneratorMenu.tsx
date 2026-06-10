import { useState, useEffect, useSyncExternalStore } from 'react';
import { gameStore } from '../store';
import { generateTrackCurve } from '../utils/trackGenerator';
import type { CartesianCapabilities } from '../engine/CartesianPhysics';

export function GeneratorMenu() {
  const [isOpen, setIsOpen] = useState(gameStore.getMenuOpen());
  
  const [segments, setSegments] = useState(15);
  const [generations, setGenerations] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const carParams = useSyncExternalStore(gameStore.subscribe, gameStore.getCarParameters);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return gameStore.subscribe(() => {
      setIsOpen(gameStore.getMenuOpen());
    });
  }, []);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg('');
    
    setTimeout(() => {
      try {
        const result = generateTrackCurve({
          segmentsPerTrack: segments,
          generations: generations
        });

        if (result.failureReason) {
          setErrorMsg(result.failureReason);
        } else {
          gameStore.setTrackData(result);
          gameStore.setMenuOpen(false);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Unknown error during generation.');
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  const updateCarParam = (key: keyof CartesianCapabilities, value: number) => {
    gameStore.setCarParameters({ [key]: value });
  };

  const handleCopyParams = () => {
    navigator.clipboard.writeText(JSON.stringify(carParams, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cardStyle = {
    background: '#1a1a1a',
    padding: '24px',
    borderRadius: '16px',
    width: '400px',
    boxShadow: '0 0 40px rgba(0, 229, 255, 0.1)',
    border: '1px solid #333',
    marginBottom: '20px'
  };

  const labelStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: 'Inter, sans-serif',
      color: '#fff',
      pointerEvents: 'auto',
      overflowY: 'auto',
      padding: '40px 0'
    }}>
      
      {/* Track Generator Card */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 20px 0', textAlign: 'center', color: '#00e5ff' }}>Track Generator</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>
            <span>Track Length (Segments)</span>
            <span style={{ color: '#00e5ff' }}>{segments}</span>
          </label>
          <input 
            type="range" min="5" max="50" value={segments} 
            onChange={e => setSegments(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={labelStyle}>
            <span>Evolution Generations</span>
            <span style={{ color: '#00e5ff' }}>{generations}</span>
          </label>
          <input 
            type="range" min="5" max="100" value={generations} 
            onChange={e => setGenerations(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {errorMsg && (
          <div style={{ 
            background: 'rgba(255, 50, 50, 0.1)', border: '1px solid #ff3232', 
            padding: '10px', borderRadius: '8px', marginBottom: '20px',
            fontSize: '14px', color: '#ffaaaa'
          }}>
            <strong>Validation Failed:</strong> {errorMsg}
          </div>
        )}

        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{
            width: '100%', padding: '12px', background: isGenerating ? '#333' : '#00e5ff',
            border: 'none', color: isGenerating ? '#888' : '#000', borderRadius: '8px',
            cursor: isGenerating ? 'not-allowed' : 'pointer', fontWeight: 'bold',
            transition: 'background 0.2s'
          }}
        >
          {isGenerating ? 'Generating & Validating...' : 'Generate New Track'}
        </button>
      </div>

      {/* Car Parameters Card */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 20px 0', textAlign: 'center', color: '#ff0055' }}>Car Parameters</h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}><span>Max Acceleration</span><span style={{ color: '#ff0055' }}>{carParams.maxAcceleration} m/s²</span></label>
          <input type="range" min="10" max="200" step="5" value={carParams.maxAcceleration} onChange={e => updateCarParam('maxAcceleration', parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}><span>Max Braking</span><span style={{ color: '#ff0055' }}>{carParams.maxBraking} m/s²</span></label>
          <input type="range" min="10" max="200" step="5" value={carParams.maxBraking} onChange={e => updateCarParam('maxBraking', parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}><span>Max Velocity</span><span style={{ color: '#ff0055' }}>{carParams.maxVelocity} m/s</span></label>
          <input type="range" min="50" max="500" step="10" value={carParams.maxVelocity} onChange={e => updateCarParam('maxVelocity', parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}><span>Steering Sensitivity</span><span style={{ color: '#ff0055' }}>{carParams.steeringSensitivity.toFixed(3)}</span></label>
          <input type="range" min="0.005" max="0.05" step="0.001" value={carParams.steeringSensitivity} onChange={e => updateCarParam('steeringSensitivity', parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}><span>Gravity</span><span style={{ color: '#ff0055' }}>{carParams.gravity} m/s²</span></label>
          <input type="range" min="10" max="150" step="5" value={carParams.gravity} onChange={e => updateCarParam('gravity', parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>

        <button 
          onClick={handleCopyParams}
          style={{
            width: '100%', padding: '12px', background: 'transparent',
            border: '1px solid #ff0055', color: '#ff0055', borderRadius: '8px',
            cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s'
          }}
        >
          {copied ? 'Copied!' : 'Copy Parameters to Clipboard'}
        </button>
      </div>
      
      {/* Close Menu Button */}
      <button 
        onClick={() => gameStore.setMenuOpen(false)}
        style={{
          width: '450px', padding: '16px', background: 'transparent',
          border: '1px solid #555', color: '#fff', borderRadius: '8px',
          cursor: 'pointer', fontWeight: 'bold'
        }}
      >
        Resume Game
      </button>

    </div>
  );
}
