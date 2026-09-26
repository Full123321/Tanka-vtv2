export function setupTeams() {
    try {
        // 1. Удаляем все существующие команды, чтобы избежать дублей
        const allTeams = Teams.GetAll();
        for (let i = 0; i < allTeams.length; i++) {
            const tag = allTeams[i].Tag;
            if (tag) {
                Teams.Remove(tag);
            }
        }

        // 2. Создаем команду "Чёрные" только если её нет
        if (!Teams.Get('Black')) {
            Teams.Add('Black', 'Чёрные', { r: 0, g: 0, b: 0 });
        }
        
        const blackTeam = Teams.Get('Black');
        if (!blackTeam) {
            console.error("[Teams] Критическая ошибка: не удалось создать команду Black");
            return;
        }

        // 3. Копируем спавны с команды "Blue" на "Black"
        const blueTeam = Teams.Get('Blue');
        if (blueTeam) {
            const blueSpawns = Spawns.GetContext(blueTeam);
            const blackSpawns = Spawns.GetContext(blackTeam);

            if (blueSpawns && blackSpawns) {
                // Копируем группы спавнов
                for (let i = 0; i < blueSpawns.SpawnPointsGroups.Count; i++) {
                    const group = blueSpawns.SpawnPointsGroups.Get(i);
                    // Добавляем копию группы, а не ссылку, чтобы изменения не влияли друг на друга
                    blackSpawns.SpawnPointsGroups.Add(group);
                }

                // Копируем кастомные точки спавна
                for (let i = 0; i < blueSpawns.CustomSpawnPoints.Count; i++) {
                    const point = blueSpawns.CustomSpawnPoints.Get(i);
                    if (point) {
                        blackSpawns.CustomSpawnPoints.Add(point.X, point.Y, point.Z, point.Rotation);
                    }
                }
                console.log("[Teams] Спавны успешно скопированы с Синих на Чёрных.");
            }
        } else {
            console.warn("[Teams] Команда 'Blue' не найдена на карте. Спавны не скопированы.");
        }

        // 4. Принудительное назначение команды при смене
        Teams.OnPlayerChangeTeam.Add(function(player) {
            if (player && player.Team && player.Team.Tag !== 'Black') {
                player.Team = blackTeam;
            }
        });

    } catch (e) {
        console.error("Критическая ошибка настройки команд: " + e.message);
        console.error(e.stack);
    }
}
