// ==========================================
// КОНФИГУРАЦИЯ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

const CONFIG = {
    rainbowColors: ["#FF0000", "#FFA500", "#FFFF00", "#008000", "#0000FF", "#4B0082", "#EE82EE"],
    itemIds: {
        primary: 0, secondary: 1, melee: 2, grenade: 3, block: 4,
        inf_primary: 5, inf_secondary: 6, inf_grenade: 7, inf_block: 8
    },
    uiLabels: { K: "Статусы!", D: "R (Рум Айди)", S: "Монеты!", RID: "Убийства" }
};

function setupTeams() {
    try {
        const allTeams = Teams.GetAll();
        for (let i = 0; i < allTeams.length; i++) {
            if (allTeams[i].Tag) Teams.Remove(allTeams[i].Tag);
        }

        if (!Teams.Get('Black')) {
            Teams.Add('Black', 'Чёрные', { r: 0, g: 0, b: 0 });
        }
        
        const blackTeam = Teams.Get('Black');
        if (!blackTeam) return;

        const blueTeam = Teams.Get('Blue');
        if (blueTeam) {
            const blueSpawns = Spawns.GetContext(blueTeam);
            const blackSpawns = Spawns.GetContext(blackTeam);
            if (blueSpawns && blackSpawns) {
                for (let i = 0; i < blueSpawns.SpawnPointsGroups.Count; i++) {
                    blackSpawns.SpawnPointsGroups.Add(blueSpawns.SpawnPointsGroups.Get(i));
                }
                for (let i = 0; i < blueSpawns.CustomSpawnPoints.Count; i++) {
                    const p = blueSpawns.CustomSpawnPoints.Get(i);
                    if (p) blackSpawns.CustomSpawnPoints.Add(p.X, p.Y, p.Z, p.Rotation);
                }
            }
        }

        Teams.OnPlayerChangeTeam.Add(function(player) {
            if (player && player.Team && player.Team.Tag !== 'Black') {
                player.Team = blackTeam;
            }
        });
    } catch (e) {
        console.error("Ошибка setupTeams: " + e.message);
    }
}

// ==========================================
// ОСНОВНАЯ ЛОГИКА
// ==========================================

const players = new Map();
let serverStartTime = Date.now();
let firstPlayerAssigned = false;
let colorIndex = 0;

// Инициализация
setupTeams();

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

    // Выдача админки первому игроку
    if (!firstPlayerAssigned) {
        pData.isAdmin = true;
        pData.canFly = true;
        pData.hasAllWeapons = true;
        pData.canBuild = true;
        firstPlayerAssigned = true;
        if (player.Chat) player.Chat.SendMessage("Поздравляем! Вы главный администратор режима.");
    }

    // Принудительное назначение команды
    const blackTeam = Teams.Get('Black');
    if (blackTeam) player.Team = blackTeam;
});

