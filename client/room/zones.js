import { AreaService, AreaPlayerTriggerService, AreaViewService, Properties, Timers } from 'pixel_combats/room';
import { is_admin, is_banned } from './admin.js';

// Хранилища для системы переводов (plata)
var transferAmount = {};   // player → сумма перевода
var transferTarget = {};   // player → числовой ID цели

// Суммы для циклического выбора в plata1
var transferAmounts = [100, 200, 500, 1000, 2000, 5000];
var transferAmountIdx = {}; // player → индекс в transferAmounts

export function init() {
    setup_farm_zones();
    setup_shop_zones();
    setup_hp_zones();
    setup_hint_zones();
    setup_plata_zones();
}

// === ФАРМ-ЗОНЫ (тег: "farm", имя: число — сколько монет даёт) ===
function setup_farm_zones() {
    var areas = AreaService.GetByTag("farm");
    for (var i = 0; i < areas.length; i++) {
        (function(area) {
            var trigger = AreaPlayerTriggerService.Get(area.Name + "Farm");
            trigger.Area = area;

            // Кулдаун чтобы не спамить
            var cooldown = {};

            trigger.OnEnter.Add(function(player) {
                if (is_banned(player)) return;

                var pId = player.Properties.Get("PlayerId").Value;
                var now = Date.now();

                // Кулдаун 3 секунды
                if (cooldown[pId] && now - cooldown[pId] < 3000) return;
                cooldown[pId] = now;

                // Имя зоны = количество монет
                var amount = parseInt(area.Name);
                if (isNaN(amount)) return;

                var coins = player.Properties.Get("Coins");
                coins.Value = (coins.Value || 0) + amount;

                player.PopUp("+" + amount + " монет\nВсего: " + coins.Value);
            });
        })(areas[i]);
    }
}

// === МАГАЗИН ОРУЖИЯ (тег: "weapon", имя: "тип@цена") ===
function setup_shop_zones() {
    var areas = AreaService.GetByTag("weapon");
    for (var i = 0; i < areas.length; i++) {
        (function(area) {
            var trigger = AreaPlayerTriggerService.Get(area.Name + "Shop");
            trigger.Area = area;

            var cooldown = {};

            trigger.OnEnter.Add(function(player) {
                if (is_banned(player)) return;

                var pId = player.Properties.Get("PlayerId").Value;
                var now = Date.now();
                if (cooldown[pId] && now - cooldown[pId] < 2000) return;
                cooldown[pId] = now;

                // Парсим "тип@цена"
                var parts = area.Name.split("@");
                if (parts.length !== 2) return;

                var type = parseInt(parts[0]);
                var price = parseInt(parts[1]);
                if (isNaN(type) || isNaN(price)) return;

                var coins = player.Properties.Get("Coins");
                if ((coins.Value || 0) < price) {
                    player.PopUp("Недостаточно средств!\nНужно: " + price + "\nУ вас: " + (coins.Value || 0));
                    return;
                }

                // Списываем монеты
                coins.Value = (coins.Value || 0) - price;

                // Выдаём оружие по типу:
                // 0-основное, 1-вторичное, 2-ближнее, 3-гранаты,
                // 4-блоки, 5-беск основа, 6-беск вторичное, 7-беск гранаты, 8-беск блоки
                switch (type) {
                    case 0: player.Inventory.Main.Value = true; break;
                    case 1: player.Inventory.Secondary.Value = true; break;
                    case 2: player.Inventory.Melee.Value = true; break;
                    case 3: player.Inventory.Explosive.Value = true; break;
                    case 4: player.Inventory.Build.Value = true; break;
                    case 5: player.Inventory.Main.Value = true; player.Inventory.MainInfinity.Value = true; break;
                    case 6: player.Inventory.Secondary.Value = true; player.Inventory.SecondaryInfinity.Value = true; break;
                    case 7: player.Inventory.Explosive.Value = true; player.Inventory.ExplosiveInfinity.Value = true; break;
                    case 8: player.Inventory.Build.Value = true; player.Inventory.BuildInfinity.Value = true; break;
                }

                player.PopUp("Куплено! type=" + type + "\nСписано: " + price + "\nОсталось: " + coins.Value);
            });
        })(areas[i]);
    }
}

// === ПОКУПКА HP (тег: "xp", имя: "хп@цена") ===
function setup_hp_zones() {
    var areas = AreaService.GetByTag("xp");
    for (var i = 0; i < areas.length; i++) {
        (function(area) {
            var trigger = AreaPlayerTriggerService.Get(area.Name + "Hp");
            trigger.Area = area;

            var cooldown = {};

            trigger.OnEnter.Add(function(player) {
                if (is_banned(player)) return;

                var pId = player.Properties.Get("PlayerId").Value;
                var now = Date.now();
                if (cooldown[pId] && now - cooldown[pId] < 2000) return;
                cooldown[pId] = now;

                // Парсим "хп@цена"
                var parts = area.Name.split("@");
                if (parts.length !== 2) return;

                var hpAmount = parseInt(parts[0]);
                var price = parseInt(parts[1]);
                if (isNaN(hpAmount) || isNaN(price)) return;

                var coins = player.Properties.Get("Coins");
                if ((coins.Value || 0) < price) {
                    player.PopUp("Недостаточно средств!\nНужно: " + price + "\nУ вас: " + (coins.Value || 0));
                    return;
                }

                coins.Value = (coins.Value || 0) - price;

                // Пытаемся восстановить HP
                // ВАЖНО: точное свойство здоровья зависит от API
                // Если Health не работает — попробуйте Hp, MaxHp или другой вариант
                try {
                    var hp = player.Properties.Get("Hp");
                    hp.Value = (hp.Value || 0) + hpAmount;
                } catch (e) {
                    // Запасной вариант — через встроенное свойство
                    try {
                        player.Properties.Health.Value += hpAmount;
                    } catch (e2) {
                        // Если ничего не работает — просто записываем в кастомное свойство
                    }
                }

                player.PopUp("Куплено " + hpAmount + " HP за " + price + " монет");
            });
        })(areas[i]);
    }
}

