import React, { useState } from 'react';
import './App.css';
import Whiteboard from './components/Whiteboard';
import PromptGenerator from './components/PromptGenerator/PromptGenerator';

function App() {
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);

  // 根据URL参数决定显示哪个页面
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page');
    if (page === 'prompt-generator') {
      setShowPromptGenerator(true);
    }
  }, []);

  // 更新URL而不刷新页面
  const switchToPromptGenerator = () => {
    setShowPromptGenerator(true);
    const url = new URL(window.location.href);
    url.searchParams.set('page', 'prompt-generator');
    window.history.pushState({}, '', url.toString());
  };

  const switchToWhiteboard = () => {
    setShowPromptGenerator(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    window.history.pushState({}, '', url.toString());
  };

  if (showPromptGenerator) {
    return <PromptGenerator />;
  }

  return (
    <div className="App">
      <div className="journal-header">
        ✨ 我的创意手账 ✨
        <div className="page-switcher">
          <button 
            className={`switch-button ${!showPromptGenerator ? 'active' : ''}`}
            onClick={switchToWhiteboard}
          >
            🎨 创意白板
          </button>
          <button 
            className={`switch-button ${showPromptGenerator ? 'active' : ''}`}
            onClick={switchToPromptGenerator}
          >
            🤖 AI生图器
          </button>
        </div>
      </div>
      
      <div className="journal-container">
        <div className="journal-decoration top-left">🌸</div>
        <div className="journal-decoration bottom-right">🍃</div>
        
        <Whiteboard />
      </div>
    </div>
  );
}

export default App;
