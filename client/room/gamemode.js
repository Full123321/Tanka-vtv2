import { Build, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Room } from 'pixel_combats/room';
import * as peace from './options.js';
import * as teams from './teams.js';
import * as admin from './admin.js';
import * as zones from './zones.js';
import * as commands from './commands.js';

// === Базовые настройки ===
Room.PopupsEnable = true;
Damage.FriendlyFire = false;
BreackGraph.OnlyPlayerBlocksDmg = false;
BreackGraph.WeakBlocks = true;
BreackGraph.BreackAll = true;
Ui.GetContext().QuadsCount.Value = true;
Build.GetContext().BlocksSet.Value = BuildBlocksSet.AllClear;
peace.set_editor_options();

// Урон отключён
Damage.GetContext().DamageOut.Value = false;

// Параметры игры
Properties.GetContext().GameModeName.Value = "GameModes/EDITOR";

// === Создаём синюю команду ===
teams.create_team_blue();

// === Вход в команду и спавн ===
Teams.OnRequestJoinTeam.Add(function(player, team) { team.Add(player); });

// === Базовый инвентарь для всех ===
peace.set_default_inventory();

// === Мгновенный респавн ===
Spawns.GetContext().RespawnTime.Value = 0;

// === Инициализация систем ===
// Админка, ID игроков, радужный текст, аптайм
admin.init();

// Связываем zones с admin (для списка игроков)
zones.set_player_refs(admin.get_all_players, admin.get_player_by_id);

// Зоны (фарм, магазин, HP, хинты, переводы)
zones.init();

// Чат-команды
commands.init();
