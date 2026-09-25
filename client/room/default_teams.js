export function setupTeams() {
    try {
        // Удаляем все существующие команды
        const allTeams = Teams.GetAll();
        for (let i = 0; i < allTeams.length; i++) {
            Teams.Remove(allTeams[i].Tag);
        }

        // Создаем команду "Чёрные"
        if (!Teams.Get('Black')) {
            Teams.Add('Black', 'Чёрные', { r: 0, g: 0, b: 0 });
        }
        const blackTeam = Teams.Get('Black');
        if (!blackTeam) return;

        // Копируем спавны с "Синих" на "Чёрных"
        const blueTeam = Teams.Get('Blue');
        if (blueTeam) {
            const blueSpawns = Spawns.GetContext(blueTeam);
            const blackSpawns = Spawns.GetContext(blackTeam);

            if (blueSpawns && blackSpawns) {
                // Копируем группы спавнов
                for (let i = 0; i < blueSpawns.SpawnPointsGroups.Count; i++) {
                    const group = blueSpawns.SpawnPointsGroups.Get(i);
                    blackSpawns.SpawnPointsGroups.Add(group);
                }

                // Копируем кастомные точки спавна
                for (let i = 0; i < blueSpawns.CustomSpawnPoints.Count; i++) {
                    const point = blueSpawns.CustomSpawnPoints.Get(i);
                    blackSpawns.CustomSpawnPoints.Add(point.X, point.Y, point.Z, point.Rotation);
                }
                console.log("[Teams] Спавны успешно скопированы с Синих на Чёрных.");
            }
        } else {
            console.warn("[Teams] Команда 'Blue' не найдена на карте.");
        }

        // Принудительное назначение команды
        Teams.OnPlayerChangeTeam.Add(function(player) {
            if (player && player.Team && player.Team.Tag !== 'Black') {
                player.Team = blackTeam;
            }
        });

    } catch (e) {
        console.error("Критическая ошибка настройки команд: " + e.message);
    }
}
