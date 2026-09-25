// Попытка импорта. Если среда не поддерживает ES6 модули, эти строки могут быть проигнорированы или вызвать ошибку.
// Если игра ругается на import, удалите эти две строки и вставьте код из default_teams.js и options.js прямо сюда.
let setupTeamsFunc;
let configObj;

try {
    const teamsModule = require('./default_teams.js'); // Попытка CommonJS
    const optionsModule = require('./options.js');
    setupTeamsFunc = teamsModule.setupTeams;
    configObj = optionsModule.CONFIG;
} catch (e) {
    try {
        // Попытка ES6 импорта (если используется сборщик)
        const { setupTeams } = require('./default_teams.js');
        const { CONFIG } = require('./options.js');
        setupTeamsFunc = setupTeams;
        configObj = CONFIG;
    } catch (e2) {
        // Если ничего не вышло, предполагаем, что функции глобальные или будут подключены иначе
        setupTeamsFunc = window.setupTeams || setupTeams; 
        configObj = window.CONFIG || CONFIG;
    }
}

// Если функции не найдены, создаем заглушки, чтобы код не падал сразу
if (!setupTeamsFunc) {
    setupTeamsFunc = function() { console.log("Функция setupTeams не найдена"); };
}
if (!configObj) {
    configObj = CONFIG; // fallback на глобальный объект если он есть
}

const players = new Map();
let serverStartTime = Date.now();
let firstPlayerAssigned = false;
let colorIndex = 0;

// Инициализация команд
setupTeamsFunc();

RoomAPI.OnPlayerJoin.Add(function(player) {
    if (!player || !player.Id) return;

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
        if(player.Chat) player.Chat.SendMessage("Поздравляем! Вы главный администратор режима.");
    }

    const blackTeam = Teams.Get('Black');
    if (blackTeam) player.Team = blackTeam;

    updateOnlineList();
});

RoomAPI.OnPlayerLeave.Add(function(player) {
    if (player && player.Id) {
        players.delete(player.Id);
        updateOnlineList();
    }
});

RoomAPI.OnPlayerEnterZone.Add(function(player, zone) {
    if (!player || !zone) return;
    const tag = zone.Tag;
    const name = zone.Name;
    const pData = players.get(player.Id);
    if (!pData) return;

    // --- ФАРМ (тег: farm) ---
    if (tag === "farm") {
        const amount = parseInt(name);
        if (!isNaN(amount) && amount > 0) {
            pData.coins += amount;
            if(player.Chat) player.Chat.SendMessage(`+${amount} монет! Всего: ${pData.coins}`);
        }
    }

    // --- МАГАЗИН ОРУЖИЯ (тег: weapon) ---
    if (tag === "weapon") {
        const parts = name.split('@');
        if (parts.length === 2) {
            const itemId = parseInt(parts);
            const price = parseInt(parts);
            if (!isNaN(itemId) && !isNaN(price)) {
                if (pData.coins >= price) {
                    pData.coins -= price;
                    giveItem(player, itemId);
                    if(player.Chat) player.Chat.SendMessage("Предмет получен!");
                } else {
                    if(player.Chat) player.Chat.SendMessage("Недостаточно средств!");
                }
            }
        }
    }

    // --- МАГАЗИН ЗДОРОВЬЯ (тег: xp) ---
    if (tag === "xp") {
        const parts = name.split('@');
        if (parts.length === 2) {
            const hpAmount = parseInt(parts);
            const price = parseInt(parts);
            if (!isNaN(hpAmount) && !isNaN(price)) {
                if (pData.coins >= price) {
                    pData.coins -= price;
                    pData.hp = Math.min(100, pData.hp + hpAmount);
                    if(player.Chat) player.Chat.SendMessage("Здоровье восстановлено!");
                } else {
                    if(player.Chat) player.Chat.SendMessage("Недостаточно средств!");
                }
            }
        }
    }

    // --- МАГАЗИН СТАТУСОВ (тег: status) ---
    if (tag === "status") {
        const parts = name.split('@');
        if (parts.length === 3) {
            const color = parts;
            const statusName = parts;
            const price = parseInt(parts);
            
            if (!isNaN(price)) {
                if (pData.coins >= price) {
                    pData.coins -= price;
                    pData.statuses.push({ name: statusName, color: color });
                    updateUIStatus(player, pData);
                    if(player.Chat) player.Chat.SendMessage(`Статус "\${statusName}" получен!`);
                } else {
                    if(player.Chat) player.Chat.SendMessage("Недостаточно средств!");
                }
            }
        }
    }

    // --- ЗОНА ДОСТУПА (тег: status2) ---
    if (tag === "status2") {
        const parts = name.split('@');
        if (parts.length >= 2) {
            const requiredName = parts;
            const hasStatus = pData.statuses.some(s => s.name === requiredName);
            
            if (!hasStatus) {
                player.Spawns.Spawn();
                if(player.Chat) player.Chat.SendMessage("Доступ запрещен! Нужен статус: " + requiredName);
            }
        }
    }

    // --- ТЕЛЕПОРТ ПО КООРДИНАТАМ (тег: tp) ---
    if (tag === "tp") {
        const parts = name.split('@');
        if (parts.length === 3) {
            const x = parseFloat(parts);
            const y = parseFloat(parts);
            const z = parseFloat(parts);
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                player.Position = new Vector3(x, y, z);
            }
        }
    }

    // --- ПОДСКАЗКА (тег: hint) ---
    if (tag === "hint") {
        if(player.Chat) player.Chat.SendMessage(name);
    }
});

