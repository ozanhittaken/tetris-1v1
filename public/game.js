// ==================== CONSTANTS ====================
const COLS = 10, ROWS = 20;
const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const COLORS = {
    I: '#00f5ff', O: '#ffd700', T: '#bf00ff', S: '#00ff41',
    Z: '#ff0040', J: '#0080ff', L: '#ff8c00', G: '#555555'
};
const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
};
const JLTSZ_KICKS = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
};
const I_KICKS = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
};
const SCORE_TABLE = [0, 100, 300, 500, 800];
const GARBAGE_TABLE = [0, 0, 1, 2, 4];

// ==================== UTILITIES ====================
function rotateCW(m) { const n = m.length, r = Array.from({ length: n }, () => Array(n).fill(0)); for (let y = 0; y < n; y++)for (let x = 0; x < n; x++)r[x][n - 1 - y] = m[y][x]; return r; }
function rotateCCW(m) { const n = m.length, r = Array.from({ length: n }, () => Array(n).fill(0)); for (let y = 0; y < n; y++)for (let x = 0; x < n; x++)r[n - 1 - x][y] = m[y][x]; return r; }
function shuffleArray(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
function lighten(h, a = 40) { let r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return `rgb(${Math.min(255, r + a)},${Math.min(255, g + a)},${Math.min(255, b + a)})`; }
function darken(h, a = 40) { let r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return `rgb(${Math.max(0, r - a)},${Math.max(0, g - a)},${Math.max(0, b - a)})`; }

// Seeded RNG for synchronized pieces
class SeededRNG {
    constructor(seed) { this.s = seed % 2147483647; if (this.s <= 0) this.s += 2147483646; }
    next() { this.s = this.s * 16807 % 2147483647; return (this.s - 1) / 2147483646; }
    nextInt(max) { return Math.floor(this.next() * max); }
}

// ==================== TETRIS ENGINE ====================
class TetrisEngine {
    constructor(rng) { this.rng = rng; this.reset(); }
    reset() {
        this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        this.score = 0; this.lines = 0; this.level = 1;
        this.gameOver = false; this.bag = []; this.nextType = null;
        this.current = null; this.dropTimer = 0;
        this.lockTimer = 0; this.lockResets = 0; this.locking = false;
        this.pendingGarbage = 0; this.linesClearedThisTurn = 0;
        this.clearingLines = []; this.clearTimer = 0;
        this._fillBag(); this.nextType = this._pull(); this._spawn();
    }
    _fillBag() {
        if (this.bag.length <= 1) {
            const a = [...PIECE_TYPES];
            for (let i = a.length - 1; i > 0; i--) { const j = this.rng.nextInt(i + 1);[a[i], a[j]] = [a[j], a[i]]; }
            this.bag = this.bag.concat(a);
        }
    }
    _pull() { this._fillBag(); return this.bag.shift(); }
    _spawn() {
        const type = this.nextType; this.nextType = this._pull();
        const shape = SHAPES[type].map(r => [...r]);
        const x = Math.floor((COLS - shape[0].length) / 2);
        const y = type === 'I' ? -1 : 0;
        this.current = { type, shape, rotation: 0, x, y };
        this.locking = false; this.lockTimer = 0; this.lockResets = 0;
        if (!this._canPlace(shape, x, y)) this.gameOver = true;
    }
    _canPlace(s, px, py) {
        for (let y = 0; y < s.length; y++)for (let x = 0; x < s[y].length; x++) {
            if (!s[y][x]) continue; const bx = px + x, by = py + y;
            if (bx < 0 || bx >= COLS || by >= ROWS) return false;
            if (by >= 0 && this.board[by][bx]) return false;
        } return true;
    }
    moveLeft() { if (!this.current || this.gameOver) return false; if (this._canPlace(this.current.shape, this.current.x - 1, this.current.y)) { this.current.x--; this._rlk(); return true; } return false; }
    moveRight() { if (!this.current || this.gameOver) return false; if (this._canPlace(this.current.shape, this.current.x + 1, this.current.y)) { this.current.x++; this._rlk(); return true; } return false; }
    moveDown() { if (!this.current || this.gameOver) return false; if (this._canPlace(this.current.shape, this.current.x, this.current.y + 1)) { this.current.y++; this.dropTimer = 0; return true; } if (!this.locking) { this.locking = true; this.lockTimer = 0; } return false; }
    hardDrop() { if (!this.current || this.gameOver) return; let d = 0; while (this._canPlace(this.current.shape, this.current.x, this.current.y + 1)) { this.current.y++; d++; } this.score += d * 2; this._lock(); }
    _rotate(dir) {
        if (!this.current || this.gameOver) return false;
        const { type, shape, rotation, x, y } = this.current; if (type === 'O') return false;
        const ns = dir === 1 ? rotateCW(shape) : rotateCCW(shape);
        const nr = (rotation + dir + 4) % 4; const kk = `${rotation}>${nr}`;
        const kicks = type === 'I' ? I_KICKS[kk] : JLTSZ_KICKS[kk]; if (!kicks) return false;
        for (const [kx, ky] of kicks) { if (this._canPlace(ns, x + kx, y - ky)) { this.current.shape = ns; this.current.rotation = nr; this.current.x += kx; this.current.y -= ky; this._rlk(); return true; } }
        return false;
    }
    rotateCW() { return this._rotate(1); }
    rotateCCW() { return this._rotate(-1); }
    _rlk() { if (this.locking && this.lockResets < 15) { this.lockTimer = 0; this.lockResets++; } }
    _lock() {
        const { type, shape, x, y } = this.current;
        for (let r = 0; r < shape.length; r++)for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue; const by = y + r, bx = x + c;
            if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) this.board[by][bx] = type;
        }
        this.current = null; this._checkLines();
    }
    _checkLines() {
        const full = []; for (let y = 0; y < ROWS; y++)if (this.board[y].every(c => c !== null)) full.push(y);
        if (full.length > 0) { this.clearingLines = full; this.clearTimer = 250; this.linesClearedThisTurn = full.length; }
        else { this.linesClearedThisTurn = 0; this._applyGarbage(); this._spawn(); }
    }
    _removeLines() {
        for (const y of this.clearingLines) { this.board.splice(y, 1); this.board.unshift(Array(COLS).fill(null)); }
        const c = this.clearingLines.length; this.lines += c; this.score += SCORE_TABLE[c] * this.level;
        this.level = Math.floor(this.lines / 10) + 1; this.clearingLines = [];
        this._applyGarbage(); this._spawn();
    }
    addGarbage(n) { this.pendingGarbage += n; }
    _applyGarbage() {
        if (this.pendingGarbage <= 0) return;
        const hole = this.rng.nextInt(COLS);
        for (let i = 0; i < this.pendingGarbage; i++) { this.board.shift(); const g = Array(COLS).fill('G'); g[hole] = null; this.board.push(g); }
        this.pendingGarbage = 0;
    }
    getGhostY() { if (!this.current) return 0; let gy = this.current.y; while (this._canPlace(this.current.shape, this.current.x, gy + 1)) gy++; return gy; }
    get dropInterval() { return Math.max(50, 1000 - (this.level - 1) * 75); }
    update(delta) {
        if (this.gameOver) return;
        if (this.clearingLines.length > 0) { this.clearTimer -= delta; if (this.clearTimer <= 0) this._removeLines(); return; }
        if (!this.current) return;
        this.dropTimer += delta;
        if (this.dropTimer >= this.dropInterval) {
            this.dropTimer = 0;
            if (!this._canPlace(this.current.shape, this.current.x, this.current.y + 1)) { if (!this.locking) { this.locking = true; this.lockTimer = 0; } }
            else this.current.y++;
        }
        if (this.locking) { this.lockTimer += delta; if (this.lockTimer >= 500) this._lock(); }
    }
    getBoardState() {
        return {
            board: this.board, score: this.score, lines: this.lines, level: this.level,
            current: this.current ? { type: this.current.type, shape: this.current.shape, x: this.current.x, y: this.current.y } : null,
            nextType: this.nextType
        };
    }
}

