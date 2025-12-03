(function() {
    m.couplingChange = function(change = 0) {
        if (change > 0 && level.onLevel !== -1) simulation.inGameConsole(`<div class="coupling-circle"></div> m.coupling <span class='color-symbol'>+=</span> ${change}`, 3); //changed the 60 to a 3 for the duration, reducing the lag caused by in-game console from picking up coupling. level.onLevel !== -1  means not on lore level
        m.coupling += change
        if (m.coupling < 0) {
            //look for coupling power ups on this level and remove them to prevent exploiting tech ejections
            for (let i = powerUp.length - 1; i > -1; i--) {
                if (powerUp[i].name === "coupling") {
                    Matter.Composite.remove(engine.world, powerUp[i]);
                    powerUp.splice(i, 1);
                    m.coupling += 1
                    if (!(m.coupling < 0)) break
                }
            }
            m.coupling = 0 //can't go negative
        }
        m.setMaxEnergy(false);
        // m.setMaxHealth();
        m.setFieldRegen()
        mobs.setMobSpawnHealth();
        powerUps.setPowerUpMode();

        // if ((m.fieldMode === 0 || m.fieldMode === 9) && !build.isExperimentSelection && !simulation.isTextLogOpen) simulation.circleFlare(0.4);
    }
    const counts = powerUps.spawnQueue = {};
    let running = false;
    powerUps.spawnDelay = function(type, count) {
        counts[type] = (counts[type] || 0) + count;
        if (!running) {
            const fn = function() {
                const rate = typeof powerUps.spawnRate == "number" ? powerUps.spawnRate : 10;
                let again = false;
                if (!simulation.paused && !simulation.isChoosing) {
                    for (const [key, value] of Object.entries(counts)) {
                        const spawn = Math.min(value, rate);
                        if ((counts[key] -= spawn) > 0) again = true;
                        try {
                            for (let i = 0; i < spawn; i++) {
                                powerUps.spawn(m.pos.x + 50 * (Math.random() - 0.5), m.pos.y + 50 * (Math.random() - 0.5), key);
                            }
                        } catch (e) {
                            console.error(e);
                            delete counts[key];
                        }
                    }
                } else again = true;
                if (m.alive && again) requestAnimationFrame(fn);
                else running = false;
            };
            running = true;
            requestAnimationFrame(fn);
        }
    }
    m.grabPowerUp = function() {
        if (m.fireCDcycle < m.cycle) m.fireCDcycle = m.cycle - 1
        for (let i = 0; i < powerUp.length; ++i) {
            if (tech.isEnergyNoAmmo && powerUp[i].name === "ammo") continue
            const dxP = m.pos.x - powerUp[i].position.x;
            const dyP = m.pos.y - powerUp[i].position.y;
            const dist2 = dxP * dxP + dyP * dyP + 10;
            // float towards player if looking at and in range or if very close to player
            if (
                dist2 < m.grabPowerUpRange2 &&
                (m.lookingAt(powerUp[i]) || dist2 < 10000) &&
                Matter.Query.ray(map, powerUp[i].position, m.pos).length === 0
            ) {
                if (!tech.isHealAttract || powerUp[i].name !== "heal") { //if you have accretion heals are already pulled in a different way
                    powerUp[i].force.x += 0.04 * (dxP / Math.sqrt(dist2)) * powerUp[i].mass;
                    powerUp[i].force.y += 0.04 * (dyP / Math.sqrt(dist2)) * powerUp[i].mass - powerUp[i].mass * simulation.g; //negate gravity
                    Matter.Body.setVelocity(powerUp[i], { x: powerUp[i].velocity.x * 0.11, y: powerUp[i].velocity.y * 0.11 }); //extra friction
                }
                if ( //use power up if it is close enough
                    dist2 < 5000 &&
                    !simulation.isChoosing &&
                    (powerUp[i].name !== "heal" || m.maxHealth - m.health > 0.01 || tech.isOverHeal)
                ) {
                    powerUps.onPickUp(powerUp[i]);
                    // Matter.Body.setVelocity(player, { //player knock back, after grabbing power up
                    //     x: player.velocity.x + powerUp[i].velocity.x / player.mass * 4 * powerUp[i].mass,
                    //     y: player.velocity.y + powerUp[i].velocity.y / player.mass * 4 * powerUp[i].mass
                    // });
                    powerUp[i].effect();
                    Matter.Composite.remove(engine.world, powerUp[i]);
                    powerUp.splice(i, 1);
                    i--; // this element removed
                }
            }
        }
        const rate = powerUps.useRate || 1000;
        for (const [key, value] of Object.entries(powerUps.spawnQueue)) {
            if (value < 400) continue;
            const use = Math.min(Math.floor(value * 0.01));
            try {
                for (let i = 0; i < use; i++) {
                    if (
                        !simulation.isChoosing &&
                        (key !== "heal" || m.maxHealth - m.health > 0.01 || tech.isOverHeal)
                    ) {
                        powerUps[key].effect();
                        powerUps.spawnQueue[key]--;
                    }
                }
            } catch (e) {
                console.error(e);
                delete powerUps.spawnQueue[key];
            }
        }
    }
})();
