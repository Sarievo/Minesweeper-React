import React from 'react';
import bomb from './assets/bomb.svg'
import './App.css';

const faces = ['🙂', '🤩', '😕', '🥳'];

class Game extends React.Component {
  constructor(props) {
    super(props);
    this.mines = 10;
    this.state = {
      flags: this.mines,
      time: 0, timerOn: false,
      isGameLocked: false,
      status: 0,
      shouldReset: false
    }
    this.initTimer = this.initTimer.bind(this);
    this.stopTimer = this.stopTimer.bind(this);
    this.lockGame = this.lockGame.bind(this);
    this.addFlag = this.addFlag.bind(this);
    this.rmvFlag = this.rmvFlag.bind(this);
    this.changeStatus = this.changeStatus.bind(this);
    this.reset = this.reset.bind(this);
  }

  reset() {
    this.stopTimer();
    this.setState({
      flags: this.mines,
      time: 0, timerOn: false,
      isGameLocked: false,
      status: 0,
      shouldReset: false
    })
  }

  initTimer() {
    if (!this.state.timerOn) {
      this.setState({
        timerOn: true,
        status: 1
      });
      this.timerID = setInterval(() => this.tick(), 1000);
    }
  }

  stopTimer() {
    clearInterval(this.timerID);
  }

  tick() {
    this.setState((prev) => ({
      time: prev.time + 1
    }));
  }

  formatSeconds() {
    const time = this.state.time;
    const minutes = time > 59 ? Math.floor(time / 60) : 0;
    const seconds = time % 60;
    return seconds < 10 ? `${minutes}:0${seconds}` : `${minutes}:${seconds}`;
  }

  lockGame() {
    this.setState({isGameLocked: true});
  }

  addFlag() {
    this.setState(prev => ({flags: prev.flags + 1}));
  }

  rmvFlag() {
    this.setState(prev => ({flags: prev.flags - 1}));
  }

  changeStatus(num) {
    this.setState({status: num});
  }

  render() {
    return (
        <main>
          <h1>Minesweeper <img src={bomb} className="App-logo" alt="bomb"/></h1>
          <section className={"control-panel"}>
            <div id={"flag-counter"}>💣{this.state.flags}</div>
            <div id={"reset-btn"} onClick={() => this.setState({shouldReset: true})}>{
              faces[this.state.status]
            }</div>
            <div id={"timer"}>{this.formatSeconds()}</div>
          </section>
          <Field r={9} c={8} mines={this.mines} changeStatus={this.changeStatus}
                 initTimer={this.initTimer} stopTimer={this.stopTimer} timerOn={this.state.timerOn}
                 lockGame={this.lockGame} isGameLocked={this.state.isGameLocked}
                 shouldReset={this.state.shouldReset} reset={this.reset}
                 flags={this.state.flags} addFlag={this.addFlag} rmvFlag={this.rmvFlag}/>
        </main>
    );
  }
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex--);
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

class Cell extends React.Component {
  constructor(props) {
    super(props);
    this.handleLClick = this.handleLClick.bind(this);
    this.handleRClick = this.handleRClick.bind(this);
  }

  handleLClick() {
    this.props.onCellLClick(this.props.rowID, this.props.colID);
  }

  handleRClick(e) {
    this.props.onCellRClick(e, this.props.rowID, this.props.colID);
  }

  render() {
    const status = this.props.getCellStatus(this.props.rowID, this.props.colID);
    return (
        <div className={`cell ${status}`} onClick={this.handleLClick}
             onContextMenu={this.handleRClick}>{
          this.props.info
        }</div>
    );
  }
}

class Field extends React.Component {
  constructor(props) {
    super(props);
    this.r = props.r;
    this.c = props.c;

    this.getCellStatus = this.getCellStatus.bind(this);
    this.onCellLClick = this.onCellLClick.bind(this);
    this.onCellRClick = this.onCellRClick.bind(this);
    this.helper = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

    this.rows = new Array(this.r);
    for (let i = 0; i < this.r; i++) this.rows[i] = i;

    this.cols = new Array(this.c);
    for (let i = 0; i < this.c; i++) this.cols[i] = i;

    this.state = {
      field: this.genField(),
      started: false,
      openedCell: 0,
      shouldReset: false
    };
  }

  reset() {
    this.setState({
      field: this.genField(),
      started: false,
      openedCell: 0,
      shouldReset: false
    });
  }