// ==================== RENDERER ====================
class Renderer {
    constructor(canvas, engine, mini = false) {
        this.canvas = canvas; this.ctx = canvas.getContext('2d');
        this.engine = engine; this.mini = mini; this.cellSize = 0;
    }
    resize() {
        const p = this.canvas.parentElement;
        const maxH = p.clientHeight - 4, maxW = p.clientWidth - 4;
        let cs = Math.floor(maxH / ROWS);
        if (cs * COLS > maxW) cs = Math.floor(maxW / COLS);
        cs = Math.max(cs, this.mini ? 4 : 8); this.cellSize = cs;
        this.canvas.width = cs * COLS; this.canvas.height = cs * ROWS;
    }
    render() {
        const ctx = this.ctx, cs = this.cellSize, w = cs * COLS, h = cs * ROWS;
        ctx.clearRect(0, 0, w, h); ctx.fillStyle = 'rgba(8,8,25,1)'; ctx.fillRect(0, 0, w, h);
        if (!this.mini) {
            ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
            for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, h); ctx.stroke(); }
            for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * cs); ctx.lineTo(w, y * cs); ctx.stroke(); }
        }
        const board = this.engine.board; const clearing = this.engine.clearingLines || [];
        for (let y = 0; y < ROWS; y++)for (let x = 0; x < COLS; x++) {
            if (!board[y][x]) continue;
            if (clearing.includes(y)) { ctx.globalAlpha = 0.3 + (this.engine.clearTimer / 250) * 0.7; this._cell(ctx, x, y, '#ffffff', cs); ctx.globalAlpha = 1; }
            else this._cell(ctx, x, y, COLORS[board[y][x]] || COLORS.G, cs);
        }
        const cur = this.engine.current; if (!cur) return;
        if (!this.mini) {
            const gy = this.engine.getGhostY(); ctx.globalAlpha = 0.2;
            for (let r = 0; r < cur.shape.length; r++)for (let c = 0; c < cur.shape[r].length; c++) {
                if (!cur.shape[r][c]) continue; const bx = cur.x + c, by = gy + r;
                if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) this._cell(ctx, bx, by, COLORS[cur.type], cs);
            } ctx.globalAlpha = 1;
        }
        for (let r = 0; r < cur.shape.length; r++)for (let c = 0; c < cur.shape[r].length; c++) {
            if (!cur.shape[r][c]) continue; const bx = cur.x + c, by = cur.y + r;
            if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) this._cell(ctx, bx, by, COLORS[cur.type], cs);
        }
    }
    _cell(ctx, x, y, color, cs) {
        const px = x * cs, py = y * cs, g = this.mini ? 0 : 1;
        ctx.fillStyle = color; ctx.fillRect(px + g, py + g, cs - g * 2, cs - g * 2);
        if (!this.mini) {
            const hex = color.startsWith('#') ? color : '#888888';
            ctx.fillStyle = lighten(hex, 50); ctx.fillRect(px + g, py + g, cs - g * 2, 2); ctx.fillRect(px + g, py + g, 2, cs - g * 2);
            ctx.fillStyle = darken(hex, 50); ctx.fillRect(px + g, py + cs - g - 2, cs - g * 2, 2); ctx.fillRect(px + cs - g - 2, py + g, 2, cs - g * 2);
        }
    }
    renderNext(nextCanvas, nextType) {
        const ctx = nextCanvas.getContext('2d'); const cs = this.cellSize;
        nextCanvas.width = cs * 4; nextCanvas.height = cs * 4;
        ctx.clearRect(0, 0, cs * 4, cs * 4); ctx.fillStyle = 'rgba(8,8,25,0.5)'; ctx.fillRect(0, 0, cs * 4, cs * 4);
        if (!nextType) return; const s = SHAPES[nextType]; const c = COLORS[nextType];
        const ox = (4 - s[0].length) / 2, oy = (4 - s.length) / 2;
        for (let r = 0; r < s.length; r++)for (let cc = 0; cc < s[r].length; cc++) {
            if (!s[r][cc]) continue; this._cell(ctx, ox + cc, oy + r, c, cs);
        }
    }
}

