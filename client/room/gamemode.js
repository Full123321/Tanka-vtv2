import { Build, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, room, Timers, Players, AreaService, AreaPlayerTriggerService, contextedProperties } from 'pixel_combats/room';
import * as RoomAPI from 'pixel_combats/room';
import * as peace from './options.js';
import * as teams from './default_teams.js';

// ==========================================
// ХРАНИЛИЩА
// ==========================================
var playerIdCounter = 0;
var playersByNumId = {};
var bannedPlayers = {};
var adminPlayers = {};
var playerCoins = {};
var playerTransferAmount = {};
var playerTransferTarget = {};
var playerTransferAmountIdx = {};
var transferAmounts = [100, 200, 500, 1000, 2000, 5000];
var uptimeSeconds = 0;

// ==========================================
// БАЗОВЫЕ НАСТРОЙКИ
// ==========================================
room.PopupsEnable = true;
Damage.FriendlyFire = false;
BreackGraph.OnlyPlayerBlocksDmg = false;
BreackGraph.WeakBlocks = true;
BreackGraph.BreackAll = true;
Ui.GetContext().QuadsCount.Value = true;
Build.GetContext().BlocksSet.Value = BuildBlocksSet.AllClear;
peace.set_editor_options();
Damage.GetContext().DamageOut.Value = true;
Properties.GetContext().GameModeName.Value = "GameModes/EDITOR";

// ==========================================
// КОМАНДА (только синяя)
// ==========================================
teams.create_team_blue();

// ==========================================
// ВХОД В КОМАНДУ, ID, АДМИНКА, СПАВН
// ==========================================
function safeAddEvent(obj, handler) {
    try { obj.Add(handler); return true; }
    catch(e) {
        try { obj.add_Event(handler); return true; }
        catch(e2) { return false; }
    }
}

safeAddEvent(Teams.OnRequestJoinTeam, function(player, team) { team.Add(player); });
safeAddEvent(Teams.OnPlayerChangeTeam, function(player) {
    assign_player_id(player);
    check_admin(player);
    player.Spawns.Spawn();
});

// Очистка при выходе
try {
    Players.OnPlayerDisconnected.Add(function(player) {
        remove_player(player);
    });
} catch(e) {}

// ==========================================
// ИНВЕНТАРЬ И СПАВН
// ==========================================
peace.set_editor_inventory();
Spawns.GetContext().RespawnTime.Value = 0;

// ==========================================
// АПТАЙМ-ТАЙМЕР (правое окно) — бесконечное время
// ==========================================
var mainTimer = Timers.GetContext().Get("Main");
mainTimer.Restart(999999);
try { Ui.GetContext().MainTimerId.Value = mainTimer.Id; } catch(e) {}

// ==========================================
// РАДУЖНЫЙ ТЕКСТ + АПТАЙМ (левая сторона)
// ==========================================
var loopTimer = Timers.GetContext().Get("Loop");
loopTimer.RestartLoop(1);
loopTimer.OnTimer.Add(function() {
    uptimeSeconds++;
    var colors = ["#FF0000","#FF7F00","#FFFF00","#00FF00","#00FFFF","#0000FF","#8B00FF"];
    var colorIdx = Math.floor(uptimeSeconds / 2) % colors.length;
    var upStr = get_uptime_string();
    try {
        Ui.GetContext().Hint.Value = "<color=" + colors[colorIdx] + ">это режим от тяночки!</color>\nАптайм: " + upStr;
    } catch(e) {
        Ui.GetContext().Hint.Value = "это режим от тяночки! | Аптайм: " + upStr;
    }
});

// ==========================================
// ЗОНЫ
// ==========================================
try { setup_farm_zones(); } catch(e) {}
try { setup_shop_zones(); } catch(e) {}
try { setup_hp_zones(); } catch(e) {}
try { setup_hint_zones(); } catch(e) {}
try { setup_plata_zones(); } catch(e) {}

// ==========================================
// ЧАТ-КОМАНДЫ
// ==========================================
try { init_chat_commands(); } catch(e) {}

// ==========================================
// ФУНКЦИИ: ID И АДМИНКА
// ==========================================
function assign_player_id(player) {
    try {
        var idProp = player.Properties.Get("PlayerId");
        if (idProp.Value > 0) return;
        playerIdCounter++;
        idProp.Value = playerIdCounter;
        playersByNumId[playerIdCounter] = player;
        playerCoins[playerIdCounter] = 0;
        player.PopUp("Ваш ID: " + playerIdCounter);
    } catch(e) {}
}