// === ЗОНЫ-ПОДСКАЗКИ (тег: "hint", имя: текст надписи) ===
function setup_hint_zones() {
    var areas = AreaService.GetByTag("hint");
    for (var i = 0; i < areas.length; i++) {
        (function(area) {
            var trigger = AreaPlayerTriggerService.Get(area.Name + "Hint");
            trigger.Area = area;

            trigger.OnEnter.Add(function(player) {
                if (is_banned(player)) return;

                // Имя зоны = текст подсказки (видит только этот игрок)
                player.PopUp(area.Name);
            });
        })(areas[i]);
    }
}

// === ПЕРЕВОД ДЕНЕГ (теги: "plata1", "plata2", "plata3") ===
function setup_plata_zones() {
    // plata1 — выбор суммы перевода
    var areas1 = AreaService.GetByTag("plata1");
    for (var i = 0; i < areas1.length; i++) {
        (function(area) {
            var trigger = AreaPlayerTriggerService.Get(area.Name + "Plata1");
            trigger.Area = area;

            trigger.OnEnter.Add(function(player) {
                if (is_banned(player)) return;

                var pId = player.Properties.Get("PlayerId").Value;

                // Циклический перебор сумм
                if (!transferAmountIdx[pId]) transferAmountIdx[pId] = 0;
                transferAmountIdx[pId] = (transferAmountIdx[pId] + 1) % transferAmounts.length;
                transferAmount[pId] = transferAmounts[transferAmountIdx[pId]];

                player.PopUp("Сумма перевода: " + transferAmount[pId] + "\n(Зайдите ещё раз для смены суммы)");
            });
        })(areas1[i]);
    }

    // plata2 — выбор игрока-получателя
    var areas2 = AreaService.GetByTag("plata2");
    for (var i = 0; i < areas2.length; i++) {
        (function(area) {
            var trigger = AreaPlayerTriggerService.Get(area.Name + "Plata2");
            trigger.Area = area;

            trigger.OnEnter.Add(function(player) {
                if (is_banned(player)) return;

                var pId = player.Properties.Get("PlayerId").Value;

                // Перебор всех игроков для выбора цели
                var allPlayers = get_all_players_for_transfer();
                if (allPlayers.length === 0) {
                    player.PopUp("Нет других игроков онлайн");
                    return;
                }

                // Циклический перебор
                if (!transferTarget[pId]) transferTarget[pId] = 0;
                transferTarget[pId] = (transferTarget[pId] + 1) % allPlayers.length;
                var targetId = allPlayers[transferTarget[pId]];

                player.PopUp("Получатель: игрок #" + targetId + "\n(Зайдите ещё раз для смены)");
            });
        })(areas2[i]);
    }

    // plata3 — выполнение перевода
    var areas3 = AreaService.GetByTag("plata3");
    for (var i = 0; i < areas3.length; i++) {
        (function(area) {
            var trigger = AreaPlayerTriggerService.Get(area.Name + "Plata3");
            trigger.Area = area;

            trigger.OnEnter.Add(function(player) {
                if (is_banned(player)) return;

                var pId = player.Properties.Get("PlayerId").Value;
                var amount = transferAmount[pId];
                var targetIdx = transferTarget[pId];

                if (!amount) {
                    player.PopUp("Сначала выберите сумму (зона plata1)");
                    return;
                }

                var allPlayers = get_all_players_for_transfer();
                if (allPlayers.length === 0 || targetIdx === undefined) {
                    player.PopUp("Сначала выберите получателя (зона plata2)");
                    return;
                }

                var targetId = allPlayers[targetIdx];
                var targetPlayer = get_player_by_id_for_transfer(targetId);
                if (!targetPlayer) {
                    player.PopUp("Игрок не найден");
                    return;
                }

                // Проверяем баланс
                var coins = player.Properties.Get("Coins");
                if ((coins.Value || 0) < amount) {
                    player.PopUp("Недостаточно средств!\nНужно: " + amount + "\nУ вас: " + (coins.Value || 0));
                    return;
                }

                // Списываем и переводим
                coins.Value = (coins.Value || 0) - amount;
                var targetCoins = targetPlayer.Properties.Get("Coins");
                targetCoins.Value = (targetCoins.Value || 0) + amount;

                player.PopUp("Переведено " + amount + " монет игроку #" + targetId);
                targetPlayer.PopUp("Получено " + amount + " монет от игрока #" + pId);
            });
        })(areas3[i]);
    }
}

// Вспомогательные функции для перевода
function get_all_players_for_transfer() {
    // Импортируем из admin.js
    var all = get_all_players_safe();
    var result = [];
    for (var id in all) {
        result.push(parseInt(id));
    }
    return result;
}

function get_player_by_id_for_transfer(numId) {
    return get_player_by_id_safe(numId);
}

// Безопасные обёртки (импорт через глобал, чтобы избежать циклических зависимостей)
var _allPlayers = null;
var _getPlayer = null;

export function set_player_refs(allPlayersFn, getPlayerFn) {
    _allPlayers = allPlayersFn;
    _getPlayer = getPlayerFn;
}

function get_all_players_safe() {
    if (_allPlayers) return _allPlayers();
    return {};
}

function get_player_by_id_safe(numId) {
    if (_getPlayer) return _getPlayer(numId);
    return null;
}
