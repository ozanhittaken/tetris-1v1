// ==================== CONSTANTS ====================
const COLS = 10, ROWS = 20;
const PIECE_TYPES = ['I','O','T','S','Z','J','L'];

const COLORS = {
  I:'#00f5ff', O:'#ffd700', T:'#bf00ff', S:'#00ff41',
  Z:'#ff0040', J:'#0080ff', L:'#ff8c00', G:'#555555'
};

const SHAPES = {
  I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O:[[1,1],[1,1]],
  T:[[0,1,0],[1,1,1],[0,0,0]],
  S:[[0,1,1],[1,1,0],[0,0,0]],
  Z:[[1,1,0],[0,1,1],[0,0,0]],
  J:[[1,0,0],[1,1,1],[0,0,0]],
  L:[[0,0,1],[1,1,1],[0,0,0]]
};

const JLTSZ_KICKS = {
  '0>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '1>0':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '1>2':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '2>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '2>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '3>2':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '3>0':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '0>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]]
};
const I_KICKS = {
  '0>1':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  '1>0':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  '1>2':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  '2>1':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '2>3':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  '3>2':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  '3>0':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '0>3':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
};

const SCORE_TABLE = [0, 100, 300, 500, 800];
const GARBAGE_TABLE = [0, 0, 1, 2, 4];

