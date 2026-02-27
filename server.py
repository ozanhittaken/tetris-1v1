import asyncio
import json
import random
import string
import os
from aiohttp import web

# ==================== ROOM MANAGER ====================
rooms = {}  # code -> Room

class Room:
    def __init__(self, code, host_ws, host_name):
        self.code = code
        self.players = [{'ws': host_ws, 'name': host_name, 'ready': False}]
        self.started = False
        self.rematch_requests = set()

    @property
    def is_full(self):
        return len(self.players) >= 2

    def add_player(self, ws, name):
        self.players.append({'ws': ws, 'name': name, 'ready': False})

    def get_opponent(self, ws):
        for p in self.players:
            if p['ws'] != ws:
                return p
        return None

    def remove_player(self, ws):
        self.players = [p for p in self.players if p['ws'] != ws]

    async def broadcast(self, msg, exclude=None):
        for p in self.players:
            if p['ws'] != exclude and not p['ws'].closed:
                await p['ws'].send_json(msg)

def generate_code():
    while True:
        code = ''.join(random.choices(string.digits, k=4))
        if code not in rooms:
            return code

# ==================== WEBSOCKET HANDLER ====================
async def ws_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    
    player_room = None
    player_name = None

    try:
        async for msg in ws:
            if msg.type != web.WSMsgType.TEXT:
                continue
            data = json.loads(msg.data)
            action = data.get('action')

            if action == 'create_room':
                player_name = data.get('name', 'Player')[:20]
                code = generate_code()
                room = Room(code, ws, player_name)
                rooms[code] = room
                player_room = code
                await ws.send_json({'action': 'room_created', 'code': code, 'name': player_name})

            elif action == 'join_room':
                player_name = data.get('name', 'Player')[:20]
                code = data.get('code', '').strip()
                if code not in rooms:
                    await ws.send_json({'action': 'error', 'message': 'Oda bulunamadı!'})
                    continue
                room = rooms[code]
                if room.is_full:
                    await ws.send_json({'action': 'error', 'message': 'Oda dolu!'})
                    continue
                if room.started:
                    await ws.send_json({'action': 'error', 'message': 'Oyun zaten başlamış!'})
                    continue
                room.add_player(ws, player_name)
                player_room = code
                await ws.send_json({'action': 'room_joined', 'code': code, 'name': player_name})
                # Notify both players, start countdown
                host = room.players[0]
                guest = room.players[1]
                await host['ws'].send_json({
                    'action': 'opponent_joined',
                    'opponent': guest['name'],
                    'you': host['name'],
                    'playerIndex': 0
                })
                await guest['ws'].send_json({
                    'action': 'opponent_joined',
                    'opponent': host['name'],
                    'you': guest['name'],
                    'playerIndex': 1
                })
                # Auto start after brief delay
                room.started = True
                # Use a seed for identical piece sequence
                seed = random.randint(0, 999999)
                await asyncio.sleep(0.5)
                for p in room.players:
                    if not p['ws'].closed:
                        await p['ws'].send_json({'action': 'game_start', 'seed': seed})

            elif action == 'game_update':
                # Relay board state to opponent
                if player_room and player_room in rooms:
                    room = rooms[player_room]
                    opp = room.get_opponent(ws)
                    if opp and not opp['ws'].closed:
                        await opp['ws'].send_json({
                            'action': 'opponent_update',
                            'board': data.get('board'),
                            'score': data.get('score'),
                            'lines': data.get('lines'),
                            'level': data.get('level'),
                            'current': data.get('current'),
                            'nextType': data.get('nextType')
                        })

            elif action == 'send_garbage':
                if player_room and player_room in rooms:
                    room = rooms[player_room]
                    opp = room.get_opponent(ws)
                    if opp and not opp['ws'].closed:
                        await opp['ws'].send_json({
                            'action': 'receive_garbage',
                            'count': data.get('count', 0)
                        })

            elif action == 'game_over':
                if player_room and player_room in rooms:
                    room = rooms[player_room]
                    opp = room.get_opponent(ws)
                    if opp and not opp['ws'].closed:
                        await opp['ws'].send_json({
                            'action': 'opponent_lost',
                            'winner': opp['name']
                        })
                    await ws.send_json({
                        'action': 'you_lost',
                        'winner': opp['name'] if opp else 'Rakip'
                    })

            elif action == 'request_rematch':
                if player_room and player_room in rooms:
                    room = rooms[player_room]
                    room.rematch_requests.add(ws)
                    
                    if len(room.rematch_requests) == 2:
                        # Both players want to rematch, start the game
                        room.rematch_requests.clear()
                        seed = random.randint(0, 999999)
                        for p in room.players:
                            if not p['ws'].closed:
                                await p['ws'].send_json({'action': 'game_start', 'seed': seed})
                    else:
                        # Notify the other player
                        opp = room.get_opponent(ws)
                        if opp and not opp['ws'].closed:
                            await opp['ws'].send_json({'action': 'opponent_wants_rematch'})

    except Exception as e:
        print(f"WS error: {e}")
    finally:
        # Cleanup
        if player_room and player_room in rooms:
            room = rooms[player_room]
            opp = room.get_opponent(ws)
            room.remove_player(ws)
            if opp and not opp['ws'].closed:
                await opp['ws'].send_json({'action': 'opponent_disconnected'})
            if len(room.players) == 0:
                del rooms[player_room]

    return ws

# ==================== HTTP ROUTES ====================
async def index_handler(request):
    return web.FileResponse(os.path.join(os.path.dirname(__file__), 'public', 'index.html'))

# ==================== APP SETUP ====================
app = web.Application()
app.router.add_get('/', index_handler)
app.router.add_get('/ws', ws_handler)
app.router.add_static('/', os.path.join(os.path.dirname(__file__), 'public'))

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print("== TETRIS BATTLE 1v1 SERVER ==")
    print(f"   Listening on port {port}")
    web.run_app(app, host='0.0.0.0', port=port)