// ==================== OPPONENT MINI RENDERER ====================
class OppRenderer {
    constructor(canvas) {
        this.canvas = canvas; this.ctx = canvas.getContext('2d');
        this.boardData = null; this.currentData = null; this.cellSize = 0;
    }
    resize() {
        const p = this.canvas.parentElement;
        const maxH = p.clientHeight - 4, maxW = p.clientWidth - 4;
        let cs = Math.floor(maxH / ROWS); if (cs * COLS > maxW) cs = Math.floor(maxW / COLS);
        cs = Math.max(cs, 3); this.cellSize = cs;
        this.canvas.width = cs * COLS; this.canvas.height = cs * ROWS;
    }
    setData(board, current) { this.boardData = board; this.currentData = current; }
    render() {
        const ctx = this.ctx, cs = this.cellSize, w = cs * COLS, h = cs * ROWS;
        ctx.clearRect(0, 0, w, h); ctx.fillStyle = 'rgba(8,8,25,0.8)'; ctx.fillRect(0, 0, w, h);
        if (!this.boardData) return;
        for (let y = 0; y < ROWS; y++)for (let x = 0; x < COLS; x++) {
            if (!this.boardData[y][x]) continue; const c = COLORS[this.boardData[y][x]] || COLORS.G;
            ctx.fillStyle = c; ctx.fillRect(x * cs, y * cs, cs, cs);
        }
        if (this.currentData && this.currentData.shape) {
            const cur = this.currentData; const c = COLORS[cur.type] || '#fff';
            for (let r = 0; r < cur.shape.length; r++)for (let cc = 0; cc < cur.shape[r].length; cc++) {
                if (!cur.shape[r][cc]) continue; const bx = cur.x + cc, by = cur.y + r;
                if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) { ctx.fillStyle = c; ctx.fillRect(bx * cs, by * cs, cs, cs); }
            }
        }
    }
}