function check_admin(player) {
    var numId = 0;
    try { numId = player.Properties.Get("PlayerId").Value; } catch(e) {}
    // Первый зашедший (ID: 1) = админ
    if (numId === 1) {
        give_admin(player);
        return;
    }
    // Для команды /adm
    if (adminPlayers[numId]) {
        give_admin(player);
    }
}

function give_admin(player) {
    try {
        var numId = player.Properties.Get("PlayerId").Value;
        adminPlayers[numId] = true;
        player.Inventory.Main.Value = true;
        player.Inventory.Secondary.Value = true;
        player.Inventory.Melee.Value = true;
        player.Inventory.Explosive.Value = true;
        player.Inventory.Build.Value = true;
        player.Inventory.MainInfinity.Value = true;
        player.Inventory.SecondaryInfinity.Value = true;
        player.Inventory.BuildInfinity.Value = true;
        try { player.Inventory.ExplosiveInfinity.Value = true; } catch(e2) {}
        player.PopUp("Вы получили админку!");
    } catch(e) {}
}

function remove_player(player) {
    try {
        var numId = player.Properties.Get("PlayerId").Value;
        delete playersByNumId[numId];
        delete playerCoins[numId];
        delete playerTransferAmount[numId];
        delete playerTransferTarget[numId];
        delete playerTransferAmountIdx[numId];
    } catch(e) {}
}

function get_player_by_id(numId) {
    return playersByNumId[numId] || null;
}

function is_admin(player) {
    try {
        var numId = player.Properties.Get("PlayerId").Value;
        return adminPlayers[numId] === true;
    } catch(e) { return false; }
}

function ban_player_by_id(numId) {
    var player = get_player_by_id(numId);
    if (!player) return false;
    bannedPlayers[numId] = true;
    try { player.PopUp("Вы забанены!"); } catch(e) {}
    return true;
}

function get_coins(player) {
    try {
        var numId = player.Properties.Get("PlayerId").Value;
        return playerCoins[numId] || 0;
    } catch(e) { return 0; }
}

function set_coins(player, val) {
    try {
        var numId = player.Properties.Get("PlayerId").Value;
        playerCoins[numId] = val;
    } catch(e) {}
}

