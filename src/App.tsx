import React from 'react';
import './App.css';
import Whiteboard from './components/Whiteboard';

function App() {
  return (
    <div className="App">
      <h1>3D Content Generation Demo</h1>
      <div className="whiteboard-wrapper">
        <Whiteboard />
      </div>
    </div>
  );
}

export default App;