// ==================== APP ====================
class App {
    constructor() {
        this.username = ''; this.ws = null; this.roomCode = '';
        this.engine = null; this.renderer = null; this.oppRenderer = null;
        this.nextCanvas = null; this.running = false; this.lastTime = 0;
        this.myName = ''; this.oppName = '';
        this.dasTimers = {}; this.updateInterval = null;
        this._initDOM(); this._setupInput();
    }

    // ---- DOM ----
    _initDOM() {
        this.screens = {
            username: document.getElementById('username-screen'),
            lobby: document.getElementById('lobby-screen'),
            waiting: document.getElementById('waiting-screen'),
            countdown: document.getElementById('countdown-screen'),
            game: document.getElementById('game-screen'),
            gameover: document.getElementById('game-over-screen')
        };
        document.getElementById('to-lobby-btn').addEventListener('click', () => this._goToLobby());
        document.getElementById('username-input').addEventListener('keydown', e => { if (e.key === 'Enter') this._goToLobby(); });
        document.getElementById('create-room-btn').addEventListener('click', () => this._createRoom());
        document.getElementById('join-room-btn').addEventListener('click', () => this._joinRoom());
        document.getElementById('room-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') this._joinRoom(); });
        document.getElementById('back-lobby-btn').addEventListener('click', () => this._backToLobby());
        document.getElementById('rematch-btn').addEventListener('click', () => this._requestRematch());
    }

    _showScreen(name) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.screens[name].classList.add('active');
    }

    _goToLobby() {
        const inp = document.getElementById('username-input');
        const name = inp.value.trim();
        if (!name) { inp.focus(); return; }
        this.username = name;
        document.getElementById('lobby-username').textContent = name;
        this._showScreen('lobby');
        this._connectWS();
    }

    // ---- WebSocket ----
    _connectWS() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${proto}//${location.host}/ws`);
        this.ws.onmessage = e => this._onMessage(JSON.parse(e.data));
        this.ws.onclose = () => {
            if (this.running) { this.running = false; this._showResult(false); }
        };
    }

    _send(data) { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data)); }

    _onMessage(data) {
        switch (data.action) {
            case 'room_created':
                this.roomCode = data.code;
                document.getElementById('display-room-code').textContent = data.code;
                this._showScreen('waiting');
                break;
            case 'room_joined':
                this.roomCode = data.code;
                break;
            case 'error':
                const err = document.getElementById('lobby-error');
                err.textContent = data.message; err.classList.remove('hidden');
                setTimeout(() => err.classList.add('hidden'), 3000);
                break;
            case 'opponent_joined':
                this.myName = data.you; this.oppName = data.opponent;
                document.getElementById('countdown-opponent-name').textContent = data.opponent;
                this._showScreen('countdown');
                break;
            case 'game_start':
                this._startCountdown(data.seed);
                break;
            case 'opponent_wants_rematch':
                const rs = document.getElementById('rematch-status');
                rs.textContent = 'Rakip tekrar oynamak istiyor!';
                rs.classList.remove('hidden');
                break;
            case 'opponent_update':
                if (this.oppRenderer) {
                    this.oppRenderer.setData(data.board, data.current);
                    document.getElementById('game-opp-score').textContent = data.score || 0;
                }
                break;
            case 'receive_garbage':
                if (this.engine) this.engine.addGarbage(data.count);
                break;
            case 'opponent_lost':
                this.running = false; this._showResult(true);
                break;
            case 'you_lost':
                // Already handled by game over detection
                break;
            case 'opponent_disconnected':
                this.running = false; this._showResult(true);
                break;
        }
    }

    _createRoom() { this._send({ action: 'create_room', name: this.username }); }
    _joinRoom() {
        const code = document.getElementById('room-code-input').value.trim();
        if (code.length !== 4) {
            const err = document.getElementById('lobby-error');
            err.textContent = '4 haneli kod girin!'; err.classList.remove('hidden');
            setTimeout(() => err.classList.add('hidden'), 3000);
            return;
        }
        this._send({ action: 'join_room', name: this.username, code });
    }

    _backToLobby() {
        this.running = false;
        if (this.updateInterval) clearInterval(this.updateInterval);
        if (this.ws) this.ws.close();
        this._showScreen('lobby');
        setTimeout(() => this._connectWS(), 300);
    }

    _requestRematch() {
        const btn = document.getElementById('rematch-btn');
        const st = document.getElementById('rematch-status');
        btn.classList.add('hidden');
        st.textContent = "Rakip bekleniyor...";
        st.classList.remove('hidden');
        this._send({ action: 'request_rematch' });
    }

    // ---- COUNTDOWN ----
    _startCountdown(seed) {
        const el = document.getElementById('countdown-number');
        let count = 3; el.textContent = count;
        const iv = setInterval(() => {
            count--;
            if (count > 0) { el.textContent = count; }
            else {
                clearInterval(iv); el.textContent = 'GO!';
                setTimeout(() => this._startGame(seed), 400);
            }
        }, 800);
    }

    // ---- GAME ----
    _startGame(seed) {
        this._showScreen('game');
        document.getElementById('game-my-name').textContent = this.myName;
        document.getElementById('game-opp-name').textContent = this.oppName;

        const rng = new SeededRNG(seed);
        this.engine = new TetrisEngine(rng);
        const boardCanvas = document.getElementById('my-board');
        const nextCanvas = document.getElementById('my-next');
        this.nextCanvas = nextCanvas;
        this.renderer = new Renderer(boardCanvas, this.engine, false);

        const oppCanvas = document.getElementById('opp-board');
        this.oppRenderer = new OppRenderer(oppCanvas);

        this.renderer.resize();
        this.oppRenderer.resize();

        this.running = true; this.lastTime = performance.now();
        // Send updates 10 times/sec
        this.updateInterval = setInterval(() => {
            if (!this.running) return;
            const st = this.engine.getBoardState();
            this._send({ action: 'game_update', ...st });
        }, 100);

        window.addEventListener('resize', () => {
            if (this.renderer) this.renderer.resize();
            if (this.oppRenderer) this.oppRenderer.resize();
        });

        requestAnimationFrame(t => this._loop(t));
    }

    _loop(ts) {
        if (!this.running) return;
        const delta = ts - this.lastTime; this.lastTime = ts;
        const prevCleared = this.engine.linesClearedThisTurn;
        this.engine.update(delta);
        // Check garbage sending
        if (this.engine.linesClearedThisTurn > 0 && this.engine.clearingLines.length === 0) {
            const g = GARBAGE_TABLE[this.engine.linesClearedThisTurn] || 0;
            if (g > 0) this._send({ action: 'send_garbage', count: g });
            this.engine.linesClearedThisTurn = 0;
        }
        // Check game over
        if (this.engine.gameOver) {
            this.running = false;
            if (this.updateInterval) clearInterval(this.updateInterval);
            this._send({ action: 'game_over' });
            this._showResult(false);
            return;
        }
        this.renderer.render();
        this.renderer.renderNext(this.nextCanvas, this.engine.nextType);
        this.oppRenderer.render();
        this._updateUI();
        requestAnimationFrame(t => this._loop(t));
    }

    _updateUI() {
        document.getElementById('game-my-score').textContent = this.engine.score;
        document.getElementById('my-level').textContent = this.engine.level;
        document.getElementById('my-lines').textContent = this.engine.lines;
    }

    _showResult(won) {
        if (this.updateInterval) clearInterval(this.updateInterval);
        const rt = document.getElementById('result-text');
        rt.textContent = won ? 'KAZANDIN! 🏆' : 'KAYBETTİN!';
        rt.className = won ? 'result-win' : 'result-lose';
        document.getElementById('result-my-label').textContent = this.myName;
        document.getElementById('result-opp-label').textContent = this.oppName;
        document.getElementById('result-my-score').textContent = this.engine ? this.engine.score : 0;
        document.getElementById('result-opp-score').textContent = document.getElementById('game-opp-score').textContent || '0';

        // Reset rematch UI state
        document.getElementById('rematch-btn').classList.remove('hidden');
        document.getElementById('rematch-status').classList.add('hidden');
        document.getElementById('rematch-status').textContent = '';

        this._showScreen('gameover');
    }

    // ---- INPUT ----
    _setupInput() {
        // Keyboard
        const km = {
            'KeyA': 'left', 'KeyD': 'right', 'KeyS': 'down', 'KeyW': 'hardDrop', 'KeyQ': 'rotateCCW', 'KeyE': 'rotateCW',
            'ArrowLeft': 'left', 'ArrowRight': 'right', 'ArrowDown': 'down', 'ArrowUp': 'hardDrop', 'KeyN': 'rotateCCW', 'KeyM': 'rotateCW'
        };
        document.addEventListener('keydown', e => {
            if (!this.running || e.repeat) return;
            const a = km[e.code]; if (a) { e.preventDefault(); this._startAction(a); }
        });
        document.addEventListener('keyup', e => { const a = km[e.code]; if (a) this._stopAction(a); });

        // Touch
        document.querySelectorAll('.touch-btn').forEach(btn => {
            const action = btn.dataset.action;
            const start = e => { e.preventDefault(); this._startAction(action); };
            const stop = e => { e.preventDefault(); this._stopAction(action); };
            btn.addEventListener('touchstart', start, { passive: false });
            btn.addEventListener('touchend', stop, { passive: false });
            btn.addEventListener('touchcancel', () => this._stopAction(action));
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', stop);
            btn.addEventListener('mouseleave', () => this._stopAction(action));
        });
    }

    _performAction(a) {
        if (!this.engine || this.engine.gameOver) return;
        switch (a) {
            case 'left': this.engine.moveLeft(); break; case 'right': this.engine.moveRight(); break;
            case 'down': this.engine.moveDown(); break; case 'hardDrop': this.engine.hardDrop(); break;
            case 'rotateCW': this.engine.rotateCW(); break; case 'rotateCCW': this.engine.rotateCCW(); break;
        }
    }

    _startAction(a) {
        this._performAction(a);
        if (a === 'hardDrop' || a === 'rotateCW' || a === 'rotateCCW') return;
        this._stopAction(a);
        this.dasTimers[a] = {
            delay: setTimeout(() => {
                this.dasTimers[a].repeat = setInterval(() => this._performAction(a), 50);
            }, 170)
        };
    }
    _stopAction(a) { const t = this.dasTimers[a]; if (t) { clearTimeout(t.delay); clearInterval(t.repeat); delete this.dasTimers[a]; } }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