RoomAPI.OnChatMessage.Add(function(player, message) {
    if (!message.startsWith('/')) return;
    
    const args = message.split(' ');
    const cmd = args.substring(1).toLowerCase();
    const pData = players.get(player.Id);
    if (!pData) return;

    if (cmd === 'help') {
        if(player.Chat) player.Chat.SendMessage("/tp(ID) - тп к игроку | /pop(Текст) - всем | /spawn(ID) - на спавн | /adm(ID) - админка | /ban(ID) - бан");
    }

    if (cmd === 'tp') {
        const match = args ? args.match(/$(\d+)$/) : null;
        if (match) {
            const targetId = parseInt(match);
            const target = getPlayerByRoomId(targetId);
            if (target && target.Player) player.Position = target.Player.Position;
        }
    }

    if (cmd === 'pop') {
        const startIdx = message.indexOf('(');
        const endIdx = message.lastIndexOf(')');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            const text = message.substring(startIdx + 1, endIdx);
            RoomAPI.BroadcastMessage(text, { r: 255, g: 255, b: 255 });
        }
    }

    if (cmd === 'spawn') {
        const match = args ? args.match(/$(\d+)$/) : null;
        if (match) {
            const targetId = parseInt(match);
            const target = getPlayerByRoomId(targetId);
            if (target && target.Player) target.Player.Spawns.Spawn();
        }
    }

    if (cmd === 'adm' && pData.isAdmin) {
        const match = args ? args.match(/$(\d+)$/) : null;
        if (match) {
            const targetId = parseInt(match);
            const targetData = getPlayerDataByRoomId(targetId);
            if (targetData) {
                targetData.isAdmin = true;
                targetData.canFly = true;
                targetData.hasAllWeapons = true;
                targetData.canBuild = true;
                if(player.Chat) player.Chat.SendMessage("Админка выдана!");
            }
        }
    }

    if (cmd === 'ban' && pData.isAdmin) {
        const match = args ? args.match(/$(\d+)$/) : null;
        if (match) {
            const targetId = parseInt(match);
            const target = getPlayerByRoomId(targetId);
            if (target && target.Player) target.Player.Kick("Вы забанены администратором");
        }
    }
});

function giveItem(player, id) {
    // ВАЖНО: Здесь нужно вставить реальный вызов API игры для выдачи предмета.
    // Пример (может отличаться в вашей версии игры):
    // player.Inventory.Add(id); 
    // Или специфичный метод: Game.GiveItem(player, id);
    console.log("Попытка выдачи предмета ID: " + id + " игроку: " + player.Name);
}

function getPlayerByRoomId(roomId) {
    for (let [id, data] of players.entries()) {
        if (data.roomId === roomId) {
            const pl = RoomAPI.GetPlayer(id);
            if (pl) return { Player: pl, Data: data };
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
        // Логика обновления UI должна быть здесь, если у вас есть доступ к виджетам
        // Например: setWidgetText('status_label', lastStatus.name);
    }
}

function updateOnlineList() {
    // Логика обновления списка игроков в UI
    // console.log("Онлайн: " + players.size);
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

    colorIndex = (colorIndex + 1) % configObj.rainbowColors.length;
    const color = configObj.rainbowColors[colorIndex];
    
    // Здесь можно обновлять глобальные переменные для UI, если они есть
    // globalTitleText = titleText;
    // globalTitleColor = color;
}, 1000);

