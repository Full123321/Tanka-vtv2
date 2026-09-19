import { Players, Properties, Timers, Ui, Spawns, Teams } from 'pixel_combats/room';
import { set_admin_inventory } from './options.js';

// === КОНСТАНТЫ ===
export const ADMIN_GAME_ID = "70ECCE4D1F5A8933";

// === ХРАНИЛИЩА ===
var playerIdCounter = 0;           // счётчик для выдачи ID
var playersByNumId = {};           // карта: числовой ID → игрок
var bannedPlayers = {};            // забаненные игроки (по game ID)
var adminPlayers = {};             // админы (по числовому ID)

// === ИНИЦИАЛИЗАЦИЯ ===
export function init() {
    // Игрок зашёл в команду — выдаём ID, проверяем админку
    Teams.OnPlayerChangeTeam.Add(function(player) {
        assign_player_id(player);
        check_admin(player);
        player.Spawns.Spawn();
    });

    // Игрок отключился — очищаем
    Players.OnPlayerDisconnected.Add(function(player) {
        remove_player(player);
    });

    // Радужная надпись + аптайм — циклический таймер
    var rainbowTimer = Timers.GetContext().Get("Rainbow");
    rainbowTimer.RestartLoop(1);
    rainbowTimer.OnTimer.Add(function() {
        update_rainbow_and_uptime();
    });
}

// === ВЫДАЧА ID ===
function assign_player_id(player) {
    // Если у игрока уже есть ID — пропускаем
    var idProp = player.Properties.Get("PlayerId");
    if (idProp.Value > 0) return;

    playerIdCounter++;
    idProp.Value = playerIdCounter;
    playersByNumId[playerIdCounter] = player;

    // Попап с приветствием и ID
    player.PopUp("Ваш ID: " + playerIdCounter);
}

// === ПРОВЕРКА АДМИНКИ ===
function check_admin(player) {
    // Проверяем по game ID
    var game_id = get_game_id(player);
    if (game_id === ADMIN_GAME_ID) {
        give_admin(player);
        return;
    }

    // Проверяем по числовому ID (для команды /adm)
    var numId = player.Properties.Get("PlayerId").Value;
    if (adminPlayers[numId]) {
        give_admin(player);
    }
}

// === Получение game ID игрока ===
// ВАЖНО: точное свойство зависит от версии API.
// Если player.Id не работает, попробуйте player.Properties.Get("Id").Value
// или другой способ получения ID.
function get_game_id(player) {
    try {
        return player.Id;
    } catch (e) {
        try {
            return player.Properties.Get("GameId").Value;
        } catch (e2) {
            return "";
        }
    }
}

// === ВЫДАЧА АДМИНКИ ===
export function give_admin(player) {
    var numId = player.Properties.Get("PlayerId").Value;
    adminPlayers[numId] = true;

    // Админский инвентарь
    set_admin_inventory(player);

    // Попап
    player.PopUp("Вы получили админку!");
}

// === УДАЛЕНИЕ ИГРОКА ===
function remove_player(player) {
    var numId = player.Properties.Get("PlayerId").Value;
    delete playersByNumId[numId];
}

// === ПОЛУЧЕНИЕ ИГРОКА ПО ЧИСЛОВОМУ ID ===
export function get_player_by_id(numId) {
    return playersByNumId[numId] || null;
}

// === ПРОВЕРКА АДМИНА ===
export function is_admin(player) {
    var numId = player.Properties.Get("PlayerId").Value;
    return adminPlayers[numId] === true;
}

// === БАН ===
export function ban_player(numId) {
    var player = get_player_by_id(numId);
    if (!player) return false;

    var game_id = get_game_id(player);
    bannedPlayers[game_id] = true;

    // Пытаемся отключить игрока
    try {
        player.Disconnect("Вы забанены");
    } catch (e) {
        // Если Disconnect не работает — кикаем другим способом
        player.PopUp("Вы забанены!");
    }

    return true;
}

// === ПРОВЕРКА БАНА ===
export function is_banned(player) {
    var game_id = get_game_id(player);
    return bannedPlayers[game_id] === true;
}

// === РАДУЖНЫЙ ТЕКСТ + АПТАЙМ ===
var uptimeSeconds = 0;

function update_rainbow_and_uptime() {
    uptimeSeconds++;

    // Радужные цвета (RGB в hex)
    var colors = [
        "#FF0000", // красный
        "#FF7F00", // оранжевый
        "#FFFF00", // жёлтый
        "#00FF00", // зелёный
        "#00FFFF", // голубой
        "#0000FF", // синий
        "#8B00FF"  // фиолетовый
    ];

    // Меняем цвет каждые 2 секунды
    var colorIdx = Math.floor(uptimeSeconds / 2) % colors.length;
    var color = colors[colorIdx];

    // Unity rich text для окрашивания
    var rainbowText = "<color=" + color + ">это режим от тяночки!</color>";
    Ui.GetContext().Hint.Value = rainbowText;
}

// === Получение аптайма в строке ===
export function get_uptime_string() {
    var h = Math.floor(uptimeSeconds / 3600);
    var m = Math.floor((uptimeSeconds % 3600) / 60);
    var s = uptimeSeconds % 60;
    return h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

// === Получение всех игроков с их ID (для онлайн-списка) ===
export function get_all_players() {
    return playersByNumId;
}