RoomAPI.OnPlayerLeave.Add(function(player) {
    if (player && player.Id) {
        players.delete(player.Id);
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
            if (player.Chat) player.Chat.SendMessage(`+${amount} монет! Всего: ${pData.coins}`);
        }
    }

    // --- МАГАЗИН ОРУЖИЯ (тег: weapon) ---
    if (tag === "weapon") {
        const parts = name.split('@');
        if (parts.length === 2) {
            const itemId = parseInt(parts);
            const price = parseInt(parts[1](https://otvet.mail.ru/question/240544470));
            if (!isNaN(itemId) && !isNaN(price)) {
                if (pData.coins >= price) {
                    pData.coins -= price;
                    giveItem(player, itemId);
                    if (player.Chat) player.Chat.SendMessage("Предмет получен!");
                } else if (player.Chat) {
                    player.Chat.SendMessage("Недостаточно средств!");
                }
            }
        }
    }

    // --- МАГАЗИН ЗДОРОВЬЯ (тег: xp) ---
    if (tag === "xp") {
        const parts = name.split('@');
        if (parts.length === 2) {
            const hpAmount = parseInt(parts);
            const price = parseInt(parts[1](https://otvet.mail.ru/question/240544470));
            if (!isNaN(hpAmount) && !isNaN(price)) {
                if (pData.coins >= price) {
                    pData.coins -= price;
                    pData.hp = Math.min(100, pData.hp + hpAmount);
                    if (player.Chat) player.Chat.SendMessage("Здоровье восстановлено!");
                } else if (player.Chat) {
                    player.Chat.SendMessage("Недостаточно средств!");
                }
            }
        }
    }

    // --- МАГАЗИН СТАТУСОВ (тег: status) ---
    if (tag === "status") {
        const parts = name.split('@');
        if (parts.length === 3) {
            const color = parts;
            const statusName = parts[1](https://otvet.mail.ru/question/240544470);
            const price = parseInt(parts[2](https://devforum.roblox.com/t/need-help-with-gamemode/1503888));
            
            if (!isNaN(price)) {
                if (pData.coins >= price) {
                    pData.coins -= price;
                    pData.statuses.push({ name: statusName, color: color });
                    updateUIStatus(player, pData);
                    if (player.Chat) player.Chat.SendMessage(`Статус "\${statusName}" получен!`);
                } else if (player.Chat) {
                    player.Chat.SendMessage("Недостаточно средств!");
                }
            }
        }
    }

    // --- ЗОНА ДОСТУПА (тег: status2) ---
    if (tag === "status2") {
        const parts = name.split('@');
        if (parts.length >= 2) {
            const requiredName = parts[1](https://otvet.mail.ru/question/240544470);
            const hasStatus = pData.statuses.some(s => s.name === requiredName);
            
            if (!hasStatus) {
                player.Spawns.Spawn();
                if (player.Chat) player.Chat.SendMessage("Доступ запрещен! Нужен статус: " + requiredName);
            }
        }
    }

    // --- ТЕЛЕПОРТ ПО КООРДИНАТАМ (тег: tp) ---
    if (tag === "tp") {
        const parts = name.split('@');
        if (parts.length === 3) {
            const x = parseFloat(parts);
            const y = parseFloat(parts[1](https://otvet.mail.ru/question/240544470));
            const z = parseFloat(parts[2](https://devforum.roblox.com/t/need-help-with-gamemode/1503888));
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                player.Position = new Vector3(x, y, z);
            }
        }
    }

    // --- ПОДСКАЗКА (тег: hint) ---
    if (tag === "hint") {
        if (player.Chat) player.Chat.SendMessage(name);
    }
});

RoomAPI.OnChatMessage.Add(function(player, message) {
    if (!message.startsWith('/')) return;
    
    const args = message.split(' ');
    const cmd = args.substring(1).toLowerCase();
    const pData = players.get(player.Id);
    if (!pData) return;

    if (cmd === 'help') {
        if (player.Chat) player.Chat.SendMessage("/tp(ID) - тп к игроку | /pop(Текст) - всем | /spawn(ID) - на спавн | /adm(ID) - админка | /ban(ID) - бан");
        return;
    }

    if (cmd === 'tp') {
        const match = args[1](https://otvet.mail.ru/question/240544470) ? args[1](https://otvet.mail.ru/question/240544470).match(/$(\d+)$/) : null;
        if (match) {
            const targetId = parseInt(match[1](https://otvet.mail.ru/question/240544470));
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
        const match = args[1](https://otvet.mail.ru/question/240544470) ? args[1](https://otvet.mail.ru/question/240544470).match(/$(\d+)$/) : null;
        if (match) {
            const targetId = parseInt(match[1](https://otvet.mail.ru/question/240544470));
            const target = getPlayerByRoomId(targetId);
            if (target && target.Player) target.Player.Spawns.Spawn();
        }
    }

    if (cmd === 'adm' && pData.isAdmin) {
        const match = args[1](https://otvet.mail.ru/question/240544470) ? args[1](https://otvet.mail.ru/question/240544470).match(/$(\d+)$/) : null;
        if (match) {
            const targetId = parseInt(match[1](https://otvet.mail.ru/question/240544470));
            const targetData = getPlayerDataByRoomId(targetId);
            if (targetData) {
                targetData.isAdmin = true;
                targetData.canFly = true;
                targetData.hasAllWeapons = true;
                targetData.canBuild = true;
                if (player.Chat) player.Chat.SendMessage("Админка выдана!");
            }
        }
    }

    if (cmd === 'ban' && pData.isAdmin) {
        const match = args[1](https://otvet.mail.ru/question/240544470) ? args[1](https://otvet.mail.ru/question/240544470).match(/$(\d+)$/) : null;
        if (match) {
            const targetId = parseInt(match[1](https://otvet.mail.ru/question/240544470));
            const target = getPlayerByRoomId(targetId);
            if (target && target.Player) target.Player.Kick("Вы забанены администратором");
        }
    }
});

function giveItem(player, id) {
    // ЗАГОЛОВОК ДЛЯ РАЗРАБОТЧИКА:
    // Здесь нужно вставить реальный вызов API игры для выдачи предмета.
    // В текущей версии API Pixel Combats 2 нет универсального метода Inventory.Add.
    // Обычно это делается через Game.GiveItem или специфичный сервис.
    // Пока выводим в консоль, чтобы не ломать игру ошибкой.
    console.log("[GiveItem] Попытка выдачи предмета ID: " + id + " игроку: " + player.Name);
    
    // Пример (раскомментируйте и адаптируйте под актуальную версию API, если известно):
    // if (Game && Game.GiveItem) Game.GiveItem(player, id);
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
        // Логика обновления UI должна быть здесь
        // console.log("Статус обновлен: " + lastStatus.name);
    }
}

setInterval(function() {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    
    const timeString = h.toString().padStart(2, '0') + ":" + m.toString().padStart(2, '0') + ":" + s.toString().padStart(2, '0');
    
    // Мигание текста каждые 20 сек
    let titleText = "Режим от Тяночки!";
    if (uptime % 20 === 0) {
        titleText = "/help - тут все команды!";
    }

    colorIndex = (colorIndex + 1) % CONFIG.rainbowColors.length;
    const color = CONFIG.rainbowColors[colorIndex];
    
    // Обновление глобальных переменных UI (если они есть в вашей реализации)
    // globalTitleText = titleText;
    // globalTitleColor = color;
}, 1000);
