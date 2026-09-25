import { setupTeams } from './default_teams.js';
import { CONFIG } from './options.js';

const players = new Map();
let serverStartTime = Date.now();
let firstPlayerAssigned = false;
let colorIndex = 0;

setupTeams();

RoomAPI.OnPlayerJoin.Add(function(player) {
    const roomId = players.size + 1;
    const pData = {
        id: player.Id,
        roomId: roomId,
        coins: 0,
        kills: 0,
        hp: 100,
        statuses: [],
        isAdmin: false,
        canFly: false,
        hasAllWeapons: false,
        canBuild: false
    };

    players.set(player.Id, pData);

    if (!firstPlayerAssigned) {
        pData.isAdmin = true;
        pData.canFly = true;
        pData.hasAllWeapons = true;
        pData.canBuild = true;
        firstPlayerAssigned = true;
        player.Chat.SendMessage("Поздравляем! Вы главный администратор режима.");
    }

    const blackTeam = Teams.Get('Black');
    if (blackTeam) player.Team = blackTeam;

    updateOnlineList();
});

RoomAPI.OnPlayerLeave.Add(function(player) {
    players.delete(player.Id);
    updateOnlineList();
});

RoomAPI.OnPlayerEnterZone.Add(function(player, zone) {
    const tag = zone.Tag;
    const name = zone.Name;
    const pData = players.get(player.Id);
    if (!pData) return;

    if (tag === "farm") {
        const amount = parseInt(name);
        if (amount > 0) {
            pData.coins += amount;
            player.Chat.SendMessage(`+${amount} монет! Всего: ${pData.coins}`);
        }
    }

    if (tag === "weapon") {
        const parts = name.split('@');
        if (parts.length === 2) {
            const itemId = parseInt(parts);
            const price = parseInt(parts);
            if (pData.coins >= price) {
                pData.coins -= price;
                giveItem(player, itemId);
                player.Chat.SendMessage("Предмет получен!");
            } else {
                player.Chat.SendMessage("Недостаточно средств!");
            }
        }
    }

    if (tag === "xp") {
        const parts = name.split('@');
        if (parts.length === 2) {
            const hpAmount = parseInt(parts);
            const price = parseInt(parts);
            if (pData.coins >= price) {
                pData.coins -= price;
                pData.hp = Math.min(100, pData.hp + hpAmount);
                player.Chat.SendMessage("Здоровье восстановлено!");
            } else {
                player.Chat.SendMessage("Недостаточно средств!");
            }
        }
    }

    if (tag === "status") {
        const parts = name.split('@');
        if (parts.length === 3) {
            const color = parts;
            const statusName = parts;
            const price = parseInt(parts);
            
            if (pData.coins >= price) {
                pData.coins -= price;
                pData.statuses.push({ name: statusName, color: color });
                updateUIStatus(player, pData);
                player.Chat.SendMessage(`Статус "\${statusName}" получен!`);
            } else {
                player.Chat.SendMessage("Недостаточно средств!");
            }
        }
    }

    if (tag === "status2") {
        const parts = name.split('@');
        if (parts.length >= 2) {
            const requiredName = parts;
            const hasStatus = pData.statuses.some(s => s.name === requiredName);
            
            if (!hasStatus) {
                player.Spawns.Spawn();
                player.Chat.SendMessage("Доступ запрещен! Нужен статус: " + requiredName);
            }
        }
    }

    if (tag === "tp") {
        const parts = name.split('@');
        if (parts.length === 3) {
            const x = parseInt(parts);
            const y = parseInt(parts);
            const z = parseInt(parts);
            player.Position = new Vector3(x, y, z);
        }
    }

    if (tag === "hint") {
        player.Chat.SendMessage(name);
    }
});

RoomAPI.OnChatMessage.Add(function(player, message) {
    if (!message.startsWith('/')) return;
    
    const args = message.split(' ');
    const cmd = args.substring(1).toLowerCase();
    const pData = players.get(player.Id);
    if (!pData) return;

    if (cmd === 'help') {
        player.Chat.SendMessage("/tp(ID) - тп к игроку | /pop(Текст) - всем | /spawn(ID) - на спавн | /adm(ID) - админка | /ban(ID) - бан");
    }

    if (cmd === 'tp') {
        const match = args.match(/$(\d+)$/);
        if (match) {
            const targetId = parseInt(match);
            const target = getPlayerByRoomId(targetId);
            if (target) player.Position = target.Player.Position;
        }
    }

    if (cmd === 'pop') {
        const text = message.substring(message.indexOf('(') + 1, message.lastIndexOf(')'));
        RoomAPI.BroadcastMessage(text, { r: 255, g: 255, b: 255 });
    }

    if (cmd === 'spawn') {
        const match = args.match(/$(\d+)$/);
        if (match) {
            const targetId = parseInt(match);
            const target = getPlayerByRoomId(targetId);
            if (target) target.Player.Spawns.Spawn();
        }
    }

    if (cmd === 'adm' && pData.isAdmin) {
        const match = args.match(/$(\d+)$/);
        if (match) {
            const targetId = parseInt(match);
            const targetData = getPlayerDataByRoomId(targetId);
            if (targetData) {
                targetData.isAdmin = true;
                targetData.canFly = true;
                targetData.hasAllWeapons = true;
                targetData.canBuild = true;
                player.Chat.SendMessage("Админка выдана!");
            }
        }
    }

    if (cmd === 'ban' && pData.isAdmin) {
        const match = args.match(/$(\d+)$/);
        if (match) {
            const targetId = parseInt(match);
            const target = getPlayerByRoomId(targetId);
            if (target) target.Player.Kick("Вы забанены администратором");
        }
    }
});

function giveItem(player, id) {
    console.log("Выдача предмета ID: " + id);
}

function getPlayerByRoomId(roomId) {
    for (let [id, data] of players.entries()) {
        if (data.roomId === roomId) {
            return { Player: RoomAPI.GetPlayer(id), Data: data };
        }
    }
    return null;
}

function getPlayerDataByRoomId(roomId) {
    for (let [id, data] of players.entries()) {
        if (data.roomId === roomId) return data;
    }
    return null;
}

function updateUIStatus(player, data) {
    if (data.statuses.length > 0) {
        const lastStatus = data.statuses[data.statuses.length - 1];
    }
}

function updateOnlineList() {
    console.log("Обновление списка онлайн. Игроков: " + players.size);
}

setInterval(function() {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    const timeString = h.toString().padStart(2, '0') + ":" + m.toString().padStart(2, '0') + ":" + s.toString().padStart(2, '0');

    let titleText = "Режим от Тяночки!";
    if (uptime % 20 === 0) {
        titleText = "/help - тут все команды!";
    }

    colorIndex = (colorIndex + 1) % CONFIG.rainbowColors.length;
    const color = CONFIG.rainbowColors[colorIndex];
}, 1000);
