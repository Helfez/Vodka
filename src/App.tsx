import React from 'react';
import './App.css';
import Whiteboard from './components/Whiteboard';

function App() {
  return (
    <div className="App">
      <div className="journal-header">
        ✨ 我的创意手账 ✨
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