// ==================== UTILITIES ====================
function rotateCW(matrix) {
  const n = matrix.length;
  const r = Array.from({length:n}, ()=> Array(n).fill(0));
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) r[x][n-1-y] = matrix[y][x];
  return r;
}
function rotateCCW(matrix) {
  const n = matrix.length;
  const r = Array.from({length:n}, ()=> Array(n).fill(0));
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) r[n-1-x][y] = matrix[y][x];
  return r;
}
function shuffleArray(arr) {
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function lighten(hex, amt=40) {
  let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  r=Math.min(255,r+amt); g=Math.min(255,g+amt); b=Math.min(255,b+amt);
  return `rgb(${r},${g},${b})`;
}
function darken(hex, amt=40) {
  let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  r=Math.max(0,r-amt); g=Math.max(0,g-amt); b=Math.max(0,b-amt);
  return `rgb(${r},${g},${b})`;
}

// ==================== TETRIS ENGINE ====================
class TetrisEngine {
  constructor() { this.reset(); }

  reset() {
    this.board = Array.from({length:ROWS}, ()=> Array(COLS).fill(null));
    this.score = 0; this.lines = 0; this.level = 1;
    this.gameOver = false;
    this.bag = []; this.nextType = null;
    this.current = null; // {type, shape, rotation, x, y}
    this.dropTimer = 0;
    this.lockTimer = 0; this.lockResets = 0; this.locking = false;
    this.pendingGarbage = 0;
    this.linesClearedThisTurn = 0;
    this.clearingLines = []; this.clearTimer = 0;
    this._fillBag();
    this.nextType = this._pullFromBag();
    this._spawnPiece();
  }

  _fillBag() {
    if(this.bag.length <= 1) {
      this.bag = this.bag.concat(shuffleArray(PIECE_TYPES));
    }
  }
  _pullFromBag() {
    this._fillBag();
    return this.bag.shift();
  }

  _spawnPiece() {
    const type = this.nextType;
    this.nextType = this._pullFromBag();
    const shape = SHAPES[type].map(r=>[...r]);
    const x = Math.floor((COLS - shape[0].length) / 2);
    const y = type === 'I' ? -1 : 0;
    this.current = {type, shape, rotation:0, x, y};
    this.locking = false; this.lockTimer = 0; this.lockResets = 0;
    if(!this._canPlace(shape, x, y)) {
      this.gameOver = true;
    }
  }

  _canPlace(shape, px, py) {
    for(let y=0;y<shape.length;y++) {
      for(let x=0;x<shape[y].length;x++) {
        if(!shape[y][x]) continue;
        const bx = px+x, by = py+y;
        if(bx<0||bx>=COLS||by>=ROWS) return false;
        if(by>=0 && this.board[by][bx]) return false;
      }
    }
    return true;
  }

  moveLeft() {
    if(!this.current || this.gameOver) return false;
    if(this._canPlace(this.current.shape, this.current.x-1, this.current.y)) {
      this.current.x--;
      this._resetLockIfNeeded();
      return true;
    }
    return false;
  }
  moveRight() {
    if(!this.current || this.gameOver) return false;
    if(this._canPlace(this.current.shape, this.current.x+1, this.current.y)) {
      this.current.x++;
      this._resetLockIfNeeded();
      return true;
    }
    return false;
  }
  moveDown() {
    if(!this.current || this.gameOver) return false;
    if(this._canPlace(this.current.shape, this.current.x, this.current.y+1)) {
      this.current.y++;
      this.dropTimer = 0;
      return true;
    }
    // Start lock
    if(!this.locking) { this.locking = true; this.lockTimer = 0; }
    return false;
  }
  hardDrop() {
    if(!this.current || this.gameOver) return;
    let dropped = 0;
    while(this._canPlace(this.current.shape, this.current.x, this.current.y+1)) {
      this.current.y++;
      dropped++;
    }
    this.score += dropped * 2;
    this._lockPiece();
  }

  _rotate(dir) {
    if(!this.current || this.gameOver) return false;
    const {type, shape, rotation, x, y} = this.current;
    if(type === 'O') return false;
    const newShape = dir === 1 ? rotateCW(shape) : rotateCCW(shape);
    const newRot = (rotation + dir + 4) % 4;
    const kickKey = `${rotation}>${newRot}`;
    const kicks = type === 'I' ? I_KICKS[kickKey] : JLTSZ_KICKS[kickKey];
    if(!kicks) return false;
    for(const [kx, ky] of kicks) {
      if(this._canPlace(newShape, x+kx, y-ky)) {
        this.current.shape = newShape;
        this.current.rotation = newRot;
        this.current.x += kx;
        this.current.y -= ky;
        this._resetLockIfNeeded();
        return true;
      }
    }
    return false;
  }
  rotateCW() { return this._rotate(1); }
  rotateCCW() { return this._rotate(-1); }

  _resetLockIfNeeded() {
    if(this.locking && this.lockResets < 15) {
      this.lockTimer = 0;
      this.lockResets++;
    }
  }

  _lockPiece() {
    const {type, shape, x, y} = this.current;
    for(let r=0;r<shape.length;r++) {
      for(let c=0;c<shape[r].length;c++) {
        if(!shape[r][c]) continue;
        const by = y+r, bx = x+c;
        if(by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
          this.board[by][bx] = type;
        }
      }
    }
    this.current = null;
    this._checkLines();
  }

  _checkLines() {
    const full = [];
    for(let y=0;y<ROWS;y++) {
      if(this.board[y].every(c=>c!==null)) full.push(y);
    }
    if(full.length > 0) {
      this.clearingLines = full;
      this.clearTimer = 300; // ms for flash animation
      this.linesClearedThisTurn = full.length;
    } else {
      this.linesClearedThisTurn = 0;
      this._applyPendingGarbage();
      this._spawnPiece();
    }
  }

  _removeLines() {
    for(const y of this.clearingLines) {
      this.board.splice(y, 1);
      this.board.unshift(Array(COLS).fill(null));
    }
    const count = this.clearingLines.length;
    this.lines += count;
    this.score += SCORE_TABLE[count] * this.level;
    this.level = Math.floor(this.lines / 10) + 1;
    this.clearingLines = [];
    this._applyPendingGarbage();
    this._spawnPiece();
  }

  addGarbage(count) { this.pendingGarbage += count; }

  _applyPendingGarbage() {
    if(this.pendingGarbage <= 0) return;
    const hole = Math.floor(Math.random() * COLS);
    for(let i=0;i<this.pendingGarbage;i++) {
      this.board.shift();
      const garbageLine = Array(COLS).fill('G');
      garbageLine[hole] = null;
      this.board.push(garbageLine);
    }
    this.pendingGarbage = 0;
    // Check if any cell above row 0 is occupied (game over)
    // Already handled by spawn check
  }

  getGhostY() {
    if(!this.current) return 0;
    let gy = this.current.y;
    while(this._canPlace(this.current.shape, this.current.x, gy+1)) gy++;
    return gy;
  }

  get dropInterval() {
    return Math.max(50, 1000 - (this.level - 1) * 75);
  }

  update(delta) {
    if(this.gameOver) return;
    // Line clear animation
    if(this.clearingLines.length > 0) {
      this.clearTimer -= delta;
      if(this.clearTimer <= 0) this._removeLines();
      return;
    }
    if(!this.current) return;
    // Auto drop
    this.dropTimer += delta;
    if(this.dropTimer >= this.dropInterval) {
      this.dropTimer = 0;
      if(!this._canPlace(this.current.shape, this.current.x, this.current.y+1)) {
        if(!this.locking) { this.locking = true; this.lockTimer = 0; }
      } else {
        this.current.y++;
      }
    }
    // Lock delay
    if(this.locking) {
      this.lockTimer += delta;
      if(this.lockTimer >= 500) {
        this._lockPiece();
      }
    }
  }
}

// ==================== RENDERER ====================
class Renderer {
  constructor(boardCanvas, nextCanvas, engine, accentColor) {
    this.boardCanvas = boardCanvas;
    this.nextCanvas = nextCanvas;
    this.ctx = boardCanvas.getContext('2d');
    this.nctx = nextCanvas.getContext('2d');
    this.engine = engine;
    this.accent = accentColor;
    this.cellSize = 0;
    this.resize();
  }

  resize() {
    const wrapper = this.boardCanvas.parentElement;
    const maxH = wrapper.clientHeight - 6;
    const maxW = wrapper.clientWidth - 6;
    let cs = Math.floor(maxH / ROWS);
    if(cs * COLS > maxW) cs = Math.floor(maxW / COLS);
    cs = Math.max(cs, 10);
    this.cellSize = cs;
    this.boardCanvas.width = cs * COLS;
    this.boardCanvas.height = cs * ROWS;
    // Next piece canvas
    this.nextCanvas.width = cs * 4;
    this.nextCanvas.height = cs * 4;
  }

  render() {
    this._drawBoard();
    this._drawNext();
  }

  _drawBoard() {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const w = cs * COLS, h = cs * ROWS;
    ctx.clearRect(0, 0, w, h);
    // Background
    ctx.fillStyle = 'rgba(8,8,25,1)';
    ctx.fillRect(0, 0, w, h);
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for(let x=1;x<COLS;x++) { ctx.beginPath(); ctx.moveTo(x*cs,0); ctx.lineTo(x*cs,h); ctx.stroke(); }
    for(let y=1;y<ROWS;y++) { ctx.beginPath(); ctx.moveTo(0,y*cs); ctx.lineTo(w,y*cs); ctx.stroke(); }

    // Locked pieces
    const board = this.engine.board;
    const clearing = this.engine.clearingLines;
    for(let y=0;y<ROWS;y++) {
      for(let x=0;x<COLS;x++) {
        if(!board[y][x]) continue;
        if(clearing.includes(y)) {
          // Flash for clearing lines
          const flash = (this.engine.clearTimer / 300);
          ctx.globalAlpha = 0.3 + flash * 0.7;
          this._drawCell(ctx, x, y, '#ffffff');
          ctx.globalAlpha = 1;
        } else {
          const color = COLORS[board[y][x]] || COLORS.G;
          this._drawCell(ctx, x, y, color);
        }
      }
    }

    const cur = this.engine.current;
    if(!cur) return;

    // Ghost
    const ghostY = this.engine.getGhostY();
    ctx.globalAlpha = 0.2;
    for(let r=0;r<cur.shape.length;r++) {
      for(let c=0;c<cur.shape[r].length;c++) {
        if(!cur.shape[r][c]) continue;
        const bx = cur.x+c, by = ghostY+r;
        if(by>=0 && by<ROWS && bx>=0 && bx<COLS) {
          this._drawCell(ctx, bx, by, COLORS[cur.type]);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Active piece
    for(let r=0;r<cur.shape.length;r++) {
      for(let c=0;c<cur.shape[r].length;c++) {
        if(!cur.shape[r][c]) continue;
        const bx = cur.x+c, by = cur.y+r;
        if(by>=0 && by<ROWS && bx>=0 && bx<COLS) {
          this._drawCell(ctx, bx, by, COLORS[cur.type]);
        }
      }
    }
  }

  _drawCell(ctx, x, y, color) {
    const cs = this.cellSize;
    const px = x * cs, py = y * cs;
    const gap = 1;
    // Main fill
    ctx.fillStyle = color;
    ctx.fillRect(px+gap, py+gap, cs-gap*2, cs-gap*2);
    // Highlight top-left
    ctx.fillStyle = lighten(color.startsWith('#')?color:'#888888', 60);
    ctx.fillRect(px+gap, py+gap, cs-gap*2, 2);
    ctx.fillRect(px+gap, py+gap, 2, cs-gap*2);
    // Shadow bottom-right
    ctx.fillStyle = darken(color.startsWith('#')?color:'#888888', 60);
    ctx.fillRect(px+gap, py+cs-gap-2, cs-gap*2, 2);
    ctx.fillRect(px+cs-gap-2, py+gap, 2, cs-gap*2);
  }

  _drawNext() {
    const ctx = this.nctx;
    const cs = this.cellSize;
    const cw = cs * 4, ch = cs * 4;
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = 'rgba(8,8,25,0.5)';
    ctx.fillRect(0, 0, cw, ch);

    const type = this.engine.nextType;
    if(!type) return;
    const shape = SHAPES[type];
    const color = COLORS[type];
    const offX = (4 - shape[0].length) / 2;
    const offY = (4 - shape.length) / 2;
    for(let r=0;r<shape.length;r++) {
      for(let c=0;c<shape[r].length;c++) {
        if(!shape[r][c]) continue;
        this._drawCellCtx(ctx, offX+c, offY+r, color, cs);
      }
    }
  }

  _drawCellCtx(ctx, x, y, color, cs) {
    const px = x*cs, py = y*cs, gap=1;
    ctx.fillStyle = color;
    ctx.fillRect(px+gap, py+gap, cs-gap*2, cs-gap*2);
    ctx.fillStyle = lighten(color.startsWith('#')?color:'#888888', 50);
    ctx.fillRect(px+gap, py+gap, cs-gap*2, 2);
    ctx.fillRect(px+gap, py+gap, 2, cs-gap*2);
    ctx.fillStyle = darken(color.startsWith('#')?color:'#888888', 50);
    ctx.fillRect(px+gap, py+cs-gap-2, cs-gap*2, 2);
    ctx.fillRect(px+cs-gap-2, py+gap, 2, cs-gap*2);
  }
}

// ==================== GAME ====================
class Game {
  constructor() {
    this.engine1 = new TetrisEngine();
    this.engine2 = new TetrisEngine();
    this.renderer1 = null;
    this.renderer2 = null;
    this.running = false;
    this.lastTime = 0;
    this.dasTimers = {};
    this._initDOM();
    this._setupInput();
  }

  _initDOM() {
    this.startScreen = document.getElementById('start-screen');
    this.gameScreen = document.getElementById('game-screen');
    this.gameOverScreen = document.getElementById('game-over');
    this.winnerText = document.getElementById('winner-text');

    document.getElementById('start-btn').addEventListener('click', ()=> this.start());
    document.getElementById('restart-btn').addEventListener('click', ()=> this.start());
  }

  start() {
    this.startScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.gameScreen.classList.remove('hidden');

    this.engine1.reset();
    this.engine2.reset();

    const b1 = document.getElementById('p1-board');
    const n1 = document.getElementById('p1-next');
    const b2 = document.getElementById('p2-board');
    const n2 = document.getElementById('p2-next');

    this.renderer1 = new Renderer(b1, n1, this.engine1, '#00f5ff');
    this.renderer2 = new Renderer(b2, n2, this.engine2, '#ff00aa');

    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(t => this._loop(t));
  }

  _loop(timestamp) {
    if(!this.running) return;
    const delta = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // Remember lines before update
    const prev1 = this.engine1.linesClearedThisTurn;
    const prev2 = this.engine2.linesClearedThisTurn;

    this.engine1.update(delta);
    this.engine2.update(delta);

    // Check garbage sending (only when lines were just removed)
    if(this.engine1.linesClearedThisTurn > 0 && this.engine1.clearingLines.length === 0) {
      const g = GARBAGE_TABLE[this.engine1.linesClearedThisTurn] || 0;
      if(g > 0) this.engine2.addGarbage(g);
      this.engine1.linesClearedThisTurn = 0;
    }
    if(this.engine2.linesClearedThisTurn > 0 && this.engine2.clearingLines.length === 0) {
      const g = GARBAGE_TABLE[this.engine2.linesClearedThisTurn] || 0;
      if(g > 0) this.engine1.addGarbage(g);
      this.engine2.linesClearedThisTurn = 0;
    }

    // Check game over
    if(this.engine1.gameOver || this.engine2.gameOver) {
      this._endGame(this.engine1.gameOver ? 2 : 1);
      return;
    }

    this.renderer1.render();
    this.renderer2.render();
    this._updateUI();

    requestAnimationFrame(t => this._loop(t));
  }

  _updateUI() {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if(el.textContent !== String(val)) {
        el.textContent = val;
        el.classList.add('pop');
        setTimeout(()=> el.classList.remove('pop'), 150);
      }
    };
    set('p1-score', this.engine1.score);
    set('p1-level', this.engine1.level);
    set('p1-lines', this.engine1.lines);
    set('p2-score', this.engine2.score);
    set('p2-level', this.engine2.level);
    set('p2-lines', this.engine2.lines);
  }

  _endGame(winner) {
    this.running = false;
    this.winnerText.textContent = `PLAYER ${winner} KAZANDI!`;
    document.getElementById('final-p1').textContent = this.engine1.score;
    document.getElementById('final-p2').textContent = this.engine2.score;
    this.gameOverScreen.classList.remove('hidden');
  }

  // ==================== INPUT ====================
  _setupInput() {
    // Keyboard
    const keyMap1 = {
      'KeyA':'left','KeyD':'right','KeyS':'down','KeyW':'hardDrop',
      'KeyQ':'rotateCCW','KeyE':'rotateCW'
    };
    const keyMap2 = {
      'ArrowLeft':'left','ArrowRight':'right','ArrowDown':'down','ArrowUp':'hardDrop',
      'KeyN':'rotateCCW','KeyM':'rotateCW'
    };

    document.addEventListener('keydown', e => {
      if(e.repeat) return;
      e.preventDefault();
      const a1 = keyMap1[e.code];
      if(a1) this._startAction(1, a1);
      const a2 = keyMap2[e.code];
      if(a2) this._startAction(2, a2);
    });

    document.addEventListener('keyup', e => {
      const a1 = keyMap1[e.code];
      if(a1) this._stopAction(1, a1);
      const a2 = keyMap2[e.code];
      if(a2) this._stopAction(2, a2);
    });

    // Touch
    document.querySelectorAll('.touch-btn').forEach(btn => {
      const player = parseInt(btn.dataset.player);
      const action = btn.dataset.action;
      btn.addEventListener('touchstart', e => {
        e.preventDefault();
        this._startAction(player, action);
      }, {passive:false});
      btn.addEventListener('touchend', e => {
        e.preventDefault();
        this._stopAction(player, action);
      }, {passive:false});
      btn.addEventListener('touchcancel', e => {
        this._stopAction(player, action);
      });
      // Mouse fallback
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        this._startAction(player, action);
      });
      btn.addEventListener('mouseup', e => {
        this._stopAction(player, action);
      });
      btn.addEventListener('mouseleave', e => {
        this._stopAction(player, action);
      });
    });

    // Resize
    window.addEventListener('resize', () => {
      if(this.renderer1) this.renderer1.resize();
      if(this.renderer2) this.renderer2.resize();
    });
  }

  _performAction(player, action) {
    const eng = player === 1 ? this.engine1 : this.engine2;
    if(!eng || eng.gameOver) return;
    switch(action) {
      case 'left': eng.moveLeft(); break;
      case 'right': eng.moveRight(); break;
      case 'down': eng.moveDown(); break;
      case 'hardDrop': eng.hardDrop(); break;
      case 'rotateCW': eng.rotateCW(); break;
      case 'rotateCCW': eng.rotateCCW(); break;
    }
  }

  _startAction(player, action) {
    this._performAction(player, action);
    const key = `${player}_${action}`;
    // No DAS for hard drop and rotations
    if(action === 'hardDrop' || action === 'rotateCW' || action === 'rotateCCW') return;
    // Clear existing
    this._stopAction(player, action);
    this.dasTimers[key] = {
      delay: setTimeout(() => {
        this.dasTimers[key].repeat = setInterval(() => {
          this._performAction(player, action);
        }, 50);
      }, 170)
    };
  }

  _stopAction(player, action) {
    const key = `${player}_${action}`;
    const t = this.dasTimers[key];
    if(t) {
      clearTimeout(t.delay);
      clearInterval(t.repeat);
      delete this.dasTimers[key];
    }
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