function get_uptime_string() {
    var h = Math.floor(uptimeSeconds / 3600);
    var m = Math.floor((uptimeSeconds % 3600) / 60);
    var s = uptimeSeconds % 60;
    return h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

// ==========================================
// ЗОНА: ФАРМ (тег: farm, имя: число монет)
// ==========================================
function setup_farm_zones() {
    var areas = AreaService.GetByTag("farm");
    if (!areas || !areas.length) return;
    for (var i = 0; i < areas.length; i++) {
        (function(area) {
            var trigger = AreaPlayerTriggerService.Get(area.Name + "_farm");
            trigger.Area = area;
            var cooldown = {};
            trigger.OnEnter.Add(function(player) {
                var pId = 0;
                try { pId = player.Properties.Get("PlayerId").Value; } catch(e) { return; }
                if (bannedPlayers[pId]) return;
                var now = Date.now();
                if (cooldown[pId] && now - cooldown[pId] < 3000) return;
                cooldown[pId] = now;
                var amount = parseInt(area.Name);
                if (isNaN(amount)) return;
                var coins = get_coins(player) + amount;
                set_coins(player, coins);
                try { player.PopUp("+" + amount + " монет\nВсего: " + coins); } catch(e) {}
            });
        })(areas[i]);
    }
}

// ==========================================
// ЗОНА: МАГАЗИН (тег: weapon, имя: тип@цена)
// ==========================================
function setup_shop_zones() {
    var areas = AreaService.GetByTag("weapon");
    if (!areas || !areas.length) return;
    for (var i = 0; i < areas.length; i++) {
        (function(area) {
            var trigger = AreaPlayerTriggerService.Get(area.Name + "_shop");
            trigger.Area = area;
            var cooldown = {};
            trigger.OnEnter.Add(function(player) {
                var pId = 0;
                try { pId = player.Properties.Get("PlayerId").Value; } catch(e) { return; }
                if (bannedPlayers[pId]) return;
                var now = Date.now();
                if (cooldown[pId] && now - cooldown[pId] < 2000) return;
                cooldown[pId] = now;
                var parts = area.Name.split("@");
                if (parts.length !== 2) return;
                var type = parseInt(parts[0]);
                var price = parseInt(parts[1]);
                if (isNaN(type) || isNaN(price)) return;
                var coins = get_coins(player);
                if (coins < price) {
                    try { player.PopUp("Недостаточно средств!\nНужно: " + price + "\nУ вас: " + coins); } catch(e) {}
                    return;
                }
                set_coins(player, coins - price);
                try {
                    switch (type) {
                        case 0: player.Inventory.Main.Value = true; break;
                        case 1: player.Inventory.Secondary.Value = true; break;
                        case 2: player.Inventory.Melee.Value = true; break;
                        case 3: player.Inventory.Explosive.Value = true; break;
                        case 4: player.Inventory.Build.Value = true; break;
                        case 5: player.Inventory.Main.Value = true; player.Inventory.MainInfinity.Value = true; break;
                        case 6: player.Inventory.Secondary.Value = true; player.Inventory.SecondaryInfinity.Value = true; break;
                        case 7: player.Inventory.Explosive.Value = true; try { player.Inventory.ExplosiveInfinity.Value = true; } catch(e2) {} break;
                        case 8: player.Inventory.Build.Value = true; player.Inventory.BuildInfinity.Value = true; break;
                    }
                    player.PopUp("Куплено! Осталось: " + get_coins(player));
                } catch(e) {}
            });
        })(areas[i]);
    }
}

// ==========================================
// ЗОНА: ПОКУПКА HP (тег: xp, имя: хп@цена)
// ==========================================
function setup_hp_zones() {
    var areas = AreaService.GetByTag("xp");
    if (!areas || !areas.length) return;
    for (var i = 0; i < areas.length; i++) {
        (function(area) {
            var trigger = AreaPlayerTriggerService.Get(area.Name + "_hp");
            trigger.Area = area;
            var cooldown = {};
            trigger.OnEnter.Add(function(player) {
                var pId = 0;
                try { pId = player.Properties.Get("PlayerId").Value; } catch(e) { return; }
                if (bannedPlayers[pId]) return;
                var now = Date.now();
                if (cooldown[pId] && now - cooldown[pId] < 2000) return;
                cooldown[pId] = now;
                var parts = area.Name.split("@");
                if (parts.length !== 2) return;
                var hpAmount = parseInt(parts[0]);
                var price = parseInt(parts[1]);
                if (isNaN(hpAmount) || isNaN(price)) return;
                var coins = get_coins(player);
                if (coins < price) {
                    try { player.PopUp("Недостаточно средств!\nНужно: " + price + "\nУ вас: " + coins); } catch(e) {}
                    return;
                }
                set_coins(player, coins - price);
                try {
                    var ctx = contextedProperties.GetContext();
                    ctx.MaxHp.Value = (ctx.MaxHp.Value || 100) + hpAmount;
                    player.PopUp("Куплено " + hpAmount + " HP за " + price + " монет");
                } catch(e) {
                    try { player.PopUp("Куплено " + hpAmount + " HP за " + price + " монет"); } catch(e2) {}
                }
            });
        })(areas[i]);
    }
}

// ==========================================
// ЗОНА: ПОДСКАЗКИ (тег: hint, имя: текст)
// ==========================================
function setup_hint_zones() {
    var areas = AreaService.GetByTag("hint");
    if (!areas || !areas.length) return;
    for (var i = 0; i < areas.length; i++) {
        (function(area) {
            var trigger = AreaPlayerTriggerService.Get(area.Name + "_hint");
            trigger.Area = area;
            trigger.OnEnter.Add(function(player) {
                try { player.PopUp(area.Name); } catch(e) {}
            });
        })(areas[i]);
    }
}

// ==========================================
// ЗОНА: ПЕРЕВОД ДЕНЕГ (plata1, plata2, plata3)
// ==========================================
function setup_plata_zones() {
    // plata1 — выбор суммы
    var areas1 = AreaService.GetByTag("plata1");
    if (areas1 && areas1.length) {
        for (var i = 0; i < areas1.length; i++) {
            (function(area) {
                var trigger = AreaPlayerTriggerService.Get(area.Name + "_plata1");
                trigger.Area = area;
                trigger.OnEnter.Add(function(player) {
                    var pId = 0;
                    try { pId = player.Properties.Get("PlayerId").Value; } catch(e) { return; }
                    if (bannedPlayers[pId]) return;
                    if (!playerTransferAmountIdx[pId]) playerTransferAmountIdx[pId] = 0;
                    playerTransferAmountIdx[pId] = (playerTransferAmountIdx[pId] + 1) % transferAmounts.length;
                    playerTransferAmount[pId] = transferAmounts[playerTransferAmountIdx[pId]];
                    try { player.PopUp("Сумма: " + playerTransferAmount[pId] + "\n(ещё раз — сменить)"); } catch(e) {}
                });
            })(areas1[i]);
        }
    }
    // plata2 — выбор получателя
    var areas2 = AreaService.GetByTag("plata2");
    if (areas2 && areas2.length) {
        for (var i = 0; i < areas2.length; i++) {
            (function(area) {
                var trigger = AreaPlayerTriggerService.Get(area.Name + "_plata2");
                trigger.Area = area;
                trigger.OnEnter.Add(function(player) {
                    var pId = 0;
                    try { pId = player.Properties.Get("PlayerId").Value; } catch(e) { return; }
                    if (bannedPlayers[pId]) return;
                    var allIds = [];
                    for (var id in playersByNumId) {
                        if (parseInt(id) !== pId) allIds.push(parseInt(id));
                    }
                    if (allIds.length === 0) {
                        try { player.PopUp("Нет других игроков онлайн"); } catch(e) {}
                        return;
                    }
                    if (!playerTransferTarget[pId]) playerTransferTarget[pId] = 0;
                    playerTransferTarget[pId] = (playerTransferTarget[pId] + 1) % allIds.length;
                    var targetId = allIds[playerTransferTarget[pId]];
                    playerTransferTarget[pId] = targetId;
                    try { player.PopUp("Получатель: игрок #" + targetId + "\n(ещё раз — сменить)"); } catch(e) {}
                });
            })(areas2[i]);
        }
    }
    // plata3 — перевод
    var areas3 = AreaService.GetByTag("plata3");
    if (areas3 && areas3.length) {
        for (var i = 0; i < areas3.length; i++) {
            (function(area) {
                var trigger = AreaPlayerTriggerService.Get(area.Name + "_plata3");
                trigger.Area = area;
                trigger.OnEnter.Add(function(player) {
                    var pId = 0;
                    try { pId = player.Properties.Get("PlayerId").Value; } catch(e) { return; }
                    if (bannedPlayers[pId]) return;
                    var amount = playerTransferAmount[pId];
                    var targetId = playerTransferTarget[pId];
                    if (!amount) {
                        try { player.PopUp("Сначала выберите сумму (plata1)"); } catch(e) {}
                        return;
                    }
                    if (!targetId) {
                        try { player.PopUp("Сначала выберите получателя (plata2)"); } catch(e) {}
                        return;
                    }
                    var targetPlayer = get_player_by_id(targetId);
                    if (!targetPlayer) {
                        try { player.PopUp("Игрок не найден"); } catch(e) {}
                        return;
                    }
                    var coins = get_coins(player);
                    if (coins < amount) {
                        try { player.PopUp("Недостаточно средств!\nНужно: " + amount + "\nУ вас: " + coins); } catch(e) {}
                        return;
                    }
                    set_coins(player, coins - amount);
                    set_coins(targetPlayer, get_coins(targetPlayer) + amount);
                    try { player.PopUp("Переведено " + amount + " игроку #" + targetId); } catch(e) {}
                    try { targetPlayer.PopUp("Получено " + amount + " от #" + pId); } catch(e) {}
                });
            })(areas3[i]);
        }
    }
}

// ==========================================
// ЧАТ-КОМАНДЫ
// ==========================================
function init_chat_commands() {
    var Chat = RoomAPI.Chat;
    if (!Chat) return;

    // Пробуем разные варианты названий события
    var attached = false;
    if (Chat.OnPlayerMessage) {
        try { Chat.OnPlayerMessage.Add(function(player, message) { handle_command(player, message); }); attached = true; } catch(e) {}
    }
    if (!attached && Chat.OnMessage) {
        try { Chat.OnMessage.Add(function(player, message) { handle_command(player, message); }); attached = true; } catch(e) {}
    }
}

function handle_command(player, message) {
    if (!message || message[0] !== '/') return;
    var cmdEnd = message.indexOf('(');
    var command, args;
    if (cmdEnd === -1) {
        command = message.substring(1).trim().toLowerCase();
        args = "";
    } else {
        command = message.substring(1, cmdEnd).trim().toLowerCase();
        var closeParen = message.indexOf(')', cmdEnd);
        args = closeParen === -1 ? message.substring(cmdEnd + 1) : message.substring(cmdEnd + 1, closeParen);
    }

    switch (command) {
        case 'tp': cmd_tp(player, args); break;
        case 'pop': cmd_pop(player, args); break;
        case 'spawn': cmd_spawn(player, args); break;
        case 'adm': cmd_adm(player, args); break;
        case 'ban': cmd_ban(player, args); break;
        case 'help': cmd_help(player); break;
        case 'id': cmd_id(player); break;
        case 'list': cmd_list(player); break;
    }
}

function cmd_tp(player, args) {
    if (!is_admin(player)) { try { player.PopUp("Нет прав!"); } catch(e) {} return; }
    var parts = args.split(',');
    if (parts.length !== 2) { try { player.PopUp("/tp(id1,id2)"); } catch(e) {} return; }
    var id1 = parseInt(parts[0].trim());
    var id2 = parseInt(parts[1].trim());
    var t1 = get_player_by_id(id1);
    var t2 = get_player_by_id(id2);
    if (!t1 || !t2) { try { player.PopUp("Игрок не найден"); } catch(e) {} return; }
    try { t2.Spawns.Spawn(); t2.PopUp("Телепорт к #" + id1); player.PopUp("Готово: #" + id2 + " → #" + id1); } catch(e) {}
}

function cmd_pop(player, args) {
    if (!is_admin(player)) { try { player.PopUp("Нет прав!"); } catch(e) {} return; }
    if (!args) { try { player.PopUp("/pop(текст)"); } catch(e) {} return; }
    for (var id in playersByNumId) {
        try { playersByNumId[id].PopUp(args); } catch(e) {}
    }
}

function cmd_spawn(player, args) {
    if (!is_admin(player)) { try { player.PopUp("Нет прав!"); } catch(e) {} return; }
    var id = parseInt(args.trim());
    if (isNaN(id)) { try { player.Spawns.Spawn(); player.PopUp("Вы на спавне"); } catch(e) {} return; }
    var target = get_player_by_id(id);
    if (!target) { try { player.PopUp("#" + id + " не найден"); } catch(e) {} return; }
    try { target.Spawns.Spawn(); target.PopUp("Отправлен на спавн"); player.PopUp("#" + id + " на спавне"); } catch(e) {}
}

function cmd_adm(player, args) {
    if (!is_admin(player)) { try { player.PopUp("Нет прав!"); } catch(e) {} return; }
    var id = parseInt(args.trim());
    if (isNaN(id)) { try { player.PopUp("/adm(id)"); } catch(e) {} return; }
    var target = get_player_by_id(id);
    if (!target) { try { player.PopUp("#" + id + " не найден"); } catch(e) {} return; }
    give_admin(target);
    try { player.PopUp("Админка выдана #" + id); } catch(e) {}
}

function cmd_ban(player, args) {
    if (!is_admin(player)) { try { player.PopUp("Нет прав!"); } catch(e) {} return; }
    var id = parseInt(args.trim());
    if (isNaN(id)) { try { player.PopUp("/ban(id)"); } catch(e) {} return; }
    var ok = ban_player_by_id(id);
    try { player.PopUp(ok ? "#" + id + " забанен" : "#" + id + " не найден"); } catch(e) {}
}

function cmd_help(player) {
    try {
        player.PopUp("Команды:\n/tp(id1,id2) /pop(текст)\n/spawn(id) /adm(id) /ban(id)\n/id /list\nАптайм: " + get_uptime_string());
    } catch(e) {}
}

function cmd_id(player) {
    try {
        var id = player.Properties.Get("PlayerId").Value;
        player.PopUp("Ваш ID: " + id);
    } catch(e) {}
}

function cmd_list(player) {
    try {
        var text = "Онлайн:\n";
        for (var id in playersByNumId) { text += "#" + id + " "; }
        text += "\nАптайм: " + get_uptime_string();
        player.PopUp(text);
    } catch(e) {}
}
