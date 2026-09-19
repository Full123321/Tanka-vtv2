import { Build, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, room, Timers, Players, Inventory, AreaService, AreaPlayerTriggerService, contextedProperties } from 'pixel_combats/room';
import * as RoomAPI from 'pixel_combats/room';
import * as peace from './options.js';
import * as teams from './default_teams.js';

// === КОНСТАНТЫ ===
var ADMIN_GAME_ID = "70ECCE4D1F5A8933";

// === ХРАНИЛИЩА ===
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

// === БАЗОВЫЕ НАСТРОЙКИ ===
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

// === СОЗДАНИЕ КОМАНДЫ ===
teams.create_team_blue();

// === ВХОД В КОМАНДУ И СПАВН ===
Teams.OnRequestJoinTeam.Add(function(player, team) { team.Add(player); });
Teams.OnPlayerChangeTeam.Add(function(player) {
    assign_player_id(player);
    check_admin(player);
    player.Spawns.Spawn();
});

// === ИГРОК ОТКЛЮЧИЛСЯ ===
try {
    Players.OnPlayerDisconnected.Add(function(player) {
        remove_player(player);
    });
} catch(e) {}

// === БАЗОВЫЙ ИНВЕНТАРЬ (нет оружия, только блоки) ===
peace.set_editor_inventory();

// === МГНОВЕННЫЙ РЕСПАВН ===
Spawns.GetContext().RespawnTime.Value = 0;

// === РАДУЖНЫЙ ТЕКСТ + АПТАЙМ ===
var loopTimer = Timers.GetContext().Get("Loop");
var displayTimer = Timers.GetContext().Get("Display");
loopTimer.RestartLoop(1);
loopTimer.OnTimer.Add(function() {
    uptimeSeconds++;
    displayTimer.Restart(uptimeSeconds + 1);
    var colors = ["#FF0000","#FF7F00","#FFFF00","#00FF00","#00FFFF","#0000FF","#8B00FF"];
    var colorIdx = Math.floor(uptimeSeconds / 2) % colors.length;
    Ui.GetContext().Hint.Value = "<color=" + colors[colorIdx] + ">это режим от тяночки!</color>";
});
Ui.GetContext().MainTimerId.Value = displayTimer.Id;

// === ИНИЦИАЛИЗАЦИЯ ЗОН ===
try { setup_farm_zones(); } catch(e) {}
try { setup_shop_zones(); } catch(e) {}
try { setup_hp_zones(); } catch(e) {}
try { setup_hint_zones(); } catch(e) {}
try { setup_plata_zones(); } catch(e) {}

// === ЧАТ-КОМАНДЫ (безопасное подключение) ===
try {
    if (RoomAPI.Chat) {
        if (RoomAPI.Chat.OnPlayerMessage) {
            RoomAPI.Chat.OnPlayerMessage.Add(function(player, message) {
                handle_command(player, message);
            });
        } else if (RoomAPI.Chat.OnMessage) {
            RoomAPI.Chat.OnMessage.Add(function(player, message) {
                handle_command(player, message);
            });
        }
    }
} catch(e) {}

// ==========================================
// ФУНКЦИИ: АДМИНКА И ID
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
    // Первый игрок (ID: 1) = админ
    if (numId === 1) { give_admin(player); return; }
    // Также проверяем по game ID (если player.Id существует)
    try {
        var gid = player.Id;
        if (gid && String(gid).toUpperCase() === ADMIN_GAME_ID) {
            give_admin(player);
            return;
        }
    } catch(e) {}
    // Проверяем по списку (для /adm)
    if (adminPlayers[numId]) { give_admin(player); }
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
        try { player.Inventory.ExplosiveInfinity.Value = true; } catch(e) {}
        player.PopUp("Вы получили админку!");
    } catch(e) {
        // Запасной вариант через команду
        try {
            var team = player.Team;
            if (team) {
                team.Inventory.Main.Value = true;
                team.Inventory.Secondary.Value = true;
                team.Inventory.Melee.Value = true;
                team.Inventory.Explosive.Value = true;
                team.Inventory.Build.Value = true;
                team.Inventory.MainInfinity.Value = true;
                team.Inventory.SecondaryInfinity.Value = true;
                team.Inventory.BuildInfinity.Value = true;
            }
            player.PopUp("Админка выдана!");
        } catch(e2) {}
    }
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

function get_player_by_id(numId) { return playersByNumId[numId] || null; }

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
            trigger.Enable = true;
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
            trigger.Enable = true;
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
            trigger.Enable = true;
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
                    player.ContextedProperties.MaxHp.Value = (player.ContextedProperties.MaxHp.Value || 100) + hpAmount;
                    player.PopUp("Куплено " + hpAmount + " HP за " + price + " монет");
                } catch(e) {
                    try {
                        contextedProperties.GetContext().MaxHp.Value = (contextedProperties.GetContext().MaxHp.Value || 100) + hpAmount;
                        player.PopUp("Куплено " + hpAmount + " HP за " + price + " монет");
                    } catch(e2) {
                        try { player.PopUp("Куплено " + hpAmount + " HP за " + price + " монет"); } catch(e3) {}
                    }
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
            trigger.Enable = true;
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
                trigger.Enable = true;
                trigger.OnEnter.Add(function(player) {
                    var pId = 0;
                    try { pId = player.Properties.Get("PlayerId").Value; } catch(e) { return; }
                    if (bannedPlayers[pId]) return;
                    if (!playerTransferAmountIdx[pId]) playerTransferAmountIdx[pId] = 0;
                    playerTransferAmountIdx[pId] = (playerTransferAmountIdx[pId] + 1) % transferAmounts.length;
                    playerTransferAmount[pId] = transferAmounts[playerTransferAmountIdx[pId]];
                    try { player.PopUp("Сумма перевода: " + playerTransferAmount[pId] + "\n(ещё раз — сменить)"); } catch(e) {}
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
                trigger.Enable = true;
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
                trigger.Enable = true;
                trigger.OnEnter.Add(function(player) {
                    var pId = 0;
                    try { pId = player.Properties.Get("PlayerId").Value; } catch(e) { return; }
                    if (bannedPlayers[pId]) return;
                    var amount = playerTransferAmount[pId];
                    var targetId = playerTransferTarget[pId];
                    if (!amount) {
                        try