  genField() {
    // gen matrix with vanilla status
    let rands = new Array(this.r * this.c);
    for (let i = 0; i < this.r * this.c; i++) rands[i] = [i];
    shuffle(rands)
    let set = new Set();
    for (let i = 0; i < this.props.mines; i++) set.add(rands[i][0]);
    // console.log(set);

    const field = new Array(this.r);
    for (let i of this.rows) {
      field[i] = new Array(this.c);
      for (let j of this.cols) {
        field[i][j] = {
          // store vanilla status
          isFlag: false,
          isOpen: false,
          isMine: set.has(i * 8 + j),
          surMines: set.has(i * 8 + j) ? 99 : 0
        }
      }
    }
    return field;
  }

  getCellStatus(r, c) {
    let value = this.state.field[r][c];
    if (value.isFlag) return "flagged";
    if (!value.isOpen) return "closed";
    if (value.isMine) return "fired";
    else return "opened";
    // return "opened";
  }

  onCellLClick(r, c) {
    if (this.props.isGameLocked) return;
    // ref: https://stackoverflow.com/questions/29537299/react-how-to-update-state-item1-in-state-using-setstate
    let field = this.state.field;
    if (field[r][c].isOpen || field[r][c].isFlag) return;
    if (!this.state.started) {
      while (field[r][c].isMine) {
        field = this.genField(); // re-gen the field if the first step is mine
      }
      this.setState({
        field: field,
        started: true
      })
      this.props.initTimer();
    }
    this.dfs(field, r, c);
    if (field[r][c].isMine) {
      this.props.changeStatus(2);
      this.props.stopTimer();
      for (let i = 0; i < this.r; i++) {
        for (let j = 0; j < this.c; j++) {
          if (field[i][j].isMine) field[i][j].isOpen = true;
        }
      }
      this.setState(field);
      this.props.lockGame();
    }
    if (this.state.openedCell === 62 && this.props.flags === 0) this.victory();
    // console.log(`Opened Cells: ${this.state.openedCell}`);
  }

  dfs(field, r, c) {
    field[r][c].isOpen = !field[r][c].isFlag;
    this.setState(prev => ({openedCell: 1 + prev.openedCell}));

    for (let code of this.helper) {
      const newR = r + code[0];
      const newC = c + code[1];
      if (!(newR >= 0 && newC >= 0 && newR < this.r && newC < this.c)
          || field[newR][newC].isOpen)
        continue;
      if (field[newR][newC].isMine) field[r][c].surMines++;
    }
    this.setState({field: field})

    if (field[r][c].surMines === 0) {
      for (let code of this.helper) {
        const newR = r + code[0];
        const newC = c + code[1];
        if (!(newR >= 0 && newC >= 0 && newR < this.r && newC < this.c)
            || field[newR][newC].isOpen)
          continue;
        this.dfs(field, newR, newC);
      }
    }
  }

  onCellRClick(e, r, c) {
    if (this.props.isGameLocked) return;
    e.preventDefault();
    let field = this.state.field;
    let isOpen = field[r][c].isOpen;
    if (isOpen) return;

    let isFlag = field[r][c].isFlag;
    let canSet = !isFlag && this.props.flags > 0;
    if (isFlag) this.props.addFlag();
    if (canSet) this.props.rmvFlag();
    field[r][c].isFlag = canSet;
    this.setState({field: field});
    if (this.state.openedCell === 62 && this.props.flags === 0) this.victory();
    // console.log(`Opened Cells: ${this.state.openedCell}`);
  }

  victory() {
    this.props.changeStatus(3);
    this.props.lockGame();
  }

  render() {
    if (this.props.shouldReset) {
      this.reset();
      this.props.reset(); // ???
    }
    // matrix with interpreted status
    const field = this.state.field;
    // for (let i of field) console.log(i);
    const display = this.rows.map((r) => (
        <div className={"row"} key={r}>{this.cols.map((c) => (
            <Cell key={c} rowID={r} colID={c} getCellStatus={this.getCellStatus}
                  onCellLClick={this.onCellLClick} onCellRClick={this.onCellRClick}
                // info={field[r][c].isMine ? "M" : "E"}/> // debug
                  info={(field[r][c].surMines > 0 && field[r][c].surMines < 99) && field[r][c].surMines}/>
        ))}
        </div>
    ));

    return (
        <section className={"field"}>
          <div>{display}</div>
        </section>
    );
  }
}

function App() {
  return (
      <div className="App">
        <header>
          <title>Minesweeper</title>
          <meta charSet={"UTF-8"} lang={"EN"}/>
        </header>
        <div className="App-header">
          <Game/>
        </div>
      </div>
  );
}

export default App;