import { Chat, Spawns } from 'pixel_combats/room';
import { is_admin, give_admin, ban_player, get_player_by_id, get_all_players, get_uptime_string } from './admin.js';

export function init() {
    // Обработка сообщений чата
    // ВАЖНО: Chat.OnPlayerMessage может называться иначе в вашей версии API.
    // Если не работает — попробуйте Chat.OnMessage или другой вариант.
    try {
        Chat.OnPlayerMessage.Add(function(player, message) {
            handle_command(player, message);
        });
    } catch (e) {
        // Запасной вариант — если событие называется иначе
        try {
            Chat.OnMessage.Add(function(player, message) {
                handle_command(player, message);
            });
        } catch (e2) {
            log.debug("Chat events not available: " + e2);
        }
    }
}

function handle_command(player, message) {
    if (!message || message[0] !== '/') return;

    // Извлекаем команду и аргументы в скобках
    // Формат: /команда(аргументы)
    var cmdEnd = message.indexOf('(');
    var command, args;

    if (cmdEnd === -1) {
        // Без скобок — просто команда
        command = message.substring(1).trim().toLowerCase();
        args = "";
    } else {
        command = message.substring(1, cmdEnd).trim().toLowerCase();
        var closeParen = message.indexOf(')', cmdEnd);
        args = closeParen === -1
            ? message.substring(cmdEnd + 1)
            : message.substring(cmdEnd + 1, closeParen);
    }

    switch (command) {
        case 'tp':
            cmd_tp(player, args);
            break;
        case 'pop':
            cmd_pop(player, args);
            break;
        case 'spawn':
            cmd_spawn(player, args);
            break;
        case 'adm':
            cmd_adm(player, args);
            break;
        case 'ban':
            cmd_ban(player, args);
            break;
        case 'help':
            cmd_help(player);
            break;
        case 'id':
            cmd_id(player);
            break;
        case 'list':
            cmd_list(player);
            break;
        default:
            player.PopUp("Неизвестная команда: /" + command + "\nВведите /help для списка команд");
    }
}

// === /tp(id1,id2) — телепорт игрока id2 к игроку id1 ===
function cmd_tp(player, args) {
    if (!is_admin(player)) {
        player.PopUp("Нет прав! Только админы могут использовать /tp");
        return;
    }

    var parts = args.split(',');
    if (parts.length !== 2) {
        player.PopUp("Использование: /tp(id1,id2)\nid2 телепортируется к id1");
        return;
    }

    var id1 = parseInt(parts[0].trim());
    var id2 = parseInt(parts[1].trim());

    var target1 = get_player_by_id(id1);
    var target2 = get_player_by_id(id2);

    if (!target1 || !target2) {
        player.PopUp("Игрок не найден!\nid1: " + (target1 ? "ок" : "нет") + "\nid2: " + (target2 ? "ок" : "нет"));
        return;
    }

    // Телепортируем id2 к id1
    // ВАЖНО: точный метод телепорта зависит от API
    // Вариант 1: через SetPosition
    // Вариант 2: через повторный спавн в группе точек id1
    try {
        var pos = target1.Properties.Get("Position");
        target2.Properties.Get("Position").Value = pos.Value;
        target2.PopUp("Вы телепортированы к игроку #" + id1);
        player.PopUp("Телепорт выполнен: #" + id2 + " → #" + id1);
    } catch (e) {
        // Запасной вариант — респавн
        target2.Spawns.Spawn();
        target2.PopUp("Телепорт к #" + id1 + " (через респавн)");
        player.PopUp("Телепорт выполнен (через респавн)");
    }
}

// === /pop(сообщение) — надпись всем игрокам ===
function cmd_pop(player, args) {
    if (!is_admin(player)) {
        player.PopUp("Нет прав! Только админы могут использовать /pop");
        return;
    }

    if (!args) {
        player.PopUp("Использование: /pop(текст)");
        return;
    }

    // Отправляем попап всем игрокам
    var all = get_all_players();
    for (var id in all) {
        all[id].PopUp(args);
    }
}

// === /spawn(id) — отправить игрока на спавн ===
function cmd_spawn(player, args) {
    if (!is_admin(player)) {
        player.PopUp("Нет прав! Только админы могут использовать /spawn");
        return;
    }

    var id = parseInt(args.trim());
    if (isNaN(id)) {
        // Если без аргумента — спавним себя
        player.Spawns.Spawn();
        player.PopUp("Вы отправлены на спавн");
        return;
    }

    var target = get_player_by_id(id);
    if (!target) {
        player.PopUp("Игрок #" + id + " не найден");
        return;
    }

    target.Spawns.Spawn();
    target.PopUp("Вы отправлены на спавн админом");
    player.PopUp("Игрок #" + id + " отправлен на спавн");
}

// === /adm(id) — выдать админку игроку ===
function cmd_adm(player, args) {
    if (!is_admin(player)) {
        player.PopUp("Нет прав! Только админы могут выдавать админку");
        return;
    }

    var id = parseInt(args.trim());
    if (isNaN(id)) {
        player.PopUp("Использование: /adm(id)");
        return;
    }

    var target = get_player_by_id(id);
    if (!target) {
        player.PopUp("Игрок #" + id + " не найден");
        return;
    }

    give_admin(target);
    player.PopUp("Админка выдана игроку #" + id);
}

// === /ban(id) — забанить игрока ===
function cmd_ban(player, args) {
    if (!is_admin(player)) {
        player.PopUp("Нет прав! Только админы могут банить");
        return;
    }

    var id = parseInt(args.trim());
    if (isNaN(id)) {
        player.PopUp("Использование: /ban(id)");
        return;
    }

    var success = ban_player(id);
    if (success) {
        player.PopUp("Игрок #" + id + " забанен");
    } else {
        player.PopUp("Игрок #" + id + " не найден");
    }
}

// === /help — список команд ===
function cmd_help(player) {
    player.PopUp(
        "Команды:\n" +
        "/tp(id1,id2) — телепорт\n" +
        "/pop(текст) — надпись всем\n" +
        "/spawn(id) — на спавн\n" +
        "/adm(id) — выдать админку\n" +
        "/ban(id) — забанить\n" +
        "/id — ваш ID\n" +
        "/list — список игроков\n" +
        "Аптайм: " + get_uptime_string()
    );
}

// === /id — показать свой ID ===
function cmd_id(player) {
    var id = player.Properties.Get("PlayerId").Value;
    player.PopUp("Ваш ID: " + id);
}

// === /list — список игроков онлайн ===
function cmd_list(player) {
    var all = get_all_players();
    var text = "Игроки онлайн:\n";
    for (var id in all) {
        text += "#" + id + " ";
    }
    text += "\nАптайм: " + get_uptime_string();
    player.PopUp(text);
}
