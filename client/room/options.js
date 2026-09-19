import { Build, Inventory } from 'pixel_combats/room';

// Базовый инвентарь для обычных игроков
export function set_default_inventory() {
    var inv = Inventory.GetContext();
    inv.Main.Value = false;
    inv.Secondary.Value = false;
    inv.Melee.Value = false;
    inv.Explosive.Value = false;
    inv.Build.Value = false;
    inv.BuildInfinity.Value = false;
}

// Админский инвентарь: всё оружие + бесконечные патроны
export function set_admin_inventory(player) {
    player.Inventory.Main.Value = true;
    player.Inventory.Secondary.Value = true;
    player.Inventory.Melee.Value = true;
    player.Inventory.Explosive.Value = true;
    player.Inventory.Build.Value = true;
    player.Inventory.MainInfinity.Value = true;
    player.Inventory.SecondaryInfinity.Value = true;
    player.Inventory.BuildInfinity.Value = true;
}

// Строительные опции редактора
export function set_editor_options() {
    Build.GetContext().Pipette.Value = true;
    Build.GetContext().FloodFill.Value = true;
    Build.GetContext().FillQuad.Value = true;
    Build.GetContext().RemoveQuad.Value = true;
    Build.GetContext().BalkLenChange.Value = true;
    Build.GetContext().FlyEnable.Value = true;
    Build.GetContext().SetSkyEnable.Value = true;
    Build.GetContext().GenMapEnable.Value = true;
    Build.GetContext().ChangeCameraPointsEnable.Value = true;
    Build.GetContext().QuadChangeEnable.Value = true;
    Build.GetContext().BuildModeEnable.Value = true;
    Build.GetContext().CollapseChangeEnable.Value = true;
    Build.GetContext().RenameMapEnable.Value = true;
    Build.GetContext().ChangeMapAuthorsEnable.Value = true;
    Build.GetContext().LoadMapEnable.Value = true;
    Build.GetContext().ChangeSpawnsEnable.Value = true;
    Build.GetContext().BuildRangeEnable.Value = true;
}

// Выдача админских строительных опций конкретному игроку
export function set_admin_build_options(player) {
    // Если у Build есть контекст игрока — включаем всё для него
    // Если нет — опции уже включены глобально через set_editor_options()
}
