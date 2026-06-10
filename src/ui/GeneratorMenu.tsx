import { useState, useEffect, useSyncExternalStore } from 'react';
import { gameStore } from '../store';
import { generateTrackCurve } from '../utils/trackGenerator';
import { useMultiplayer } from '../hooks/useMultiplayer';
import type { CartesianCapabilities } from '../engine/CartesianPhysics';

export function GeneratorMenu() {
  const { broadcastTrack, broadcastParams, isConnected, socketId } = useMultiplayer();
  const [isOpen, setIsOpen] = useState(gameStore.getMenuOpen());
  const [currentMenu, setCurrentMenu] = useState<'main' | 'generator' | 'parameters' | 'players' | 'garage'>('main');
  
  const [segments, setSegments] = useState(15);
  const [generations, setGenerations] = useState(20);
  const [isClosed, setIsClosed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const carParams = useSyncExternalStore(gameStore.subscribe, gameStore.getCarParameters);
  const connectedPlayers = useSyncExternalStore(gameStore.subscribe, gameStore.getConnectedPlayers);
  const myName = useSyncExternalStore(gameStore.subscribe, gameStore.getPlayerName);
  const carAppearance = useSyncExternalStore(gameStore.subscribe, gameStore.getCarAppearance);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return gameStore.subscribe(() => {
      const open = gameStore.getMenuOpen();
      setIsOpen(open);
      if (!open) setCurrentMenu('main'); // reset menu when closed
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
          generations: generations,
          isClosed: isClosed
        });

        if (result.failureReason) {
          setErrorMsg(result.failureReason);
        } else {
          gameStore.setTrackData(result);
          if (result.dna) {
            broadcastTrack(result.dna);
          }
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
    broadcastParams({ ...carParams, [key]: value });
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
  
  const buttonStyle = {
    width: '400px',
    padding: '16px',
    background: '#1a1a1a',
    border: '1px solid #555',
    color: '#fff',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    marginBottom: '15px',
    fontSize: '16px',
    transition: 'all 0.2s'
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
      <h1 style={{ marginBottom: '40px', color: '#00e5ff', textShadow: '0 0 10px rgba(0, 229, 255, 0.5)' }}>Pause Menu</h1>
      
      {currentMenu === 'main' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button style={buttonStyle} onClick={() => setCurrentMenu('players')} onMouseOver={e => e.currentTarget.style.borderColor = '#00ffaa'} onMouseOut={e => e.currentTarget.style.borderColor = '#555'}>Players ({Object.keys(connectedPlayers).length + 1})</button>
          <button style={buttonStyle} onClick={() => setCurrentMenu('garage')} onMouseOver={e => e.currentTarget.style.borderColor = '#ffaa00'} onMouseOut={e => e.currentTarget.style.borderColor = '#555'}>Garage (Customize Car)</button>
          <button style={buttonStyle} onClick={() => setCurrentMenu('generator')} onMouseOver={e => e.currentTarget.style.borderColor = '#00e5ff'} onMouseOut={e => e.currentTarget.style.borderColor = '#555'}>Track Generator</button>
          <button style={buttonStyle} onClick={() => setCurrentMenu('parameters')} onMouseOver={e => e.currentTarget.style.borderColor = '#ff0055'} onMouseOut={e => e.currentTarget.style.borderColor = '#555'}>Car Parameters</button>
          <button style={{ ...buttonStyle, background: 'transparent', borderColor: '#888' }} onClick={() => gameStore.setMenuOpen(false)}>Resume Game</button>
        </div>
      )}

      {currentMenu === 'generator' && (
        <>
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

            <div style={{ marginBottom: '30px' }}>
              <label style={{ ...labelStyle, alignItems: 'center', cursor: 'pointer' }}>
                <span>Closed Loop Track</span>
                <input 
                  type="checkbox" 
                  checked={isClosed}
                  onChange={e => setIsClosed(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: '#00e5ff' }}
                />
              </label>
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
          <button style={{ ...buttonStyle, background: 'transparent' }} onClick={() => setCurrentMenu('main')}>Back</button>
        </>
      )}

      {currentMenu === 'parameters' && (
        <>
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
          <button style={{ ...buttonStyle, background: 'transparent' }} onClick={() => setCurrentMenu('main')}>Back</button>
        </>
      )}

      {currentMenu === 'players' && (
        <>
          <div style={{...cardStyle, boxShadow: '0 0 40px rgba(0, 255, 170, 0.1)'}}>
            <h2 style={{ margin: '0 0 20px 0', textAlign: 'center', color: '#00ffaa' }}>Connected Players</h2>
            
            <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '8px', fontSize: '12px', color: '#aaa', border: '1px solid #333' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Server:</span> <strong style={{ color: '#00e5ff' }}>trackval-obby.iamtakeo.partykit.dev</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Room ID:</span> <strong style={{ color: '#00e5ff' }}>trackval-global</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Status:</span> 
                {isConnected ? (
                  <strong style={{ color: '#00ffaa' }}>Connected</strong>
                ) : (
                  <strong style={{ color: '#ffaa00' }}>Connecting...</strong>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
              <div style={{ padding: '12px', background: 'rgba(0, 255, 170, 0.1)', border: '1px solid #00ffaa', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ color: '#00ffaa' }}>{myName} (You)</strong>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>Local</span>
              </div>
              
              {Object.values(connectedPlayers)
                .filter((p: any) => p.id !== socketId)
                .map((p: any) => (
                <div key={p.id} style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid #444', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{p.name || 'Ghost Driver'}</span>
                </div>
              ))}
              
              {Object.keys(connectedPlayers).length <= 1 && (
                <div style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>
                  No one else is here yet.
                </div>
              )}
            </div>
          </div>
          <button style={{ ...buttonStyle, background: 'transparent' }} onClick={() => setCurrentMenu('main')}>Back</button>
        </>
      )}

      {currentMenu === 'garage' && (
        <>
          <div style={{...cardStyle, boxShadow: '0 0 40px rgba(255, 170, 0, 0.1)'}}>
            <h2 style={{ margin: '0 0 20px 0', textAlign: 'center', color: '#ffaa00' }}>Garage</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}><span>Body Style</span></label>
              <select 
                value={carAppearance.bodyStyle}
                onChange={e => gameStore.setCarAppearance({ bodyStyle: e.target.value as any })}
                style={{ width: '100%', padding: '10px', background: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '16px' }}
              >
                <option value="speedster">Speedster (Sleek)</option>
                <option value="brute">Brute (Heavy)</option>
                <option value="interceptor">Interceptor (Sharp)</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}><span>Primary Color</span></label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="color" 
                  value={carAppearance.primaryColor}
                  onChange={e => gameStore.setCarAppearance({ primaryColor: e.target.value })}
                  style={{ width: '50px', height: '40px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                />
                <input 
                  type="text" 
                  value={carAppearance.primaryColor}
                  onChange={e => gameStore.setCarAppearance({ primaryColor: e.target.value })}
                  style={{ flex: 1, padding: '10px', background: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}><span>Thruster & Glow Color</span></label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="color" 
                  value={carAppearance.thrusterColor}
                  onChange={e => gameStore.setCarAppearance({ thrusterColor: e.target.value })}
                  style={{ width: '50px', height: '40px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                />
                <input 
                  type="text" 
                  value={carAppearance.thrusterColor}
                  onChange={e => gameStore.setCarAppearance({ thrusterColor: e.target.value })}
                  style={{ flex: 1, padding: '10px', background: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
                />
              </div>
            </div>
          </div>
          <button style={{ ...buttonStyle, background: 'transparent' }} onClick={() => setCurrentMenu('main')}>Back</button>
        </>
      )}

    </div>
  );
}
