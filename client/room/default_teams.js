export function setupTeams() {
    try {
        const allTeams = Teams.GetAll();
        for (let i = 0; i < allTeams.length; i++) {
            Teams.Remove(allTeams[i].Tag);
        }

        Teams.Add('Black', 'Чёрные', { r: 0, g: 0, b: 0 });
        const blackTeam = Teams.Get('Black');
        const blueTeam = Teams.Get('Blue');

        if (blueTeam) {
            const blueSpawns = Spawns.GetContext(blueTeam);
            const blackSpawns = Spawns.GetContext(blackTeam);

            for (let i = 0; i < blueSpawns.SpawnPointsGroups.Count; i++) {
                const group = blueSpawns.SpawnPointsGroups.Get(i);
                blackSpawns.SpawnPointsGroups.Add(group);
            }

            for (let i = 0; i < blueSpawns.CustomSpawnPoints.Count; i++) {
                const point = blueSpawns.CustomSpawnPoints.Get(i);
                blackSpawns.CustomSpawnPoints.Add(point.X, point.Y, point.Z, point.Rotation);
            }
        }

        Teams.OnPlayerChangeTeam.Add(function(player) {
            if (player.Team.Tag !== 'Black') {
                player.Team = blackTeam;
            }
        });
    } catch (e) {
        console.error("Teams setup error: " + e.message);
    }
}
