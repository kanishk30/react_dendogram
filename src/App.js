import React, { Component } from "react";
import "./App.css";
import DendoGram from "./components/DendoGram";
import DATA from "./model.js";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      width: 1000,
      height: 800
    };
  }
  render() {
    const { width, height } = this.state;
    return (
      <div className="App">
        <DendoGram data={DATA} width={width} height={height} />
      </div>
    );
  }
}

export default App;
